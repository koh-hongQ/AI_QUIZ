import fitz  # PyMuPDF
import cv2
import pytesseract
import numpy as np
from PIL import Image
import json
import sys
import os
from typing import Dict, List, Optional

class PDFExtractor:
    """
    PDF text extraction using PyMuPDF as primary method with Tesseract OCR fallback
    """
    
    def __init__(self, use_ocr_threshold: float = 0.7):
        """
        Initialize PDF extractor
        
        Args:
            use_ocr_threshold: Minimum text confidence to use OCR fallback
        """
        self.use_ocr_threshold = use_ocr_threshold
    
    def extract_text_from_pdf(self, file_path: str) -> Dict:
        """
        Extract text from PDF using PyMuPDF with OCR fallback
        
        Args:
            file_path: Path to PDF file
            
        Returns:
            Dictionary containing extracted text, page count, and metadata
        """
        try:
            # Open PDF with PyMuPDF
            doc = fitz.open(file_path)
            
            text_content = []
            page_texts = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                
                # Extract text with PyMuPDF
                text = page.get_text()
                
                # If extracted text is too sparse, use OCR
                if self._should_use_ocr(text, page):
                    ocr_text = self._extract_with_ocr(page)
                    if ocr_text:
                        text = ocr_text
                
                page_texts.append({
                    'page_number': page_num + 1,
                    'text': text
                })
                text_content.append(text)
            
            doc.close()
            
            return {
                'text': '\n\n'.join(text_content),
                'pageCount': len(doc),
                'page_texts': page_texts,
                'extracted_successfully': True
            }
            
        except Exception as e:
            return {
                'error': str(e),
                'extracted_successfully': False
            }
    
    def _should_use_ocr(self, text: str, page) -> bool:
        """
        Determine if OCR should be used based on text density
        """
        if not text or len(text.strip()) < 50:
            return True
        
        # Check if page has images that might contain text
        image_list = page.get_images()
        if len(image_list) > 0:
            return True
        
        return False
    
    def _extract_with_ocr(self, page) -> Optional[str]:
        """
        Extract text using Tesseract OCR
        """
        try:
            # Convert page to image
            matrix = fitz.Matrix(2, 2)  # Increase resolution
            pix = page.get_pixmap(matrix=matrix)
            img_data = pix.tobytes("png")
            
            # Convert to PIL Image
            image = Image.open(io.BytesIO(img_data))
            
            # Preprocess image for better OCR
            image = self._preprocess_image(image)
            
            # Extract text with Tesseract
            text = pytesseract.image_to_string(image, config='--psm 6')
            
            return text
            
        except Exception as e:
            print(f"OCR failed: {e}")
            return None
    
    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """
        Preprocess image for better OCR accuracy
        """
        # Convert to numpy array
        img_array = np.array(image)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Apply threshold to get binary image
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Convert back to PIL Image
        return Image.fromarray(binary)


def main():
    """
    Command line interface for PDF extraction
    """
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python pdf_extractor.py <pdf_path>"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)
    
    extractor = PDFExtractor()
    result = extractor.extract_text_from_pdf(pdf_path)
    
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
