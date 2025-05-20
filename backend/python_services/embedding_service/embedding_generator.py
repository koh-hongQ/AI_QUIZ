import json
import sys
import numpy as np
from typing import List, Dict, Union
from sentence_transformers import SentenceTransformer
import os
import torch

class EmbeddingGenerator:
    """
    Generate embeddings using e5-small model
    """
    
    def __init__(self, model_name: str = 'intfloat/e5-small-v2'):
        """
        Initialize embedding generator with e5-small model
        
        Args:
            model_name: HuggingFace model name for embeddings
        """
        self.model_name = model_name
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """
        Load the sentence transformer model
        """
        try:
            # Check if CUDA is available
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
            
            self.model = SentenceTransformer(self.model_name)
            self.model.to(device)
            
            print(f"Loaded model {self.model_name} on {device}")
            
        except Exception as e:
            print(f"Error loading model: {e}")
            raise
    
    def generate_embedding(self, text: str, prefix_type: str = 'passage') -> List[float]:
        """
        Generate embedding for a single text
        
        Args:
            text: Text to embed
            prefix_type: Type of text ('passage' for documents, 'query' for search queries)
            
        Returns:
            Embedding vector as list of floats
        """
        # Add appropriate prefix for e5 models
        prefixed_text = self._add_prefix(text, prefix_type)
        
        # Generate embedding
        embedding = self.model.encode(prefixed_text, normalize_embeddings=True)
        
        # Convert to list for JSON serialization
        return embedding.tolist()
    
    def generate_batch_embeddings(self, texts: List[str], prefix_type: str = 'passage') -> List[List[float]]:
        """
        Generate embeddings for multiple texts in batch
        
        Args:
            texts: List of texts to embed
            prefix_type: Type of text ('passage' for documents, 'query' for search queries)
            
        Returns:
            List of embedding vectors
        """
        # Add prefixes to all texts
        prefixed_texts = [self._add_prefix(text, prefix_type) for text in texts]
        
        # Generate embeddings in batch
        embeddings = self.model.encode(prefixed_texts, normalize_embeddings=True)
        
        # Convert to list of lists
        return embeddings.tolist()
    
    def _add_prefix(self, text: str, prefix_type: str) -> str:
        """
        Add appropriate prefix for e5 models
        
        Args:
            text: Original text
            prefix_type: 'passage' or 'query'
            
        Returns:
            Text with appropriate prefix
        """
        if prefix_type == 'passage':
            return f"passage: {text}"
        elif prefix_type == 'query':
            return f"query: {text}"
        else:
            # Default to passage if unknown type
            return f"passage: {text}"
    
    def get_embedding_dimension(self) -> int:
        """
        Get the dimension of the embedding vectors
        
        Returns:
            Embedding dimension (768 for e5-small)
        """
        # Generate a dummy embedding to get the dimension
        dummy_embedding = self.generate_embedding("test")
        return len(dummy_embedding)


def main():
    """
    Command line interface for embedding generation
    """
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python embedding_generator.py '<text>' [--type query|passage]"}))
        sys.exit(1)
    
    text = sys.argv[1]
    
    # Parse type argument
    prefix_type = 'passage'
    if '--type' in sys.argv:
        type_index = sys.argv.index('--type')
        if type_index + 1 < len(sys.argv):
            prefix_type = sys.argv[type_index + 1]
    
    try:
        generator = EmbeddingGenerator()
        embedding = generator.generate_embedding(text, prefix_type)
        
        result = {
            "embedding": embedding,
            "dimension": len(embedding),
            "text": text,
            "type": prefix_type
        }
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
