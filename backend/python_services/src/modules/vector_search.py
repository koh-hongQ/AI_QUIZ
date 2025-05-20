import numpy as np
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct, Filter, FieldCondition, MatchValue
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict
import hashlib
import time

from ..config import config
from ..logger import logger
from .text_processor import TextChunk


@dataclass
class EmbeddingResult:
    """Result of embedding generation"""
    vector: List[float]
    dimension: int
    model_name: str
    processing_time: float


@dataclass
class SearchResult:
    """Result of vector search"""
    chunk: TextChunk
    score: float
    id: str


class EmbeddingService:
    """Service for generating embeddings using e5-small-v2 model"""
    
    def __init__(self):
        logger.info(f"Loading embedding model: {config.EMBEDDING_MODEL}")
        self.model = SentenceTransformer(config.EMBEDDING_MODEL)
        self.model_name = config.EMBEDDING_MODEL
        self.dimension = self.model.get_sentence_embedding_dimension()
        logger.info(f"Embedding model loaded. Dimension: {self.dimension}")
    
    async def generate_embedding(self, text: str, prefix: str = "passage") -> EmbeddingResult:
        """
        Generate embedding for text using e5-small-v2
        
        Args:
            text: Text to embed
            prefix: Prefix for e5 model ("passage" or "query")
            
        Returns:
            EmbeddingResult containing the vector and metadata
        """
        try:
            start_time = time.time()
            
            # Add required prefix for e5 models
            prefixed_text = f"{prefix}: {text}"
            
            # Generate embedding
            embedding = self.model.encode(prefixed_text)
            
            # Convert to list for JSON serialization
            vector = embedding.tolist()
            
            processing_time = time.time() - start_time
            
            result = EmbeddingResult(
                vector=vector,
                dimension=len(vector),
                model_name=self.model_name,
                processing_time=processing_time
            )
            
            logger.debug(f"Generated embedding for text length {len(text)} in {processing_time:.3f}s")
            return result
            
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            raise
    
    async def generate_batch_embeddings(self, texts: List[str], prefix: str = "passage") -> List[EmbeddingResult]:
        """
        Generate embeddings for multiple texts in batch
        
        Args:
            texts: List of texts to embed
            prefix: Prefix for e5 model
            
        Returns:
            List of EmbeddingResult objects
        """
        try:
            start_time = time.time()
            
            # Add prefixes
            prefixed_texts = [f"{prefix}: {text}" for text in texts]
            
            # Generate embeddings in batch
            embeddings = self.model.encode(prefixed_texts, show_progress_bar=True)
            
            # Convert to results
            results = []
            for i, embedding in enumerate(embeddings):
                result = EmbeddingResult(
                    vector=embedding.tolist(),
                    dimension=len(embedding),
                    model_name=self.model_name,
                    processing_time=0  # Individual time not measured in batch
                )
                results.append(result)
            
            total_time = time.time() - start_time
            avg_time = total_time / len(texts)
            
            logger.info(f"Generated {len(texts)} embeddings in {total_time:.3f}s (avg: {avg_time:.3f}s/text)")
            return results
            
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {str(e)}")
            raise


class VectorSearchService:
    """Service for storing and searching vectors using Qdrant"""
    
    def __init__(self):
        self.client = QdrantClient(
            host=config.QDRANT_HOST,
            port=config.QDRANT_PORT,
            api_key=config.QDRANT_API_KEY
        )
        self.embedding_service = EmbeddingService()
        logger.info(f"Connected to Qdrant at {config.QDRANT_HOST}:{config.QDRANT_PORT}")
    
    async def create_collection(self, collection_name: str, force_recreate: bool = False) -> bool:
        """
        Create a collection in Qdrant
        
        Args:
            collection_name: Name of the collection
            force_recreate: Whether to recreate if exists
            
        Returns:
            True if successful
        """
        try:
            # Check if collection exists
            collections = self.client.get_collections().collections
            collection_exists = any(col.name == collection_name for col in collections)
            
            if collection_exists:
                if force_recreate:
                    logger.info(f"Deleting existing collection: {collection_name}")
                    self.client.delete_collection(collection_name)
                else:
                    logger.info(f"Collection {collection_name} already exists")
                    return True
            
            # Create collection
            logger.info(f"Creating collection: {collection_name}")
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=self.embedding_service.dimension,
                    distance=Distance.COSINE
                )
            )
            
            logger.info(f"Collection {collection_name} created successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error creating collection {collection_name}: {str(e)}")
            raise
    
    async def store_chunk_embeddings(self, 
                                   document_id: str, 
                                   chunks: List[TextChunk], 
                                   collection_name: Optional[str] = None) -> bool:
        """
        Store chunk embeddings in Qdrant
        
        Args:
            document_id: Unique identifier for the document
            chunks: List of text chunks to store
            collection_name: Collection name (defaults to document_id)
            
        Returns:
            True if successful
        """
        try:
            if not collection_name:
                collection_name = f"doc_{document_id}"
            
            # Create collection if not exists
            await self.create_collection(collection_name)
            
            logger.info(f"Storing {len(chunks)} chunks for document {document_id}")
            
            # Generate embeddings for all chunks
            chunk_texts = [chunk.content for chunk in chunks]
            embeddings = await self.embedding_service.generate_batch_embeddings(chunk_texts)
            
            # Prepare points for insertion
            points = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                # Generate unique ID for the chunk
                chunk_id = self._generate_chunk_id(document_id, chunk.index)
                
                # Prepare payload
                payload = {
                    'document_id': document_id,
                    'chunk_index': chunk.index,
                    'content': chunk.content,
                    'page_number': chunk.page_number,
                    'char_start': chunk.char_start,
                    'char_end': chunk.char_end,
                    'token_count': chunk.token_count,
                    'metadata': chunk.metadata or {}
                }
                
                # Create point
                point = PointStruct(
                    id=chunk_id,
                    vector=embedding.vector,
                    payload=payload
                )
                points.append(point)
            
            # Insert points in batches
            batch_size = 100
            for i in range(0, len(points), batch_size):
                batch = points[i:i + batch_size]
                self.client.upsert(
                    collection_name=collection_name,
                    points=batch
                )
                logger.debug(f"Inserted batch {i//batch_size + 1}/{(len(points)-1)//batch_size + 1}")
            
            logger.info(f"Successfully stored {len(points)} chunks for document {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing chunk embeddings: {str(e)}")
            raise
    
    async def search_similar_chunks(self, 
                                  query: str, 
                                  document_id: str,
                                  top_k: int = 5,
                                  score_threshold: float = 0.5,
                                  collection_name: Optional[str] = None) -> List[SearchResult]:
        """
        Search for similar chunks using vector similarity
        
        Args:
            query: Search query
            document_id: Document ID to search within
            top_k: Number of results to return
            score_threshold: Minimum similarity score
            collection_name: Collection name (defaults to document_id)
            
        Returns:
            List of SearchResult objects
        """
        try:
            if not collection_name:
                collection_name = f"doc_{document_id}"
            
            logger.info(f"Searching for similar chunks: '{query}' in {collection_name}")
            
            # Generate query embedding
            query_embedding = await self.embedding_service.generate_embedding(query, prefix="query")
            
            # Prepare filter for document
            document_filter = Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(value=document_id)
                    )
                ]
            )
            
            # Search
            search_result = self.client.search(
                collection_name=collection_name,
                query_vector=query_embedding.vector,
                query_filter=document_filter,
                limit=top_k,
                score_threshold=score_threshold
            )
            
            # Convert results
            results = []
            for point in search_result:
                chunk = TextChunk(
                    content=point.payload['content'],
                    index=point.payload['chunk_index'],
                    page_number=point.payload.get('page_number'),
                    char_start=point.payload.get('char_start'),
                    char_end=point.payload.get('char_end'),
                    token_count=point.payload.get('token_count'),
                    metadata=point.payload.get('metadata')
                )
                
                search_result = SearchResult(
                    chunk=chunk,
                    score=point.score,
                    id=str(point.id)
                )
                results.append(search_result)
            
            logger.info(f"Found {len(results)} similar chunks")
            return results
            
        except Exception as e:
            logger.error(f"Error searching chunks: {str(e)}")
            raise
    
    async def delete_document_chunks(self, document_id: str, collection_name: Optional[str] = None) -> bool:
        """
        Delete all chunks for a document
        
        Args:
            document_id: Document ID
            collection_name: Collection name
            
        Returns:
            True if successful
        """
        try:
            if not collection_name:
                collection_name = f"doc_{document_id}"
            
            logger.info(f"Deleting chunks for document {document_id}")
            
            # Delete points with document_id filter
            self.client.delete(
                collection_name=collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id)
                        )
                    ]
                )
            )
            
            logger.info(f"Deleted chunks for document {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting document chunks: {str(e)}")
            raise
    
    def _generate_chunk_id(self, document_id: str, chunk_index: int) -> str:
        """Generate unique ID for a chunk"""
        combined = f"{document_id}_chunk_{chunk_index}"
        return hashlib.sha256(combined.encode()).hexdigest()[:16]


# Global service instances
embedding_service = EmbeddingService()
vector_search_service = VectorSearchService()
