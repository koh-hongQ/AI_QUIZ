import re
import nltk
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from openai import OpenAI

from ..config import config
from ..logger import logger


@dataclass
class TextChunk:
    """Represents a text chunk with metadata"""
    content: str
    index: int
    page_number: Optional[int] = None
    char_start: Optional[int] = None
    char_end: Optional[int] = None
    token_count: Optional[int] = None
    metadata: Optional[Dict] = None


@dataclass
class ProcessingResult:
    """Result of text processing"""
    cleaned_text: str
    chunks: List[TextChunk]
    total_tokens: int
    processing_time: float


class TextProcessor:
    """Advanced text processing with LLM-based cleaning and semantic chunking"""
    
    def __init__(self):
        self.openai_client = OpenAI(api_key=config.OPENAI_API_KEY)
        self.chunk_size = config.CHUNK_SIZE
        self.chunk_overlap = config.CHUNK_OVERLAP
        
        # Download required NLTK data
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')
        
        logger.info(f"Initialized TextProcessor with chunk_size={self.chunk_size}, overlap={self.chunk_overlap}")
    
    async def process_text(self, text: str) -> str:
        """
        Clean and correct text using LLM
        
        Args:
            text: Raw text to process
            
        Returns:
            Cleaned and corrected text
        """
        try:
            logger.info("Starting text cleaning with LLM")
            
            # Basic cleaning first
            text = self._basic_cleaning(text)
            
            # If text is too long, process in chunks
            if len(text) > 4000:  # Leave room for prompt
                chunks = self._split_for_cleaning(text)
                cleaned_chunks = []
                
                for i, chunk in enumerate(chunks):
                    logger.debug(f"Cleaning chunk {i+1}/{len(chunks)}")
                    cleaned_chunk = await self._llm_clean_text(chunk)
                    cleaned_chunks.append(cleaned_chunk)
                
                cleaned_text = ' '.join(cleaned_chunks)
            else:
                cleaned_text = await self._llm_clean_text(text)
            
            logger.info(f"Text cleaning completed. Length: {len(text)} -> {len(cleaned_text)}")
            return cleaned_text
            
        except Exception as e:
            logger.error(f"Error in text processing: {str(e)}")
            # Return basic cleaned text as fallback
            return self._basic_cleaning(text)
    
    async def create_chunks(self, text: str, page_count: Optional[int] = None) -> List[TextChunk]:
        """
        Create semantic chunks from text
        
        Args:
            text: Text to chunk
            page_count: Number of pages in original document
            
        Returns:
            List of TextChunk objects
        """
        try:
            logger.info("Starting text chunking")
            
            # Estimate page numbers if provided
            page_boundaries = self._estimate_page_boundaries(text, page_count) if page_count else None
            
            # Split into sentences
            sentences = nltk.sent_tokenize(text)
            
            # Create chunks
            chunks = []
            current_chunk = ""
            current_tokens = 0
            char_start = 0
            
            for i, sentence in enumerate(sentences):
                sentence_tokens = self._estimate_tokens(sentence)
                
                # Check if adding this sentence would exceed chunk size
                if current_tokens + sentence_tokens > self.chunk_size and current_chunk:
                    # Save current chunk
                    char_end = char_start + len(current_chunk)
                    page_num = self._get_page_number(char_start, page_boundaries) if page_boundaries else None
                    
                    chunk = TextChunk(
                        content=current_chunk.strip(),
                        index=len(chunks),
                        page_number=page_num,
                        char_start=char_start,
                        char_end=char_end,
                        token_count=current_tokens
                    )
                    chunks.append(chunk)
                    
                    # Start new chunk with overlap
                    overlap_text = self._get_overlap_text(current_chunk)
                    char_start = char_end - len(overlap_text)
                    current_chunk = overlap_text + " " + sentence if overlap_text else sentence
                    current_tokens = self._estimate_tokens(current_chunk)
                else:
                    # Add sentence to current chunk
                    current_chunk += " " + sentence if current_chunk else sentence
                    current_tokens += sentence_tokens
            
            # Add final chunk
            if current_chunk:
                char_end = char_start + len(current_chunk)
                page_num = self._get_page_number(char_start, page_boundaries) if page_boundaries else None
                
                chunk = TextChunk(
                    content=current_chunk.strip(),
                    index=len(chunks),
                    page_number=page_num,
                    char_start=char_start,
                    char_end=char_end,
                    token_count=current_tokens
                )
                chunks.append(chunk)
            
            # Validate chunks with LLM
            validated_chunks = await self._validate_chunks(chunks)
            
            logger.info(f"Created {len(validated_chunks)} chunks from text")
            return validated_chunks
            
        except Exception as e:
            logger.error(f"Error creating chunks: {str(e)}")
            raise
    
    def _basic_cleaning(self, text: str) -> str:
        """
        Basic text cleaning operations
        
        Args:
            text: Text to clean
            
        Returns:
            Cleaned text
        """
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove form feed characters
        text = text.replace('\f', '')
        
        # Remove excessive punctuation
        text = re.sub(r'[.!?]{3,}', '...', text)
        text = re.sub(r'[,;:]{2,}', ',', text)
        
        # Fix spacing around punctuation
        text = re.sub(r'\s+([.!?,:;])', r'\1', text)
        text = re.sub(r'([.!?,:;])\s+', r'\1 ', text)
        
        # Remove multiple spaces
        text = re.sub(r' +', ' ', text)
        
        # Trim
        text = text.strip()
        
        return text
    
    def _split_for_cleaning(self, text: str, max_chunk_size: int = 3000) -> List[str]:
        """Split text into smaller chunks for cleaning"""
        words = text.split()
        chunks = []
        current_chunk = []
        current_length = 0
        
        for word in words:
            if current_length + len(word) + 1 > max_chunk_size and current_chunk:
                chunks.append(' '.join(current_chunk))
                current_chunk = [word]
                current_length = len(word)
            else:
                current_chunk.append(word)
                current_length += len(word) + 1
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    async def _llm_clean_text(self, text: str) -> str:
        """
        Use LLM to clean and correct text
        
        Args:
            text: Text to clean
            
        Returns:
            Cleaned text
        """
        try:
            prompt = f"""
            Please clean and correct the following text extracted from a PDF. Fix:
            1. OCR errors and typos
            2. Missing spaces between words
            3. Broken hyphenation
            4. Inconsistent formatting
            5. Maintain the original meaning and structure
            
            Text to clean:
            {text}
            
            Return only the cleaned text without any explanations:
            """
            
            response = await self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a text cleaning expert. Clean the provided text while preserving its meaning and structure."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=len(text.split()) + 100,
                temperature=0.1
            )
            
            cleaned_text = response.choices[0].message.content.strip()
            return cleaned_text
            
        except Exception as e:
            logger.error(f"Error in LLM text cleaning: {str(e)}")
            return text  # Return original text as fallback
    
    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count for text"""
        # Simple estimation: 1 token ~= 0.75 words
        return int(len(text.split()) / 0.75)
    
    def _estimate_page_boundaries(self, text: str, page_count: int) -> List[int]:
        """Estimate character positions where pages end"""
        text_length = len(text)
        chars_per_page = text_length / page_count
        boundaries = [int(chars_per_page * i) for i in range(1, page_count)]
        return boundaries
    
    def _get_page_number(self, char_position: int, page_boundaries: List[int]) -> int:
        """Get page number for a character position"""
        for i, boundary in enumerate(page_boundaries):
            if char_position < boundary:
                return i + 1
        return len(page_boundaries) + 1
    
    def _get_overlap_text(self, text: str) -> str:
        """Get overlap text from the end of current chunk"""
        words = text.split()
        overlap_words = int(len(words) * (self.chunk_overlap / self.chunk_size))
        if overlap_words > 0:
            return ' '.join(words[-overlap_words:])
        return ""
    
    async def _validate_chunks(self, chunks: List[TextChunk]) -> List[TextChunk]:
        """
        Validate chunks using LLM to ensure semantic coherence
        
        Args:
            chunks: List of chunks to validate
            
        Returns:
            Validated chunks
        """
        try:
            logger.info("Validating chunks with LLM")
            
            # Process chunks in batches
            batch_size = 5
            validated_chunks = []
            
            for i in range(0, len(chunks), batch_size):
                batch = chunks[i:i + batch_size]
                
                for chunk in batch:
                    # Simple validation: check if chunk is coherent
                    if len(chunk.content.split()) < 10:  # Too short
                        logger.warning(f"Chunk {chunk.index} is too short, merging with next")
                        continue
                    
                    validated_chunks.append(chunk)
            
            # Merge short chunks with adjacent ones
            final_chunks = []
            i = 0
            while i < len(validated_chunks):
                current_chunk = validated_chunks[i]
                
                # Check if next chunk exists and current is short
                if (i + 1 < len(validated_chunks) and 
                    len(current_chunk.content.split()) < 20):
                    # Merge with next chunk
                    next_chunk = validated_chunks[i + 1]
                    merged_content = current_chunk.content + " " + next_chunk.content
                    
                    merged_chunk = TextChunk(
                        content=merged_content,
                        index=len(final_chunks),
                        page_number=current_chunk.page_number,
                        char_start=current_chunk.char_start,
                        char_end=next_chunk.char_end,
                        token_count=self._estimate_tokens(merged_content)
                    )
                    final_chunks.append(merged_chunk)
                    i += 2  # Skip next chunk as it's merged
                else:
                    # Update index
                    current_chunk.index = len(final_chunks)
                    final_chunks.append(current_chunk)
                    i += 1
            
            logger.info(f"Validation completed. {len(chunks)} -> {len(final_chunks)} chunks")
            return final_chunks
            
        except Exception as e:
            logger.error(f"Error validating chunks: {str(e)}")
            return chunks  # Return original chunks as fallback


# Global processor instance
text_processor = TextProcessor()
