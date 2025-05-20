import json
import sys
from typing import List, Dict, Optional
from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue,
    SearchRequest, ScoredPoint
)
import os
from dotenv import load_dotenv

load_dotenv()

class QdrantManager:
    """
    Manage Qdrant vector database operations
    """
    
    def __init__(self, 
                 host: str = None, 
                 port: int = None,
                 api_key: str = None,
                 collection_name: str = "quiz_embeddings"):
        """
        Initialize Qdrant client
        
        Args:
            host: Qdrant server host
            port: Qdrant server port
            api_key: API key for Qdrant Cloud
            collection_name: Name of the collection to use
        """
        self.host = host or os.getenv('QDRANT_HOST', 'localhost')
        self.port = port or int(os.getenv('QDRANT_PORT', 6333))
        self.api_key = api_key or os.getenv('QDRANT_API_KEY')
        self.collection_name = collection_name
        
        # Initialize client
        if self.api_key:
            # For Qdrant Cloud
            self.client = QdrantClient(url=f"https://{self.host}", api_key=self.api_key)
        else:
            # For local Qdrant
            self.client = QdrantClient(host=self.host, port=self.port)
        
        self._ensure_collection_exists()
    
    def _ensure_collection_exists(self):
        """
        Create collection if it doesn't exist
        """
        try:
            # Check if collection exists
            collections = self.client.get_collections()
            collection_names = [col.name for col in collections.collections]
            
            if self.collection_name not in collection_names:
                # Create collection with appropriate vector configuration
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=384,  # e5-small produces 384-dimensional vectors
                        distance=Distance.COSINE
                    )
                )
                print(f"Created collection: {self.collection_name}")
            else:
                print(f"Collection already exists: {self.collection_name}")
                
        except Exception as e:
            print(f"Error creating collection: {e}")
            raise
    
    def store_chunks(self, document_id: str, chunks: List[Dict]) -> bool:
        """
        Store chunks with their embeddings in Qdrant
        
        Args:
            document_id: Unique document identifier
            chunks: List of chunks with content and embeddings
            
        Returns:
            Success status
        """
        try:
            points = []
            
            for chunk in chunks:
                if 'embedding' not in chunk:
                    print(f"Warning: Chunk {chunk.get('index', '?')} missing embedding")
                    continue
                
                # Create point for Qdrant
                point = PointStruct(
                    id=f"{document_id}_{chunk['index']}",
                    vector=chunk['embedding'],
                    payload={
                        'document_id': document_id,
                        'content': chunk['content'],
                        'page_number': chunk.get('page_number', 1),
                        'index': chunk['index'],
                        'token_count': chunk.get('token_count', 0)
                    }
                )
                points.append(point)
            
            # Upload points to Qdrant
            if points:
                self.client.upsert(
                    collection_name=self.collection_name,
                    points=points
                )
                print(f"Stored {len(points)} chunks for document {document_id}")
                return True
            else:
                print("No valid chunks to store")
                return False
                
        except Exception as e:
            print(f"Error storing chunks: {e}")
            return False
    
    def search_similar_chunks(self, 
                             query_embedding: List[float], 
                             document_id: Optional[str] = None,
                             top_k: int = 5,
                             score_threshold: float = 0.0) -> List[Dict]:
        """
        Search for similar chunks using vector similarity
        
        Args:
            query_embedding: Query vector embedding
            document_id: Optional document ID to filter results
            top_k: Number of top results to return
            score_threshold: Minimum similarity score
            
        Returns:
            List of similar chunks with metadata
        """
        try:
            # Create search request
            search_filter = None
            if document_id:
                search_filter = Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id)
                        )
                    ]
                )
            
            # Perform search
            search_result = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=search_filter,
                limit=top_k,
                score_threshold=score_threshold
            )
            
            # Format results
            results = []
            for scored_point in search_result:
                results.append({
                    'id': scored_point.id,
                    'score': scored_point.score,
                    'content': scored_point.payload['content'],
                    'page_number': scored_point.payload['page_number'],
                    'document_id': scored_point.payload['document_id'],
                    'index': scored_point.payload['index']
                })
            
            return results
            
        except Exception as e:
            print(f"Error searching chunks: {e}")
            return []
    
    def delete_document_chunks(self, document_id: str) -> bool:
        """
        Delete all chunks for a specific document
        
        Args:
            document_id: Document identifier
            
        Returns:
            Success status
        """
        try:
            # Delete points with matching document_id
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id)
                        )
                    ]
                )
            )
            print(f"Deleted chunks for document {document_id}")
            return True
            
        except Exception as e:
            print(f"Error deleting chunks: {e}")
            return False
    
    def get_collection_info(self) -> Dict:
        """
        Get information about the collection
        
        Returns:
            Collection statistics
        """
        try:
            collection_info = self.client.get_collection(self.collection_name)
            return {
                'name': collection_info.config.params.name,
                'vector_size': collection_info.config.params.vectors.size,
                'distance': collection_info.config.params.vectors.distance,
                'points_count': collection_info.points_count,
                'status': collection_info.status
            }
        except Exception as e:
            print(f"Error getting collection info: {e}")
            return {}


def main():
    """
    Command line interface for Qdrant operations
    """
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: python qdrant_client.py <command> [args]",
            "commands": {
                "search": "python qdrant_client.py search '<query_embedding>' [--doc-id <id>] [--top-k <k>]",
                "info": "python qdrant_client.py info",
                "delete": "python qdrant_client.py delete <document_id>"
            }
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    manager = QdrantManager()
    
    try:
        if command == "search":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Missing query embedding"}))
                sys.exit(1)
            
            query_embedding = json.loads(sys.argv[2])
            document_id = None
            top_k = 5
            
            # Parse optional arguments
            if '--doc-id' in sys.argv:
                doc_id_index = sys.argv.index('--doc-id')
                if doc_id_index + 1 < len(sys.argv):
                    document_id = sys.argv[doc_id_index + 1]
            
            if '--top-k' in sys.argv:
                top_k_index = sys.argv.index('--top-k')
                if top_k_index + 1 < len(sys.argv):
                    top_k = int(sys.argv[top_k_index + 1])
            
            results = manager.search_similar_chunks(query_embedding, document_id, top_k)
            print(json.dumps({"results": results}, indent=2))
            
        elif command == "info":
            info = manager.get_collection_info()
            print(json.dumps(info, indent=2))
            
        elif command == "delete":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Missing document ID"}))
                sys.exit(1)
            
            document_id = sys.argv[2]
            success = manager.delete_document_chunks(document_id)
            print(json.dumps({"success": success}))
            
        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
