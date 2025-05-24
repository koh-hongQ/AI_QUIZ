import asyncio
import time
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
import mimetypes
from dataclasses import dataclass

from app.modules.shared.logger import get_pdf_logger
from app.modules.shared.errors import (
    PDFProcessingError, 
    ErrorCode, 
    handle_errors
)
from app.config.settings import settings

# 나중에 실제 PDF 라이브러리 import
# import pdfplumber
# import fitz  # PyMuPDF

logger = get_pdf_logger()

@dataclass
class PDFMetadata:
    """PDF 메타데이터"""
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    creator: Optional[str] = None
    producer: Optional[str] = None
    creation_date: Optional[str] = None
    modification_date: Optional[str] = None
    page_count: int = 0
    file_size: int = 0
    pdf_version: Optional[str] = None
    is_encrypted: bool = False
    has_text_layer: bool = True
    language: Optional[str] = None

@dataclass
class PDFPage:
    """PDF 페이지 정보"""
    page_number: int
    text: str
    char_count: int
    word_count: int
    has_images: bool = False
    has_tables: bool = False
    bbox: Optional[Dict[str, float]] = None  # 페이지 경계 상자
    
    def __post_init__(self):
        if self.char_count == 0:
            self.char_count = len(self.text)
        if self.word_count == 0:
            self.word_count = len(self.text.split())

@dataclass
class PDFProcessingResult:
    """PDF 처리 결과"""
    success: bool
    file_path: str
    filename: str
    metadata: PDFMetadata
    pages: List[PDFPage]
    full_text: str
    processing_time: float
    error_message: Optional[str] = None
    
    @property
    def total_char_count(self) -> int:
        return sum(page.char_count for page in self.pages)
    
    @property
    def total_word_count(self) -> int:
        return sum(page.word_count for page in self.pages)

class PDFProcessor:
    """PDF 파일 처리 메인 클래스"""
    
    def __init__(self):
        self.logger = logger
        self.supported_formats = ['.pdf']
        self.max_file_size = settings.MAX_FILE_SIZE
        self.max_pages = settings.MAX_PAGES_PER_PDF
        self.processing_timeout = settings.PDF_PROCESSING_TIMEOUT
    
    @handle_errors(PDFProcessingError)
    async def process_file(
        self, 
        file_path: Union[str, Path],
        extract_images: bool = False,
        extract_tables: bool = False,
        page_range: Optional[tuple] = None
    ) -> PDFProcessingResult:
        """
        PDF 파일을 처리하여 텍스트와 메타데이터 추출
        
        Args:
            file_path: PDF 파일 경로
            extract_images: 이미지 추출 여부
            extract_tables: 테이블 추출 여부  
            page_range: 처리할 페이지 범위 (start, end)
        
        Returns:
            PDFProcessingResult: 처리 결과
        """
        start_time = time.time()
        file_path = Path(file_path)
        
        self.logger.info(
            f"Starting PDF processing",
            filename=file_path.name,
            extract_images=extract_images,
            extract_tables=extract_tables,
            page_range=page_range
        )
        
        try:
            # 1. 파일 검증
            await self._validate_file(file_path)
            
            # 2. 메타데이터 추출
            metadata = await self._extract_metadata(file_path)
            
            # 3. 페이지 범위 설정
            if page_range:
                start_page, end_page = page_range
                end_page = min(end_page, metadata.page_count)
            else:
                start_page, end_page = 1, metadata.page_count
            
            # 4. 텍스트 추출
            pages = await self._extract_pages(
                file_path, 
                start_page, 
                end_page,
                extract_images,
                extract_tables
            )
            
            # 5. 전체 텍스트 생성
            full_text = "\n\n".join([page.text for page in pages])
            
            processing_time = time.time() - start_time
            
            result = PDFProcessingResult(
                success=True,
                file_path=str(file_path),
                filename=file_path.name,
                metadata=metadata,
                pages=pages,
                full_text=full_text,
                processing_time=processing_time
            )
            
            self.logger.info(
                f"PDF processing completed successfully",
                filename=file_path.name,
                pages_processed=len(pages),
                total_chars=result.total_char_count,
                processing_time=f"{processing_time:.2f}s"
            )
            
            return result
            
        except PDFProcessingError:
            raise
        except asyncio.TimeoutError:
            raise PDFProcessingError(
                ErrorCode.PDF_PROCESSING_TIMEOUT,
                f"PDF processing timed out after {self.processing_timeout} seconds",
                details={"filename": file_path.name, "timeout": self.processing_timeout}
            )
        except Exception as e:
            processing_time = time.time() - start_time
            self.logger.error(
                f"PDF processing failed",
                filename=file_path.name,
                error=str(e),
                processing_time=f"{processing_time:.2f}s"
            )
            raise PDFProcessingError(
                ErrorCode.PDF_EXTRACTION_FAILED,
                f"Failed to process PDF: {str(e)}",
                details={"filename": file_path.name, "original_error": str(e)}
            )
    
    async def _validate_file(self, file_path: Path) -> None:
        """파일 유효성 검사"""
        # 파일 존재 확인
        if not file_path.exists():
            raise PDFProcessingError(
                ErrorCode.PDF_NOT_FOUND,
                f"PDF file not found: {file_path}",
                details={"file_path": str(file_path)}
            )
        
        # 파일 크기 확인
        file_size = file_path.stat().st_size
        if file_size > self.max_file_size:
            raise PDFProcessingError(
                ErrorCode.PDF_TOO_LARGE,
                f"PDF file too large: {file_size} bytes (max: {self.max_file_size})",
                details={
                    "file_size": file_size,
                    "max_size": self.max_file_size,
                    "filename": file_path.name
                }
            )
        
        # MIME 타입 확인
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if mime_type != 'application/pdf':
            raise PDFProcessingError(
                ErrorCode.PDF_INVALID_FORMAT,
                f"Invalid file format. Expected PDF, got: {mime_type}",
                details={
                    "detected_mime_type": mime_type,
                    "filename": file_path.name
                }
            )
        
        # PDF 헤더 확인
        await self._check_pdf_header(file_path)
    
    async def _check_pdf_header(self, file_path: Path) -> None:
        """PDF 파일 헤더 확인"""
        try:
            with open(file_path, 'rb') as f:
                header = f.read(8)
                if not header.startswith(b'%PDF-'):
                    raise PDFProcessingError(
                        ErrorCode.PDF_INVALID_FORMAT,
                        "Invalid PDF header",
                        details={
                            "header": header.decode('utf-8', errors='ignore'),
                            "filename": file_path.name
                        }
                    )
        except Exception as e:
            raise PDFProcessingError(
                ErrorCode.PDF_CORRUPTED,
                f"Cannot read PDF header: {str(e)}",
                details={"filename": file_path.name}
            )
    
    async def _extract_metadata(self, file_path: Path) -> PDFMetadata:
        """PDF 메타데이터 추출"""
        try:
            # 실제 구현에서는 pdfplumber나 PyMuPDF 사용
            # 현재는 시뮬레이션
            
            file_size = file_path.stat().st_size
            
            # 임시 메타데이터 (실제로는 PDF에서 추출)
            metadata = PDFMetadata(
                title=file_path.stem,
                file_size=file_size,
                page_count=10,  # 임시값
                pdf_version="1.4",
                is_encrypted=False,
                has_text_layer=True
            )
            
            # 페이지 수 제한 확인
            if metadata.page_count > self.max_pages:
                raise PDFProcessingError(
                    ErrorCode.PDF_TOO_LARGE,
                    f"PDF has too many pages: {metadata.page_count} (max: {self.max_pages})",
                    details={
                        "page_count": metadata.page_count,
                        "max_pages": self.max_pages,
                        "filename": file_path.name
                    }
                )
            
            # 암호화 확인
            if metadata.is_encrypted:
                raise PDFProcessingError(
                    ErrorCode.PDF_ENCRYPTED,
                    "PDF is password protected",
                    details={"filename": file_path.name}
                )
            
            self.logger.debug(
                f"Extracted metadata",
                filename=file_path.name,
                pages=metadata.page_count,
                size=metadata.file_size,
                version=metadata.pdf_version
            )
            
            return metadata
            
        except PDFProcessingError:
            raise
        except Exception as e:
            raise PDFProcessingError(
                ErrorCode.PDF_EXTRACTION_FAILED,
                f"Failed to extract metadata: {str(e)}",
                details={"filename": file_path.name}
            )
    
    async def _extract_pages(
        self, 
        file_path: Path, 
        start_page: int, 
        end_page: int,
        extract_images: bool = False,
        extract_tables: bool = False
    ) -> List[PDFPage]:
        """페이지별 텍스트 추출"""
        pages = []
        
        try:
            # 실제 구현에서는 pdfplumber 사용
            # 현재는 시뮬레이션
            
            for page_num in range(start_page, end_page + 1):
                # 임시 텍스트 (실제로는 PDF에서 추출)
                page_text = f"This is page {page_num} content from {file_path.name}. " * 50
                
                page = PDFPage(
                    page_number=page_num,
                    text=page_text,
                    char_count=len(page_text),
                    word_count=len(page_text.split()),
                    has_images=extract_images and (page_num % 3 == 0),  # 임시
                    has_tables=extract_tables and (page_num % 4 == 0),  # 임시
                )
                
                pages.append(page)
                
                self.logger.debug(
                    f"Extracted page {page_num}",
                    filename=file_path.name,
                    chars=page.char_count,
                    words=page.word_count
                )
                
                # 타임아웃 체크
                await asyncio.sleep(0.01)  # 다른 작업에 yield
            
            return pages
            
        except Exception as e:
            raise PDFProcessingError(
                ErrorCode.PDF_EXTRACTION_FAILED,
                f"Failed to extract pages {start_page}-{end_page}: {str(e)}",
                details={
                    "filename": file_path.name,
                    "page_range": f"{start_page}-{end_page}"
                }
            )
    
    async def get_page_count(self, file_path: Union[str, Path]) -> int:
        """PDF 페이지 수 반환"""
        file_path = Path(file_path)
        await self._validate_file(file_path)
        metadata = await self._extract_metadata(file_path)
        return metadata.page_count
    
    async def extract_text_only(self, file_path: Union[str, Path]) -> str:
        """텍스트만 빠르게 추출"""
        result = await self.process_file(file_path)
        return result.full_text
    
    def get_supported_formats(self) -> List[str]:
        """지원하는 파일 형식 반환"""
        return self.supported_formats.copy()