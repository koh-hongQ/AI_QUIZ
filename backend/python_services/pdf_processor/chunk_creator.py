import json
import sys
import re
from typing import List, Dict, Optional
import openai
from dotenv import load_dotenv
import os

load_dotenv()

class ChunkCreator:
    """
    Create and validate content chunks with LLM assistance
    """
    
    def __init__(self, api_key: str = None):
        """
        Initialize chunk creator with OpenAI API
        """
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        if self.api_key:
            openai.api_key = self.api_key
    
    def create_chunks(self, text: str, page_count: int, target_chunk_size: int = 500) -> List[Dict]:
        """
        Create semantic chunks from cleaned text
        
        Args:
            text: Cleaned text to chunk
            page_count: Number of pages in the document
            target_chunk_size: Target number of tokens per chunk
            
        Returns:
            List of chunks with metadata
        """
        # Split text into paragraphs
        paragraphs = re.split(r'\n{2,}', text)
        
        chunks = []
        current_chunk = ""
        current_token_count = 0
        
        # Estimate tokens per page for page number calculation
        total_tokens = len(text.split())
        tokens_per_page = total_tokens / page_count if page_count > 0 else total_tokens
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            
            paragraph_tokens = len(paragraph.split())
            
            # Check if we should start a new chunk
            if (current_token_count > 0 and 
                current_token_count + paragraph_tokens > target_chunk_size):
                
                # Add current chunk
                page_number = self._estimate_page_number(
                    len(chunks), target_chunk_size, tokens_per_page
                )
                chunks.append({
                    'content': current_chunk.strip(),
                    'page_number': page_number,
                    'index': len(chunks),
                    'token_count': current_token_count
                })
                
                # Start new chunk
                current_chunk = paragraph
                current_token_count = paragraph_tokens
            else:
                # Add to current chunk
                if current_chunk:
                    current_chunk += '\n\n' + paragraph
                else:
                    current_chunk = paragraph
                current_token_count += paragraph_tokens
        
        # Add final chunk
        if current_chunk:
            page_number = self._estimate_page_number(
                len(chunks), target_chunk_size, tokens_per_page
            )
            chunks.append({
                'content': current_chunk.strip(),
                'page_number': page_number,
                'index': len(chunks),
                'token_count': current_token_count
            })
        
        return chunks
    
    def validate_chunks_with_llm(self, chunks: List[Dict]) -> List[Dict]:
        """
        Validate and potentially merge/split chunks using LLM
        """
        if not self.api_key:
            print("Warning: No OpenAI API key provided, skipping LLM validation")
            return chunks
        
        try:
            validated_chunks = []
            
            for chunk in chunks:
                validation_result = self._validate_chunk_coherence(chunk)
                
                if validation_result['is_coherent']:
                    validated_chunks.append(chunk)
                else:
                    # Split incoherent chunks or merge with adjacent chunks
                    if validation_result['should_split']:
                        split_chunks = self._split_chunk(chunk)
                        validated_chunks.extend(split_chunks)
                    else:
                        validated_chunks.append(chunk)
            
            return validated_chunks
            
        except Exception as e:
            print(f"Error validating chunks with LLM: {e}")
            return chunks
    
    def _estimate_page_number(self, chunk_index: int, chunk_size: int, tokens_per_page: float) -> int:
        """
        Estimate page number for a chunk
        """
        estimated_position = chunk_index * chunk_size
        page_number = max(1, round(estimated_position / tokens_per_page))
        return page_number
    
    def _validate_chunk_coherence(self, chunk: Dict) -> Dict:
        """
        Use LLM to validate if a chunk contains coherent information
        """
        try:
            prompt = f"""Analyze the following text chunk and determine if it contains coherent, self-contained information on a single topic.
            
            Chunk content:
            {chunk['content'][:1000]}...
            
            Please respond with a JSON object containing:
            - is_coherent: boolean (true if the chunk is coherent and focused on one topic)
            - should_split: boolean (true if the chunk should be split into smaller chunks)
            - reason: string explaining your assessment
            
            Response:"""
            
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a text analysis assistant. Evaluate text chunks for coherence and topical unity."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.1
            )
            
            # Parse JSON response
            result_text = response.choices[0].message.content.strip()
            result = json.loads(result_text)
            
            return result
            
        except Exception as e:
            print(f"Error validating chunk coherence: {e}")
            return {
                'is_coherent': True,
                'should_split': False,
                'reason': 'Validation failed, keeping original chunk'
            }
    
    def _split_chunk(self, chunk: Dict) -> List[Dict]:
        """
        Split a chunk into smaller, more coherent pieces
        """
        content = chunk['content']
        
        # Split by sentences or paragraphs
        sentences = re.split(r'(?<=[.!?])\s+', content)
        
        # Group sentences into smaller chunks
        sub_chunks = []
        current_sub_chunk = ""
        
        for sentence in sentences:
            if len(current_sub_chunk) + len(sentence) > 300:  # Smaller target for split chunks
                if current_sub_chunk:
                    sub_chunks.append(current_sub_chunk.strip())
                current_sub_chunk = sentence
            else:
                current_sub_chunk += " " + sentence if current_sub_chunk else sentence
        
        if current_sub_chunk:
            sub_chunks.append(current_sub_chunk.strip())
        
        # Create chunk objects
        result_chunks = []
        for i, sub_content in enumerate(sub_chunks):
            result_chunks.append({
                'content': sub_content,
                'page_number': chunk['page_number'],
                'index': chunk['index'] + i * 0.1,  # Maintain order with sub-indexing
                'token_count': len(sub_content.split()),
                'parent_chunk': chunk['index']
            })
        
        return result_chunks


def main():
    """
    Command line interface for chunk creation
    """
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python chunk_creator.py '<text>' <page_count> [--validate]"}))
        sys.exit(1)
    
    text = sys.argv[1]
    page_count = int(sys.argv[2])
    validate = '--validate' in sys.argv
    
    creator = ChunkCreator()
    chunks = creator.create_chunks(text, page_count)
    
    if validate:
        chunks = creator.validate_chunks_with_llm(chunks)
    
    result = {
        "chunks": chunks,
        "chunk_count": len(chunks),
        "validated": validate
    }
    
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
