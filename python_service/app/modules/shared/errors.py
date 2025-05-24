from typing import Any, Dict, List, Optional, Union
from datetime import datetime
import traceback
from enum import Enum

class ErrorCode(str, Enum):
    """에러 코드 enum"""
    
    # 일반적인 에러
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    
    # PDF 처리 에러
    PDF_NOT_FOUND = "PDF_NOT_FOUND"
    PDF_CORRUPTED = "PDF_CORRUPTED"
    PDF_ENCRYPTED = "PDF_ENCRYPTED"
    PDF_TOO_LARGE = "PDF_TOO_LARGE"
    PDF_INVALID_FORMAT = "PDF_INVALID_FORMAT"
    PDF_EXTRACTION_FAILED = "PDF_EXTRACTION_FAILED"
    PDF_PROCESSING_TIMEOUT = "PDF_PROCESSING_TIMEOUT"
    
    # 청킹 에러
    CHUNKING_FAILED = "CHUNKING_FAILED"
    CHUNK_SIZE_INVALID = "CHUNK_SIZE_INVALID"
    CHUNK_OVERLAP_INVALID = "CHUNK_OVERLAP_INVALID"
    TEXT_TOO_SHORT = "TEXT_TOO_SHORT"
    TEXT_TOO_LONG = "TEXT_TOO_LONG"
    
    # 임베딩 에러
    EMBEDDING_FAILED = "EMBEDDING_FAILED"
    EMBEDDING_MODEL_NOT_FOUND = "EMBEDDING_MODEL_NOT_FOUND"
    EMBEDDING_API_ERROR = "EMBEDDING_API_ERROR"
    EMBEDDING_TIMEOUT = "EMBEDDING_TIMEOUT"
    
    # 퀴즈 생성 에러
    QUIZ_GENERATION_FAILED = "QUIZ_GENERATION_FAILED"
    LLM_API_ERROR = "LLM_API_ERROR"
    QUIZ_VALIDATION_FAILED = "QUIZ_VALIDATION_FAILED"
    INSUFFICIENT_CONTEXT = "INSUFFICIENT_CONTEXT"
    
    # 벡터 DB 에러
    VECTOR_DB_CONNECTION_ERROR = "VECTOR_DB_CONNECTION_ERROR"
    VECTOR_DB_OPERATION_FAILED = "VECTOR_DB_OPERATION_FAILED"
    VECTOR_SEARCH_FAILED = "VECTOR_SEARCH_FAILED"
    
    # 파일 시스템 에러
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    FILE_ACCESS_DENIED = "FILE_ACCESS_DENIED"
    DISK_FULL = "DISK_FULL"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"

class AIServiceError(Exception):
    """AI 서비스 기본 에러 클래스"""
    
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        status_code: int = 500,
        user_message: Optional[str] = None
    ):
        self.code = code
        self.message = message
        self.details = details or {}
        self.status_code = status_code
        self.user_message = user_message or message
        self.timestamp = datetime.now().isoformat()
        self.trace_id = self._generate_trace_id()
        
        super().__init__(message)
    
    def _generate_trace_id(self) -> str:
        """추적 ID 생성"""
        import uuid
        return str(uuid.uuid4())[:8]
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "user_message": self.user_message,
                "details": self.details,
                "timestamp": self.timestamp,
                "trace_id": self.trace_id
            }
        }
    
    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"

# 특정 도메인별 에러 클래스들
class PDFProcessingError(AIServiceError):
    """PDF 처리 관련 에러"""
    
    def __init__(self, code: ErrorCode, message: str, **kwargs):
        status_codes = {
            ErrorCode.PDF_NOT_FOUND: 404,
            ErrorCode.PDF_CORRUPTED: 422,
            ErrorCode.PDF_ENCRYPTED: 422,
            ErrorCode.PDF_TOO_LARGE: 413,
            ErrorCode.PDF_INVALID_FORMAT: 422,
            ErrorCode.PDF_EXTRACTION_FAILED: 500,
            ErrorCode.PDF_PROCESSING_TIMEOUT: 408,
        }
        kwargs.setdefault('status_code', status_codes.get(code, 500))
        super().__init__(code, message, **kwargs)

class ChunkingError(AIServiceError):
    """청킹 관련 에러"""
    
    def __init__(self, code: ErrorCode, message: str, **kwargs):
        status_codes = {
            ErrorCode.CHUNK_SIZE_INVALID: 422,
            ErrorCode.CHUNK_OVERLAP_INVALID: 422,
            ErrorCode.TEXT_TOO_SHORT: 422,
            ErrorCode.TEXT_TOO_LONG: 413,
            ErrorCode.CHUNKING_FAILED: 500,
        }
        kwargs.setdefault('status_code', status_codes.get(code, 500))
        super().__init__(code, message, **kwargs)

class EmbeddingError(AIServiceError):
    """임베딩 관련 에러"""
    
    def __init__(self, code: ErrorCode, message: str, **kwargs):
        status_codes = {
            ErrorCode.EMBEDDING_MODEL_NOT_FOUND: 404,
            ErrorCode.EMBEDDING_API_ERROR: 502,
            ErrorCode.EMBEDDING_TIMEOUT: 408,
            ErrorCode.EMBEDDING_FAILED: 500,
        }
        kwargs.setdefault('status_code', status_codes.get(code, 500))
        super().__init__(code, message, **kwargs)

class QuizGenerationError(AIServiceError):
    """퀴즈 생성 관련 에러"""
    
    def __init__(self, code: ErrorCode, message: str, **kwargs):
        status_codes = {
            ErrorCode.LLM_API_ERROR: 502,
            ErrorCode.QUIZ_VALIDATION_FAILED: 422,
            ErrorCode.INSUFFICIENT_CONTEXT: 422,
            ErrorCode.QUIZ_GENERATION_FAILED: 500,
        }
        kwargs.setdefault('status_code', status_codes.get(code, 500))
        super().__init__(code, message, **kwargs)

class VectorDBError(AIServiceError):
    """벡터 DB 관련 에러"""
    
    def __init__(self, code: ErrorCode, message: str, **kwargs):
        status_codes = {
            ErrorCode.VECTOR_DB_CONNECTION_ERROR: 503,
            ErrorCode.VECTOR_DB_OPERATION_FAILED: 500,
            ErrorCode.VECTOR_SEARCH_FAILED: 500,
        }
        kwargs.setdefault('status_code', status_codes.get(code, 500))
        super().__init__(code, message, **kwargs)

# 에러 생성 헬퍼 함수들
def create_pdf_error(code: ErrorCode, message: str, **kwargs) -> PDFProcessingError:
    """PDF 처리 에러 생성"""
    return PDFProcessingError(code, message, **kwargs)

def create_chunking_error(code: ErrorCode, message: str, **kwargs) -> ChunkingError:
    """청킹 에러 생성"""
    return ChunkingError(code, message, **kwargs)

def create_embedding_error(code: ErrorCode, message: str, **kwargs) -> EmbeddingError:
    """임베딩 에러 생성"""
    return EmbeddingError(code, message, **kwargs)

def create_quiz_error(code: ErrorCode, message: str, **kwargs) -> QuizGenerationError:
    """퀴즈 생성 에러 생성"""
    return QuizGenerationError(code, message, **kwargs)

def create_vector_db_error(code: ErrorCode, message: str, **kwargs) -> VectorDBError:
    """벡터 DB 에러 생성"""
    return VectorDBError(code, message, **kwargs)

# 에러 핸들러 데코레이터
import functools
from app.modules.shared.logger import logger

def handle_errors(error_class: type = AIServiceError):
    """에러를 잡아서 로그를 남기고 적절한 에러로 변환하는 데코레이터"""
    
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except AIServiceError:
                # 이미 우리의 에러이므로 그대로 re-raise
                raise
            except Exception as e:
                # 예상치 못한 에러를 우리의 에러로 변환
                logger.error(
                    f"Unexpected error in {func.__name__}",
                    error=str(e),
                    traceback=traceback.format_exc()
                )
                raise error_class(
                    ErrorCode.INTERNAL_ERROR,
                    f"Unexpected error in {func.__name__}: {str(e)}",
                    details={"original_error": str(e), "function": func.__name__}
                )
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except AIServiceError:
                raise
            except Exception as e:
                logger.error(
                    f"Unexpected error in {func.__name__}",
                    error=str(e),
                    traceback=traceback.format_exc()
                )
                raise error_class(
                    ErrorCode.INTERNAL_ERROR,
                    f"Unexpected error in {func.__name__}: {str(e)}",
                    details={"original_error": str(e), "function": func.__name__}
                )
        
        # async 함수인지 확인
        if hasattr(func, '__code__') and func.__code__.co_flags & 0x80:
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator