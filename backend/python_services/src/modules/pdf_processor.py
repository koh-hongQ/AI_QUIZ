import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
import re
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path

from ..config import config
from ..logger import logger


@dataclass
class PDFProcessingResult:
    """Result of PDF processing"""
    text: str
    pages: List[str]
    metadata: Dict
    images_processed: int
    ocr_confidence: float


class PDFProcessor:
    """Enhanced PDF processing with OCR support"""
    
    def __init__(self):
        self.confidence_threshold = config.OCR_CONFIDENCE_THRESHOLD
        logger.info(f"Initialized PDFProcessor with confidence threshold: {self.confidence_threshold}")
    
    async def extract_text_from_pdf(self, file_path: str) -> PDFProcessingResult:
        """
        Extract text from PDF using PyMuPDF and OCR fallback
        
        Args:
            file_path: Path to the PDF file
            
        Returns:
            PDFProcessingResult containing extracted text and metadata
        """
        try:
            logger.info(f"Starting PDF text extraction for: {file_path}")
            
            # Open the PDF
            pdf_document = fitz.open(file_path)
            
            # Check file size
            file_size_mb = Path(file_path).stat().st_size / (1024 * 1024)
            if file_size_mb > config.MAX_PDF_SIZE_MB:
                raise ValueError(f"PDF file too large: {file_size_mb:.2f} MB > {config.MAX_PDF_SIZE_MB} MB")
            
            # Initialize results
            all_text = []
            page_texts = []
            images_processed = 0
            total_confidence = 0.0
            confidence_scores = []
            
            # Process each page
            for page_num in range(pdf_document.page_count):
                logger.debug(f"Processing page {page_num + 1}/{pdf_document.page_count}")
                
                page = pdf_document[page_num]
                
                # Extract text directly from PDF
                page_text = page.get_text()
                
                # If direct extraction yields little text, use OCR
                if len(page_text.strip()) < 50:
                    logger.info(f"Low text content on page {page_num + 1}, applying OCR")
                    ocr_text, confidence = await self._apply_ocr_to_page(page)
                    
                    if confidence > self.confidence_threshold:
                        page_text = ocr_text
                        confidence_scores.append(confidence)
                        images_processed += 1
                        logger.info(f"OCR applied successfully with confidence: {confidence:.2f}")
                    else:
                        logger.warning(f"OCR confidence too low: {confidence:.2f}")
                
                # Clean and add page text
                cleaned_text = self._clean_text(page_text)
                page_texts.append(cleaned_text)
                all_text.append(cleaned_text)
            
            # Calculate average confidence
            avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 1.0
            
            # Extract metadata
            metadata = {
                'page_count': pdf_document.page_count,
                'title': pdf_document.metadata.get('title', ''),
                'author': pdf_document.metadata.get('author', ''),
                'subject': pdf_document.metadata.get('subject', ''),
                'creator': pdf_document.metadata.get('creator', ''),
                'file_size_mb': file_size_mb,
                'ocr_pages': images_processed
            }
            
            pdf_document.close()
            
            # Combine all text
            combined_text = '\n\n'.join(all_text)
            
            result = PDFProcessingResult(
                text=combined_text,
                pages=page_texts,
                metadata=metadata,
                images_processed=images_processed,
                ocr_confidence=avg_confidence
            )
            
            logger.info(f"PDF processing completed. Extracted {len(combined_text)} characters from {metadata['page_count']} pages")
            return result
            
        except Exception as e:
            logger.error(f"Error processing PDF {file_path}: {str(e)}")
            raise
    
    async def _apply_ocr_to_page(self, page) -> Tuple[str, float]:
        """
        Apply OCR to a PDF page
        
        Args:
            page: PyMuPDF page object
            
        Returns:
            Tuple of (extracted_text, confidence_score)
        """
        try:
            # Convert page to image
            mat = fitz.Matrix(2.0, 2.0)  # Higher resolution for better OCR
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            
            # Convert to PIL Image
            image = Image.open(io.BytesIO(img_data))
            
            # Apply OCR
            ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            
            # Extract text and calculate confidence
            words = []
            confidences = []
            
            for i, word in enumerate(ocr_data['text']):
                if word.strip():
                    words.append(word)
                    confidences.append(int(ocr_data['conf'][i]))
            
            # Calculate average confidence
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            # Combine words into text
            text = ' '.join(words)
            
            return text, avg_confidence / 100.0  # Convert to 0-1 scale
            
        except Exception as e:
            logger.error(f"Error applying OCR: {str(e)}")
            return "", 0.0
    
    def _clean_text(self, text: str) -> str:
        """
        Clean extracted text
        
        Args:
            text: Raw extracted text
            
        Returns:
            Cleaned text
        """
        if not text:
            return ""
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove form feed characters
        text = text.replace('\f', '')
        
        # Fix common OCR errors
        text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)  # Add space between words
        text = re.sub(r'(\d)([A-Za-z])', r'\1 \2', text)  # Add space between numbers and letters
        text = re.sub(r'([A-Za-z])(\d)', r'\1 \2', text)  # Add space between letters and numbers
        
        # Remove multiple spaces
        text = re.sub(r' +', ' ', text)
        
        # Trim
        text = text.strip()
        
        return text
    
    def validate_pdf(self, file_path: str) -> bool:
        """
        Validate if the file is a valid PDF
        
        Args:
            file_path: Path to the file
            
        Returns:
            True if valid PDF, False otherwise
        """
        try:
            with fitz.open(file_path) as doc:
                return doc.is_pdf
        except:
            return False


# Global processor instance
pdf_processor = PDFProcessor()
