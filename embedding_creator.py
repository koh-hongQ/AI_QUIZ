"""
Embedding Creator Module
Creates dense embeddings from text data using sentence transformers
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import numpy as np


class EmbeddingCreator:
    """Creates and manages dense embeddings for text chunks"""
    
    def __init__(self, model_name: str = "jhgan/ko-sroberta-multitask"):
        """
        Initialize the embedding creator
        
        Args:
            model_name: Name of the sentence transformer model
        """
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        self.model.max_seq_length = 512
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        
    def split_text(self, text: str, min_length: int = 10) -> List[str]:
        """
        Split text into sentences
        
        Args:
            text: Text to split
            min_length: Minimum length for a valid segment
            
        Returns:
            List of text segments
        """
        # Split by sentence endings and paragraph breaks
        segments = re.split(r'(?<=[.!?])\s+|\n\n+', text.strip())
        
        # Filter out too short segments
        segments = [seg.strip() for seg in segments 
                   if seg.strip() and len(seg.strip()) >= min_length]
        
        return segments
    
    def create_embeddings_from_json(self, 
                                   input_path: str,
                                   output_path: str = "dense_index.json",
                                   batch_size: int = 32) -> Dict[str, Any]:
        """
        Create embeddings from augmented report JSON
        
        Args:
            input_path: Path to the augmented report JSON
            output_path: Path to save the embeddings
            batch_size: Batch size for encoding
            
        Returns:
            Dictionary containing embedding data and metadata
        """
        print(f"Creating embeddings from: {input_path}")
        
        # Load data
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Prepare chunks
        dense_chunks = []
        all_texts = []
        chunk_metadata = []
        
        # Handle both 'pages' and 'reclassified_pages' keys
        pages_key = 'pages' if 'pages' in data else 'reclassified_pages'
        pages = data.get(pages_key, [])
        
        print(f"Processing {len(pages)} pages...")
        
        # Stage 1: Prepare texts and metadata
        for page in tqdm(pages, desc="Preparing chunks"):
            page_num = page["page"]
            title = page["title"]
            others = page.get("others", [])
            body_raw = page.get("body", "")
            
            # Add title as a chunk
            if title:
                all_texts.append(title)
                chunk_metadata.append({
                    "page": page_num,
                    "title": title,
                    "chunk_index": -1,  # Special index for title
                    "is_title": True,
                    "others": others
                })
            
            # Split body into segments
            segments = self.split_text(body_raw)
            
            for i, segment in enumerate(segments):
                all_texts.append(segment)
                chunk_metadata.append({
                    "page": page_num,
                    "title": title,
                    "chunk_index": i,
                    "is_title": False,
                    "others": others
                })
        
        # Stage 2: Create embeddings
        print(f"\nCreating {len(all_texts)} embeddings...")
        embeddings = self.model.encode(
            all_texts,
            batch_size=batch_size,
            show_progress_bar=True,
            normalize_embeddings=True
        )
        
        # Stage 3: Compile final data
        for idx, (text, embedding, metadata) in enumerate(
            zip(all_texts, embeddings, chunk_metadata)
        ):
            chunk_id = f"{metadata['page']}_{metadata['chunk_index']}"
            
            dense_chunks.append({
                "id": chunk_id,
                "page": metadata["page"],
                "title": metadata["title"],
                "chunk_index": metadata["chunk_index"],
                "text": text,
                "embedding": embedding.tolist(),
                "is_title": metadata.get("is_title", False),
                "others": metadata["others"]
            })
        
        # Prepare output data
        output_data = {
            "model_name": self.model_name,
            "embedding_dim": self.embedding_dim,
            "total_chunks": len(dense_chunks),
            "chunks": dense_chunks
        }
        
        # Save to file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        # Save embeddings as numpy array for faster loading
        embeddings_array = np.array([chunk["embedding"] for chunk in dense_chunks])
        np.save(output_path.replace('.json', '_vectors.npy'), embeddings_array)
        
        print(f"\n✓ Embeddings created successfully!")
        print(f"  - Total chunks: {len(dense_chunks)}")
        print(f"  - Embedding dimension: {self.embedding_dim}")
        print(f"  - Saved to: {output_path}")
        print(f"  - Vectors saved to: {output_path.replace('.json', '_vectors.npy')}")
        
        return output_data


def create_embeddings(input_json: str = "final_augmented_report.json",
                     output_json: str = "dense_index.json",
                     model_name: str = "jhgan/ko-sroberta-multitask") -> Dict[str, Any]:
    """
    Convenience function to create embeddings
    
    Args:
        input_json: Path to input JSON file
        output_json: Path to output JSON file
        model_name: Name of the embedding model
        
    Returns:
        Embedding data dictionary
    """
    creator = EmbeddingCreator(model_name)
    return creator.create_embeddings_from_json(input_json, output_json)


if __name__ == "__main__":
    result = create_embeddings(
        input_json="final_augmented_report.json",
        output_json="dense_index.json"
    )
    print(f"\nCreated {result['total_chunks']} embeddings")

    