"""
Qdrant Manager Module
Handles all Qdrant vector database operations
"""

import json
from typing import List, Dict, Any, Optional
from pathlib import Path
import numpy as np

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct


class QdrantManager:
    """Manages Qdrant vector database operations"""
    
    def __init__(self, 
                 host: str = "localhost",
                 port: int = 6333,
                 collection_name: str = "pdf_analysis",
                 embedding_dim: Optional[int] = None):
        """
        Initialize Qdrant manager
        
        Args:
            host: Qdrant server host
            port: Qdrant server port
            collection_name: Name of the collection
            embedding_dim: Dimension of embeddings (auto-detected if None)
        """
        self.host = host
        self.port = port
        self.collection_name = collection_name
        self.embedding_dim = embedding_dim
        self.client = None
        self.is_connected = False
        
        # Try to connect
        self._connect()
    
    def _connect(self) -> bool:
        """
        Try to connect to Qdrant server
        
        Returns:
            True if connected, False otherwise
        """
        try:
            self.client = QdrantClient(host=self.host, port=self.port)
            # Test connection
            self.client.get_collections()
            self.is_connected = True
            print(f"✓ Connected to Qdrant at {self.host}:{self.port}")
            return True
        except Exception as e:
            print(f"⚠️  Could not connect to Qdrant: {e}")
            print("   Qdrant operations will be skipped.")
            self.is_connected = False
            return False
    
    def create_collection(self, embedding_dim: int, recreate: bool = False) -> bool:
        """
        Create or recreate collection
        
        Args:
            embedding_dim: Dimension of embeddings
            recreate: Whether to recreate if exists
            
        Returns:
            True if successful
        """
        if not self.is_connected:
            return False
        
        try:
            collections = self.client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)
            
            if exists and recreate:
                self.client.delete_collection(self.collection_name)
                print(f"✓ Deleted existing collection: {self.collection_name}")
                exists = False
            
            if not exists:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=embedding_dim,
                        distance=Distance.COSINE
                    )
                )
                print(f"✓ Created collection: {self.collection_name}")
            else:
                print(f"✓ Using existing collection: {self.collection_name}")
            
            self.embedding_dim = embedding_dim
            return True
            
        except Exception as e:
            print(f"❌ Error managing collection: {e}")
            return False
    
    def upload_embeddings(self, 
                         dense_index_path: str = "dense_index.json",
                         batch_size: int = 100) -> bool:
        """
        Upload embeddings from dense index file to Qdrant
        
        Args:
            dense_index_path: Path to dense index JSON file
            batch_size: Batch size for uploading
            
        Returns:
            True if successful
        """
        if not self.is_connected:
            print("⚠️  Skipping Qdrant upload (not connected)")
            return False
        
        print(f"\nUploading embeddings to Qdrant...")
        
        try:
            # Load dense index
            with open(dense_index_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            chunks = data['chunks']
            embedding_dim = data['embedding_dim']
            
            # Create/verify collection
            if not self.create_collection(embedding_dim, recreate=True):
                return False
            
            # Prepare points
            points = []
            for idx, chunk in enumerate(chunks):
                point = PointStruct(
                    id=idx,
                    vector=chunk["embedding"],
                    payload={
                        "chunk_id": chunk["id"],
                        "page": chunk["page"],
                        "title": chunk["title"],
                        "text": chunk["text"],
                        "chunk_index": chunk["chunk_index"],
                        "is_title": chunk.get("is_title", False),
                        "others": chunk.get("others", [])
                    }
                )
                points.append(point)
            
            # Upload in batches
            total_uploaded = 0
            for i in range(0, len(points), batch_size):
                batch = points[i:i + batch_size]
                self.client.upsert(
                    collection_name=self.collection_name,
                    points=batch
                )
                total_uploaded += len(batch)
                print(f"  Uploaded {total_uploaded}/{len(points)} vectors...")
            
            print(f"✓ Successfully uploaded {len(points)} vectors to Qdrant")
            return True
            
        except Exception as e:
            print(f"❌ Error uploading to Qdrant: {e}")
            return False
    
    def get_collection_info(self) -> Optional[Dict[str, Any]]:
        """
        Get collection information
        
        Returns:
            Collection info dictionary or None
        """
        if not self.is_connected:
            return None
        
        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "name": self.collection_name,
                "vector_count": info.vectors_count,
                "embedding_dim": info.config.params.vectors.size,
                "status": info.status
            }
        except Exception as e:
            print(f"❌ Error getting collection info: {e}")
            return None
    
    def search(self, 
               query_vector: List[float], 
               top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Search for similar vectors
        
        Args:
            query_vector: Query embedding vector
            top_k: Number of results to return
            
        Returns:
            List of search results
        """
        if not self.is_connected:
            return []
        
        try:
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                limit=top_k
            )
            
            return [{
                "score": hit.score,
                "payload": hit.payload
            } for hit in results]
            
        except Exception as e:
            print(f"❌ Error searching: {e}")
            return []


def upload_to_qdrant(dense_index_path: str = "dense_index.json",
                    host: str = "localhost",
                    port: int = 6333,
                    collection_name: str = "pdf_analysis") -> bool:
    """
    Convenience function to upload embeddings to Qdrant
    
    Args:
        dense_index_path: Path to dense index file
        host: Qdrant host
        port: Qdrant port
        collection_name: Collection name
        
    Returns:
        True if successful
    """
    manager = QdrantManager(host, port, collection_name)
    return manager.upload_embeddings(dense_index_path)


if __name__ == "__main__":
    # Example usage
    manager = QdrantManager()
    
    if manager.is_connected:
        # Upload embeddings
        success = manager.upload_embeddings("dense_index.json")
        
        if success:
            # Get collection info
            info = manager.get_collection_info()
            print(f"\nCollection info: {info}")
    else:
        print("Qdrant is not running. Please start Qdrant server.")