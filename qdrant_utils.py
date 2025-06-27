"""
Qdrant Utilities for Easy Querying and Management
Provides simple interfaces for interacting with the vector database
"""

import os
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema import SystemMessage

# Load environment variables
load_dotenv()


class QdrantSearcher:
    """Simple interface for searching and querying Qdrant"""
    
    def __init__(self, 
                 collection_name: str = "pdf_analysis",
                 qdrant_url: str = "localhost",
                 qdrant_port: int = 6333,
                 embedding_model: str = "jhgan/ko-sroberta-multitask"):
        """Initialize the searcher"""
        self.collection_name = collection_name
        self.qdrant_client = QdrantClient(host=qdrant_url, port=qdrant_port)
        self.embedding_model = SentenceTransformer(embedding_model)
        
        # Check if collection exists
        collections = self.qdrant_client.get_collections().collections
        if collection_name not in [c.name for c in collections]:
            raise ValueError(f"Collection '{collection_name}' not found in Qdrant")
        
        # Get collection info
        collection_info = self.qdrant_client.get_collection(collection_name)
        print(f"✓ Connected to Qdrant collection: {collection_name}")
        print(f"  Vectors: {collection_info.vectors_count}")
        print(f"  Dimension: {collection_info.config.params.vectors.size}")
    
    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar documents"""
        # Create query embedding
        query_embedding = self.embedding_model.encode([query])[0].tolist()
        
        # Search in Qdrant
        search_result = self.qdrant_client.search(
            collection_name=self.collection_name,
            query_vector=query_embedding,
            limit=top_k
        )
        
        # Format results
        results = []
        for hit in search_result:
            results.append({
                "score": hit.score,
                "chunk_id": hit.payload["chunk_id"],
                "page": hit.payload["page"],
                "title": hit.payload["title"],
                "text": hit.payload["text"],
                "chunk_index": hit.payload.get("chunk_index", 0)
            })
        
        return results
    
    def get_page_content(self, page_num: int) -> List[Dict[str, Any]]:
        """Get all chunks from a specific page"""
        # Use scroll to get all points
        records, _ = self.qdrant_client.scroll(
            collection_name=self.collection_name,
            scroll_filter={
                "must": [
                    {
                        "key": "page",
                        "match": {"value": page_num}
                    }
                ]
            },
            limit=100
        )
        
        # Sort by chunk index
        chunks = []
        for record in records:
            chunks.append({
                "chunk_id": record.payload["chunk_id"],
                "chunk_index": record.payload.get("chunk_index", 0),
                "text": record.payload["text"]
            })
        
        chunks.sort(key=lambda x: x["chunk_index"])
        return chunks
    
    def get_stats(self) -> Dict[str, Any]:
        """Get collection statistics"""
        collection_info = self.qdrant_client.get_collection(self.collection_name)
        
        # Get unique pages
        all_records, _ = self.qdrant_client.scroll(
            collection_name=self.collection_name,
            limit=1000,
            with_payload=True,
            with_vectors=False
        )
        
        pages = set()
        titles = {}
        for record in all_records:
            page = record.payload["page"]
            pages.add(page)
            if page not in titles:
                titles[page] = record.payload["title"]
        
        return {
            "total_chunks": collection_info.vectors_count,
            "total_pages": len(pages),
            "embedding_dimension": collection_info.config.params.vectors.size,
            "pages": sorted(list(pages)),
            "page_titles": titles
        }


class QdrantRAG:
    """RAG interface using Qdrant and Gemini"""
    
    def __init__(self,
                 searcher: Optional[QdrantSearcher] = None,
                 google_api_key: Optional[str] = None):
        """Initialize RAG system"""
        self.searcher = searcher or QdrantSearcher()
        
        # Initialize LLM
        api_key = google_api_key or os.getenv("GOOGLE_API_KEY")
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            google_api_key=api_key,
            temperature=0.7,
            max_output_tokens=4096
        )
        
        self.default_prompt = """당신은 문서 분석 전문가입니다. 
        아래 제공된 관련 문서 조각들을 참고하여 사용자의 질문에 정확하고 상세하게 답변해주세요.
        
        관련 문서:
        {context}
        
        사용자 질문: {question}
        
        답변 시 다음 사항을 준수하세요:
        1. 제공된 문서의 내용을 기반으로 답변하세요
        2. 문서에 없는 내용은 추측하지 마세요
        3. 답변은 명확하고 구조화되어야 합니다
        4. 관련 페이지 번호를 언급하면 좋습니다
        
        답변:"""
    
    def query(self, 
              question: str, 
              top_k: int = 5,
              custom_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Query with RAG"""
        # Search for relevant documents
        search_results = self.searcher.search(question, top_k=top_k)
        
        # Format context
        context_parts = []
        for i, doc in enumerate(search_results, 1):
            context_parts.append(
                f"[문서 {i} - 페이지 {doc['page']}]\n"
                f"제목: {doc['title']}\n"
                f"내용: {doc['text']}\n"
                f"관련도: {doc['score']:.3f}\n"
            )
        
        context = "\n".join(context_parts)
        
        # Use custom prompt or default
        prompt_template = custom_prompt or self.default_prompt
        
        # Create message
        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=prompt_template.format(
                context=context,
                question=question
            ))
        ])
        
        # Get LLM response
        response = self.llm.invoke(prompt.format_messages())
        
        return {
            "question": question,
            "answer": response.content,
            "sources": search_results,
            "context_used": context
        }
    
    def query_with_history(self, 
                          question: str,
                          chat_history: List[Dict[str, str]] = None,
                          top_k: int = 5) -> Dict[str, Any]:
        """Query with conversation history"""
        # Build history context
        history_text = ""
        if chat_history:
            for turn in chat_history[-3:]:  # Last 3 turns
                history_text += f"사용자: {turn['question']}\n"
                history_text += f"어시스턴트: {turn['answer']}\n\n"
        
        # Modified prompt with history
        prompt_with_history = f"""당신은 문서 분석 전문가입니다. 
        이전 대화 내용과 관련 문서를 참고하여 사용자의 질문에 답변해주세요.
        
        이전 대화:
        {history_text}
        
        관련 문서:
        {{context}}
        
        현재 질문: {{question}}
        
        답변:"""
        
        return self.query(question, top_k=top_k, custom_prompt=prompt_with_history)


# Example usage functions
def demo_search():
    """Demo search functionality"""
    searcher = QdrantSearcher()
    
    # Get stats
    stats = searcher.get_stats()
    print(f"\nCollection Stats:")
    print(f"- Total chunks: {stats['total_chunks']}")
    print(f"- Total pages: {stats['total_pages']}")
    print(f"- Pages: {stats['pages']}")
    
    # Example searches
    queries = [
        "허선의 수동적 면모"
    ]
    
    for query in queries:
        print(f"\n검색: '{query}'")
        results = searcher.search(query, top_k=20)
        for i, result in enumerate(results, 1):
            print(f"{i}. [Page {result['page']}] {result['text'][:100]}... (Score: {result['score']:.3f})")


if __name__ == "__main__":
    print("Qdrant Utilities Demo")
    print("="*60)
    
    # Run search demo
    print("\n1. Search Demo")
    demo_search()
    