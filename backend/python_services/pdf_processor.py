#!/usr/bin/env python3
"""
PDF Processing Service using Python
Advanced PDF parsing and text preprocessing
"""

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
import re
import json
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AdvancedPDFProcessor:
    def __init__(self):
        self.setup_tesseract()
    
    def setup_tesseract(self):
        """Configure Tesseract OCR settings"""
        # Add Korean language support
        self.tesseract_config = r'--oem 3 --psm 6'
        self.languages = 'eng+kor'  # English + Korean
    
    def extract_text_with_pymupdf(self, pdf_path: str) -> Dict:
        """Extract text using PyMuPDF (fitz)"""
        try:
            doc = fitz.open(pdf_path)
            
            full_text = ""
            page_texts = []
            images_extracted = 0
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                
                # Extract text
                text = page.get_text()
                page_texts.append(text)
                full_text += text + "\n\n"
                
                # Check for images that might need OCR
                image_list = page.get_images()
                images_extracted += len(image_list)
            
            doc.close()
            
            return {
                "text": full_text,
                "page_count": len(doc),
                "page_texts": page_texts,
                "images_found": images_extracted,
                "method": "pymupdf",
                "success": True
            }
            
        except Exception as e:
            logger.error(f"PyMuPDF extraction failed: {e}")
            return {"success": False, "error": str(e)}
    
    def extract_with_ocr(self, pdf_path: str) -> Dict:
        """Extract text using OCR (Tesseract)"""
        try:
            doc = fitz.open(pdf_path)
            full_text = ""
            page_texts = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                
                # Convert page to image
                mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better OCR
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("png")
                
                # OCR the image
                image = Image.open(io.BytesIO(img_data))
                text = pytesseract.image_to_string(
                    image, 
                    lang=self.languages,
                    config=self.tesseract_config
                )
                
                page_texts.append(text)
                full_text += text + "\n\n"
            
            doc.close()
            
            return {
                "text": full_text,
                "page_count": len(doc),
                "page_texts": page_texts,
                "method": "ocr",
                "success": True
            }
            
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return {"success": False, "error": str(e)}
    
    def assess_text_quality(self, text: str) -> Dict:
        """Assess the quality of extracted text"""
        if not text or len(text) < 50:
            return {"needs_ocr": True, "reason": "text_too_short"}
        
        # Calculate ratios
        total_chars = len(text)
        special_chars = len(re.findall(r'[^\w\s\u3131-\u3163\uac00-\ud7a3]', text))
        korean_chars = len(re.findall(r'[\uac00-\ud7a3]', text))
        english_words = len(re.findall(r'\b[a-zA-Z]{2,}\b', text))
        
        special_ratio = special_chars / total_chars if total_chars > 0 else 1
        
        # Decision criteria
        if special_ratio > 0.5:
            return {"needs_ocr": True, "reason": "too_many_special_chars"}
        
        if korean_chars == 0 and english_words < 10:
            return {"needs_ocr": True, "reason": "low_word_density"}
        
        return {"needs_ocr": False, "quality": "good"}
    
    def process_pdf(self, pdf_path: str) -> Dict:
        """Main PDF processing function"""
        logger.info(f"Processing PDF: {pdf_path}")
        
        # First attempt with PyMuPDF
        result = self.extract_text_with_pymupdf(pdf_path)
        
        if not result["success"]:
            return result
        
        # Assess text quality
        quality = self.assess_text_quality(result["text"])
        
        if quality["needs_ocr"]:
            logger.info(f"Text quality poor ({quality['reason']}), attempting OCR")
            ocr_result = self.extract_with_ocr(pdf_path)
            
            if ocr_result["success"]:
                # Compare results and choose better one
                if len(ocr_result["text"]) > len(result["text"]):
                    result = ocr_result
                    result["fallback_method"] = "ocr_preferred"
                else:
                    result["fallback_attempted"] = True
        
        return result

class AdvancedTextPreprocessor:
    def __init__(self):
        self.korean_patterns = self._load_korean_patterns()
    
    def _load_korean_patterns(self) -> Dict:
        """Load Korean-specific text patterns"""
        return {
            # Common OCR errors in Korean
            "ocr_corrections": {
                r'([가-힣])\s+([가-힣])': r'\1\2',  # Remove spaces within Korean words
                r'(\d+)\s*년\s*(\d+)\s*월': r'\1년 \2월',  # Normalize dates
                r'(\d+)\s*페\s*이\s*지': r'\1페이지',  # Fix "page" OCR errors
            },
            # Section headers
            "headers": [
                r'^제\s*\d+\s*장.*',  # Chapter headers
                r'^제\s*\d+\s*절.*',  # Section headers  
                r'^\d+\.\s*[가-힣].*',  # Numbered sections
                r'^[가-힣]{2,}\s*:',   # Title with colon
            ],
            # Remove patterns
            "remove_patterns": [
                r'그림\s*\d+',     # Figure references
                r'표\s*\d+',       # Table references
                r'페이지\s*\d+',   # Page numbers
                r'\[그림\s*\d+\]', # Figure captions
            ]
        }
    
    def basic_cleaning(self, text: str) -> str:
        """Advanced text cleaning with Korean support"""
        if not text:
            return ""
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Apply Korean OCR corrections
        for pattern, replacement in self.korean_patterns["ocr_corrections"].items():
            text = re.sub(pattern, replacement, text)
        
        # Remove unwanted patterns
        for pattern in self.korean_patterns["remove_patterns"]:
            text = re.sub(pattern, '', text)
        
        # Normalize line breaks
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Clean up punctuation spacing
        text = re.sub(r'\s+([,.;:!?])', r'\1', text)
        text = re.sub(r'([,.;:!?])\s+', r'\1 ', text)
        
        return text.strip()
    
    def intelligent_chunking(self, text: str, max_tokens: int = 500) -> List[Dict]:
        """Intelligent text chunking with Korean support"""
        # Split by paragraphs first
        paragraphs = re.split(r'\n\s*\n', text)
        
        chunks = []
        current_chunk = ""
        chunk_index = 0
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            # Check if this paragraph is a header
            is_header = any(re.match(pattern, para) for pattern in self.korean_patterns["headers"])
            
            # Estimate tokens (rough: 1 token ≈ 0.7 words for Korean)
            estimated_tokens = len(para.split()) / 0.7
            current_tokens = len(current_chunk.split()) / 0.7
            
            if (current_tokens + estimated_tokens > max_tokens and current_chunk) or is_header:
                # Save current chunk
                if current_chunk:
                    chunks.append({
                        "content": current_chunk.strip(),
                        "index": chunk_index,
                        "token_count": int(len(current_chunk.split()) / 0.7),
                        "chunk_id": f"chunk_{chunk_index}_{int(time.time())}"
                    })
                    chunk_index += 1
                
                current_chunk = para
            else:
                current_chunk += "\n\n" + para if current_chunk else para
        
        # Add final chunk
        if current_chunk:
            chunks.append({
                "content": current_chunk.strip(),
                "index": chunk_index,
                "token_count": int(len(current_chunk.split()) / 0.7),
                "chunk_id": f"chunk_{chunk_index}_{int(time.time())}"
            })
        
        return chunks
    
    def process_text(self, text: str, chunk_size: int = 500) -> Dict:
        """Complete text preprocessing pipeline"""
        # Clean the text
        cleaned_text = self.basic_cleaning(text)
        
        # Create chunks
        chunks = self.intelligent_chunking(cleaned_text, chunk_size)
        
        return {
            "cleaned_text": cleaned_text,
            "chunks": chunks,
            "total_chunks": len(chunks),
            "success": True
        }

def main():
    parser = argparse.ArgumentParser(description='Advanced PDF Processing')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--output', '-o', help='Output JSON file', default='output.json')
    parser.add_argument('--chunk-size', type=int, default=500, help='Max tokens per chunk')
    parser.add_argument('--lang', default='eng+kor', help='OCR languages')
    
    args = parser.parse_args()
    
    # Initialize processors
    pdf_processor = AdvancedPDFProcessor()
    text_processor = AdvancedTextPreprocessor()
    
    # Process PDF
    pdf_result = pdf_processor.process_pdf(args.pdf_path)
    
    if not pdf_result["success"]:
        print(f"Error processing PDF: {pdf_result['error']}")
        return
    
    # Process text
    text_result = text_processor.process_text(pdf_result["text"], args.chunk_size)
    
    # Combine results
    final_result = {
        "pdf_extraction": pdf_result,
        "text_processing": text_result,
        "metadata": {
            "source_file": args.pdf_path,
            "processing_time": "calculated_if_needed"
        }
    }
    
    # Save results
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(final_result, f, ensure_ascii=False, indent=2)
    
    print(f"Processing complete. Results saved to {args.output}")
    print(f"Extracted {pdf_result['page_count']} pages")
    print(f"Created {text_result['total_chunks']} chunks")

if __name__ == "__main__":
    import time
    main()
