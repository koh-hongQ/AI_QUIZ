import re
import json
import sys
from typing import List, Dict
import openai
from dotenv import load_dotenv
import os

load_dotenv()

class TextCleaner:
    """
    Text cleaning and validation using LLM
    """
    
    def __init__(self, api_key: str = None):
        """
        Initialize text cleaner with OpenAI API
        """
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        if self.api_key:
            openai.api_key = self.api_key
    
    def basic_text_cleaning(self, text: str) -> str:
        """
        Perform basic text cleaning without LLM
        """
        if not text:
            return ""
        
        # Remove form feed characters
        text = text.replace('\f', '')
        
        # Normalize line endings
        text = re.sub(r'\r\n|\r', '\n', text)
        
        # Remove excessive blank lines
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Replace bullet points
        text = text.replace('•', '- ')
        text = text.replace('◦', '  - ')
        
        # Remove extra spaces
        text = re.sub(r' {2,}', ' ', text)
        
        # Fix common OCR errors
        text = self._fix_ocr_errors(text)
        
        # Remove page numbers and headers/footers
        text = self._remove_headers_footers(text)
        
        return text.strip()
    
    def llm_text_cleaning(self, text: str) -> str:
        """
        Use LLM for advanced text cleaning and error correction
        """
        if not self.api_key:
            print("Warning: No OpenAI API key provided, using basic cleaning only")
            return self.basic_text_cleaning(text)
        
        try:
            # Split large text into chunks for processing
            chunks = self._split_text_for_llm(text)
            cleaned_chunks = []
            
            for chunk in chunks:
                cleaned_chunk = self._clean_chunk_with_llm(chunk)
                cleaned_chunks.append(cleaned_chunk)
            
            return '\n\n'.join(cleaned_chunks)
            
        except Exception as e:
            print(f"LLM cleaning failed: {e}")
            return self.basic_text_cleaning(text)
    
    def _fix_ocr_errors(self, text: str) -> str:
        """
        Fix common OCR recognition errors
        """
        # Common OCR replacements
        replacements = {
            'rn': 'm',
            'l1': 'll',
            '0': 'o',  # Only in words, not numbers
            '5': 's',  # When it makes sense contextually
            'l': 'I',  # At beginning of sentences
        }
        
        # Apply replacements carefully to avoid breaking valid text
        for old, new in replacements.items():
            # Use word boundaries to avoid breaking numbers or valid words
            if old in ['rn', 'l1']:
                text = re.sub(f'\\b{old}\\b', new, text)
        
        return text
    
    def _remove_headers_footers(self, text: str) -> str:
        """
        Remove headers, footers, and page numbers
        """
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # Skip lines that look like page numbers
            if re.match(r'^\s*\d+\s*$', line):
                continue
            
            # Skip lines that look like headers/footers
            if len(line.strip()) < 5 and re.search(r'\d+', line):
                continue
            
            cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines)
    
    def _split_text_for_llm(self, text: str, max_tokens: int = 1500) -> List[str]:
        """
        Split text into chunks suitable for LLM processing
        """
        # Simple word-based splitting
        words = text.split()
        chunks = []
        current_chunk = []
        current_count = 0
        
        for word in words:
            current_chunk.append(word)
            current_count += 1
            
            if current_count >= max_tokens:
                chunks.append(' '.join(current_chunk))
                current_chunk = []
                current_count = 0
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    def _clean_chunk_with_llm(self, chunk: str) -> str:
        """
        Clean a single text chunk using LLM
        """
        try:
            prompt = f"""Please clean and correct the following text extracted from a PDF. 
            Fix any OCR errors, correct spacing issues, and ensure proper formatting while maintaining the original meaning.
            Do not add any additional content or interpretation.
            
            Text to clean:
            {chunk}
            
            Cleaned text:"""
            
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a text cleaning assistant. Clean the provided text without changing its meaning or adding new content."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.1
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"Error cleaning chunk with LLM: {e}")
            return self.basic_text_cleaning(chunk)


def main():
    """
    Command line interface for text cleaning
    """
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python text_cleaner.py '<text_to_clean>' [--use-llm]"}))
        sys.exit(1)
    
    text_to_clean = sys.argv[1]
    use_llm = '--use-llm' in sys.argv
    
    cleaner = TextCleaner()
    
    if use_llm:
        cleaned_text = cleaner.llm_text_cleaning(text_to_clean)
    else:
        cleaned_text = cleaner.basic_text_cleaning(text_to_clean)
    
    result = {
        "cleaned_text": cleaned_text,
        "method_used": "llm" if use_llm else "basic"
    }
    
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
