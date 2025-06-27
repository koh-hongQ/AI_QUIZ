"""
BM25 Indexer Module
Creates and manages BM25 index for sparse retrieval
"""

import json
import pickle
from pathlib import Path
from typing import List, Dict, Any, Optional
from rank_bm25 import BM25Okapi
from konlpy.tag import Okt
from tqdm import tqdm


class BM25Indexer:
    """Creates and manages BM25 index for Korean text"""
    
    def __init__(self, 
                 stopwords_path: str = "./stopwords-ko.txt",
                 tokenizer_type: str = "okt"):
        """
        Initialize BM25 indexer
        
        Args:
            stopwords_path: Path to Korean stopwords file
            tokenizer_type: Type of tokenizer to use
        """
        self.tokenizer_type = tokenizer_type
        self.tokenizer = Okt()
        
        # Load stopwords
        self.stopwords = self._load_stopwords(stopwords_path)
        
        # BM25 components
        self.bm25 = None
        self.corpus_tokens = []
        self.chunk_mapping = {}  # chunk_id -> index mapping
    
    def _load_stopwords(self, filepath: str) -> set:
        """Load Korean stopwords"""
        if Path(filepath).exists():
            with open(filepath, 'r', encoding='utf-8') as f:
                return set([line.strip() for line in f if line.strip()])
        else:
            print(f"⚠️  Stopwords file not found: {filepath}")
            return set()
    
    def tokenize(self, text: str) -> List[str]:
        """
        Tokenize Korean text
        
        Args:
            text: Text to tokenize
            
        Returns:
            List of tokens
        """
        # Extract nouns
        tokens = self.tokenizer.nouns(text)
        
        # Filter stopwords and short tokens
        tokens = [
            token for token in tokens 
            if token not in self.stopwords and len(token) > 1
        ]
        
        return tokens
    
    def create_index_from_json(self, 
                              input_path: str,
                              output_path: str = "bm25_index.json") -> Dict[str, Any]:
        """
        Create BM25 index from augmented report JSON
        
        Args:
            input_path: Path to the augmented report JSON
            output_path: Path to save the BM25 index
            
        Returns:
            Index statistics
        """
        print(f"Creating BM25 index from: {input_path}")
        
        # Load data
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Handle both 'pages' and 'reclassified_pages' keys
        pages_key = 'pages' if 'pages' in data else 'reclassified_pages'
        pages = data.get(pages_key, [])
        
        # Prepare corpus
        all_chunks = []
        self.corpus_tokens = []
        self.chunk_mapping = {}
        
        print(f"Processing {len(pages)} pages...")
        
        # Process each page
        chunk_idx = 0
        for page in tqdm(pages, desc="Tokenizing chunks"):
            page_num = page["page"]
            title = page["title"]
            body = page.get("body", "")
            others = page.get("others", [])
            
            # Process title as a chunk
            if title:
                chunk_id = f"{page_num}_-1"
                title_tokens = self.tokenize(title)
                
                all_chunks.append({
                    "id": chunk_id,
                    "page": page_num,
                    "title": title,
                    "text": title,
                    "chunk_index": -1,
                    "is_title": True,
                    "tokens": title_tokens,
                    "others": others
                })
                
                self.corpus_tokens.append(title_tokens)
                self.chunk_mapping[chunk_id] = chunk_idx
                chunk_idx += 1
            
            # Split body into segments (same as dense embeddings)
            import re
            segments = re.split(r'(?<=[.!?])\s+|\n\n+', body.strip())
            segments = [seg.strip() for seg in segments if seg.strip() and len(seg.strip()) >= 10]
            
            # Process each segment
            for i, segment in enumerate(segments):
                chunk_id = f"{page_num}_{i}"
                segment_tokens = self.tokenize(segment)
                
                all_chunks.append({
                    "id": chunk_id,
                    "page": page_num,
                    "title": title,
                    "text": segment,
                    "chunk_index": i,
                    "is_title": False,
                    "tokens": segment_tokens,
                    "others": others
                })
                
                self.corpus_tokens.append(segment_tokens)
                self.chunk_mapping[chunk_id] = chunk_idx
                chunk_idx += 1
        
        # Create BM25 index
        print("\nBuilding BM25 index...")
        self.bm25 = BM25Okapi(self.corpus_tokens)
        
        # Prepare output data
        output_data = {
            "total_chunks": len(all_chunks),
            "chunks": all_chunks,
            "chunk_mapping": self.chunk_mapping,
            "tokenizer": self.tokenizer_type,
            "stats": {
                "total_pages": len(pages),
                "total_chunks": len(all_chunks),
                "avg_tokens_per_chunk": sum(len(tokens) for tokens in self.corpus_tokens) / len(self.corpus_tokens) if self.corpus_tokens else 0
            }
        }
        
        # Save index
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        # Save BM25 model separately (pickle)
        bm25_model_path = output_path.replace('.json', '_model.pkl')
        with open(bm25_model_path, 'wb') as f:
            pickle.dump(self.bm25, f)
        
        print(f"\n✓ BM25 index created successfully!")
        print(f"  - Total chunks: {len(all_chunks)}")
        print(f"  - Index saved to: {output_path}")
        print(f"  - Model saved to: {bm25_model_path}")
        
        return output_data
    
    def load_index(self, index_path: str = "bm25_index.json"):
        """Load existing BM25 index"""
        # Load index data
        with open(index_path, 'r', encoding='utf-8') as f:
            index_data = json.load(f)
        
        # Load BM25 model
        model_path = index_path.replace('.json', '_model.pkl')
        with open(model_path, 'rb') as f:
            self.bm25 = pickle.load(f)
        
        # Restore corpus tokens
        self.corpus_tokens = [chunk["tokens"] for chunk in index_data["chunks"]]
        self.chunk_mapping = index_data["chunk_mapping"]
        
        return index_data
    
    def search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Search using BM25
        
        Args:
            query: Search query
            top_k: Number of results to return
            
        Returns:
            List of search results
        """
        if not self.bm25:
            raise ValueError("BM25 index not loaded. Call load_index() first.")
        
        # Tokenize query
        query_tokens = self.tokenize(query)
        
        # Get BM25 scores
        scores = self.bm25.get_scores(query_tokens)
        
        # Get top k indices
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
        
        # Build results
        results = []
        for idx in top_indices:
            if scores[idx] > 0:  # Only include non-zero scores
                # Find chunk by index
                chunk_id = None
                for cid, cidx in self.chunk_mapping.items():
                    if cidx == idx:
                        chunk_id = cid
                        break
                
                if chunk_id:
                    results.append({
                        "chunk_id": chunk_id,
                        "score": float(scores[idx]),
                        "rank": len(results) + 1
                    })
        
        return results


def create_bm25_index(input_json: str = "final_augmented_report.json",
                     output_json: str = "bm25_index.json") -> Dict[str, Any]:
    """
    Convenience function to create BM25 index
    
    Args:
        input_json: Path to input JSON file
        output_json: Path to output JSON file
        
    Returns:
        Index statistics
    """
    indexer = BM25Indexer()
    return indexer.create_index_from_json(input_json, output_json)


if __name__ == "__main__":
    # Example usage
    result = create_bm25_index(
        input_json="final_augmented_report.json",
        output_json="bm25_index.json"
    )
    print(f"\nCreated BM25 index with {result['total_chunks']} chunks")