"""
Hybrid Searcher Module
Combines BM25 (sparse) and Dense retrieval with normalized linear combination
"""

import json
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


from bm25_indexer import BM25Indexer
from qdrant_manager import QdrantManager

class HybridSearcher:
    """Hybrid search combining BM25 and Dense retrieval"""
    
    def __init__(self,
                 bm25_index_path: str = "bm25_index.json",
                 dense_index_path: str = "dense_index.json",
                 embedding_model: str = "jhgan/ko-sroberta-multitask",
                 use_qdrant: bool = True,
                 alpha: float = 0.5):
        """
        Initialize hybrid searcher
        
        Args:
            bm25_index_path: Path to BM25 index
            dense_index_path: Path to dense index
            embedding_model: Name of the embedding model
            use_qdrant: Whether to use Qdrant for dense search
            alpha: Weight for BM25 (0-1, higher = more BM25)
        """
        self.alpha = alpha
        
        # Initialize BM25 searcher
        print("Loading BM25 index...")
        self.bm25_indexer = BM25Indexer()
        self.bm25_data = self.bm25_indexer.load_index(bm25_index_path)
        
        # Initialize Dense searcher
        print("Loading Dense index...")
        self.embedding_model = SentenceTransformer(embedding_model)
        self.use_qdrant = use_qdrant
        
        if use_qdrant:
            self.qdrant_manager = QdrantManager()
            if not self.qdrant_manager.is_connected:
                print("⚠️  Qdrant not available, falling back to local search")
                self.use_qdrant = False
                self._load_local_dense_index(dense_index_path)
        else:
            self._load_local_dense_index(dense_index_path)
        
        # Load chunk information for merging results
        self.chunks_info = self._load_chunks_info()
        
    def _load_local_dense_index(self, dense_index_path: str):
        """Load local dense index"""
        with open(dense_index_path, 'r', encoding='utf-8') as f:
            self.dense_data = json.load(f)
        
        # Load embeddings
        vectors_path = dense_index_path.replace('.json', '_vectors.npy')
        if Path(vectors_path).exists():
            self.dense_embeddings = np.load(vectors_path)
        else:
            self.dense_embeddings = np.array([
                chunk["embedding"] for chunk in self.dense_data["chunks"]
            ])
    
    def _load_chunks_info(self) -> Dict[str, Dict[str, Any]]:
        """Load complete chunk information from both indices"""
        chunks_info = {}
        
        # From BM25 index
        for chunk in self.bm25_data["chunks"]:
            chunk_id = chunk["id"]
            chunks_info[chunk_id] = {
                "id": chunk_id,
                "page": chunk["page"],
                "title": chunk["title"],
                "text": chunk["text"],
                "chunk_index": chunk["chunk_index"],
                "is_title": chunk.get("is_title", False),
                "others": chunk.get("others", [])
            }
        
        return chunks_info
    
    def search_bm25(self, query: str, top_k: int = 20) -> List[Dict[str, Any]]:
        """Search using BM25"""
        results = self.bm25_indexer.search(query, top_k)
        
        # Add chunk information
        for result in results:
            chunk_info = self.chunks_info.get(result["chunk_id"], {})
            result.update(chunk_info)
        
        return results
    
    def search_dense(self, query: str, top_k: int = 20) -> List[Dict[str, Any]]:
        """Search using dense embeddings"""
        # Create query embedding
        query_embedding = self.embedding_model.encode([query])[0]
        
        if self.use_qdrant:
            # Qdrant search
            results = self.qdrant_manager.search(query_embedding.tolist(), top_k)
            return [{
                "chunk_id": r["payload"]["chunk_id"],
                "score": r["score"],
                "rank": i + 1,
                **self.chunks_info.get(r["payload"]["chunk_id"], {})
            } for i, r in enumerate(results)]
        else:
            # Local search
            similarities = cosine_similarity([query_embedding], self.dense_embeddings)[0]
            top_indices = np.argsort(similarities)[::-1][:top_k]
            
            results = []
            for rank, idx in enumerate(top_indices):
                chunk = self.dense_data["chunks"][idx]
                results.append({
                    "chunk_id": chunk["id"],
                    "score": float(similarities[idx]),
                    "rank": rank + 1,
                    **self.chunks_info.get(chunk["id"], {})
                })
            
            return results
    
    def normalize_scores(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize scores to 0-1 range"""
        if not results:
            return results
        
        scores = [r["score"] for r in results]
        min_score = min(scores)
        max_score = max(scores)
        
        # Avoid division by zero
        if max_score == min_score:
            for r in results:
                r["normalized_score"] = 1.0
        else:
            for r in results:
                r["normalized_score"] = (r["score"] - min_score) / (max_score - min_score)
        
        return results
    
    def hybrid_search(self, 
                     query: str, 
                     top_k: int = 10,
                     alpha: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Perform hybrid search with normalized linear combination
        
        Args:
            query: Search query
            top_k: Number of results to return
            alpha: Weight for BM25 (overrides default if provided)
            
        Returns:
            Combined search results
        """
        if alpha is None:
            alpha = self.alpha
        
        # Get results from both methods
        bm25_results = self.search_bm25(query, top_k=top_k*2)
        dense_results = self.search_dense(query, top_k=top_k*2)
        
        # Normalize scores
        bm25_results = self.normalize_scores(bm25_results)
        dense_results = self.normalize_scores(dense_results)
        
        # Create lookup dictionaries
        bm25_scores = {r["chunk_id"]: r["normalized_score"] for r in bm25_results}
        dense_scores = {r["chunk_id"]: r["normalized_score"] for r in dense_results}
        
        # Combine scores
        all_chunk_ids = set(bm25_scores.keys()) | set(dense_scores.keys())
        combined_results = []
        
        for chunk_id in all_chunk_ids:
            # Get normalized scores (0 if not found)
            bm25_norm = bm25_scores.get(chunk_id, 0.0)
            dense_norm = dense_scores.get(chunk_id, 0.0)
            
            # Calculate combined score
            combined_score = alpha * bm25_norm + (1 - alpha) * dense_norm
            
            # Get chunk info
            chunk_info = self.chunks_info.get(chunk_id, {})
            
            combined_results.append({
                "chunk_id": chunk_id,
                "combined_score": combined_score,
                "bm25_score": bm25_norm,
                "dense_score": dense_norm,
                "page": chunk_info.get("page"),
                "title": chunk_info.get("title"),
                "text": chunk_info.get("text"),
                "is_title": chunk_info.get("is_title", False)
            })
        
        # Sort by combined score
        combined_results.sort(key=lambda x: x["combined_score"], reverse=True)
        
        return combined_results[:top_k]
    
    def adaptive_search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Adaptive hybrid search that adjusts alpha based on query characteristics
        
        Args:
            query: Search query
            top_k: Number of results
            
        Returns:
            Search results with adaptive weighting
        """
        # Analyze query
        words = query.split()
        word_count = len(words)
        
        # Adjust alpha based on query length
        if word_count <= 2:
            # Short query - favor BM25
            alpha = 0.7
            search_type = "keyword-focused"
        elif word_count >= 5:
            # Long query - favor dense
            alpha = 0.3
            search_type = "semantic-focused"
        else:
            # Medium query - balanced
            alpha = 0.5
            search_type = "balanced"
        
        if self.verbose:
            print(f"Query type: {search_type} (alpha={alpha})")
        
        # Perform search
        results = self.hybrid_search(query, top_k, alpha)
        
        # Add search metadata
        for r in results:
            r["search_type"] = search_type
            r["alpha_used"] = alpha
        
        return results
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get search index statistics"""
        stats = {
            "bm25": {
                "total_chunks": self.bm25_data["stats"]["total_chunks"],
                "avg_tokens_per_chunk": self.bm25_data["stats"]["avg_tokens_per_chunk"]
            },
            "dense": {
                "total_chunks": len(self.dense_data["chunks"]) if hasattr(self, 'dense_data') else "N/A",
                "embedding_dim": self.dense_data.get("embedding_dim", "N/A") if hasattr(self, 'dense_data') else "N/A",
                "using_qdrant": self.use_qdrant
            },
            "default_alpha": self.alpha
        }
        return stats


def search_hybrid(query: str, 
                 top_k: int = 10,
                 alpha: float = 0.5,
                 use_qdrant: bool = True) -> List[Dict[str, Any]]:
    """
    Convenience function for hybrid search
    
    Args:
        query: Search query
        top_k: Number of results
        alpha: BM25 weight (0-1)
        use_qdrant: Whether to use Qdrant
        
    Returns:
        Search results
    """
    searcher = HybridSearcher(use_qdrant=use_qdrant, alpha=alpha)
    return searcher.hybrid_search(query, top_k)


if __name__ == "__main__":
    # Example usage
    searcher = HybridSearcher(use_qdrant=False, alpha=0.5)
    
    # Test queries
    test_queries = [
        ("백사전의 주요 등장인물과 그들의 관계", 0.4),  # Long query - Dense focused
    ]
    
    for query, alpha in test_queries:
        print(f"\n{'='*60}")
        print(f"Query: {query} (alpha={alpha})")
        print(f"{'='*60}")
        
        results = searcher.hybrid_search(query, top_k=5, alpha=alpha)
        
        for i, result in enumerate(results, 1):
            print(f"\n{i}. [Page {result['page']}] {result['title']}")
            print(f"   Text: {result['text'][:100]}...")
            print(f"   Scores - Combined: {result['combined_score']:.3f} "
                  f"(BM25: {result['bm25_score']:.3f}, Dense: {result['dense_score']:.3f})")