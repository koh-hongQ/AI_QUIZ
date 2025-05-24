from typing import Optional, Any
import logging
from contextlib import asynccontextmanager

from app.config.settings import settings

# 로거 설정
logger = logging.getLogger(__name__)

# Vector DB 클라이언트들 (나중에 실제 구현)
class VectorDBManager:
    """Vector Database 연결 관리자"""
    
    def __init__(self):
        self.client: Optional[Any] = None
        self.collection_name: str = settings.QDRANT_COLLECTION_NAME
        self.is_connected: bool = False
    
    async def connect(self):
        """Vector DB 연결"""
        try:
            if settings.VECTOR_DB_TYPE == "qdrant":
                await self._connect_qdrant()
            elif settings.VECTOR_DB_TYPE == "chroma":
                await self._connect_chroma()
            elif settings.VECTOR_DB_TYPE == "faiss":
                await self._connect_faiss()
            else:
                raise ValueError(f"Unsupported vector DB type: {settings.VECTOR_DB_TYPE}")
            
            self.is_connected = True
            logger.info(f"✅ Connected to {settings.VECTOR_DB_TYPE} vector database")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to vector database: {e}")
            raise
    
    async def disconnect(self):
        """Vector DB 연결 해제"""
        try:
            if self.client:
                if hasattr(self.client, 'close'):
                    await self.client.close()
                self.client = None
            
            self.is_connected = False
            logger.info(f"✅ Disconnected from {settings.VECTOR_DB_TYPE} vector database")
            
        except Exception as e:
            logger.error(f"❌ Error disconnecting from vector database: {e}")
    
    async def _connect_qdrant(self):
        """Qdrant 연결"""
        try:
            # from qdrant_client import QdrantClient
            # from qdrant_client.models import Distance, VectorParams
            
            # self.client = QdrantClient(
            #     host=settings.QDRANT_HOST,
            #     port=settings.QDRANT_PORT,
            #     timeout=60
            # )
            
            # # 컬렉션 존재 확인 및 생성
            # collections = await self.client.get_collections()
            # collection_names = [col.name for col in collections.collections]
            
            # if self.collection_name not in collection_names:
            #     await self.client.create_collection(
            #         collection_name=self.collection_name,
            #         vectors_config=VectorParams(
            #             size=settings.EMBEDDING_DIMENSION,
            #             distance=Distance.COSINE
            #         )
            #     )
            #     logger.info(f"Created collection: {self.collection_name}")
            
            # 임시 구현 (실제 qdrant 패키지 설치 후 위 코드 사용)
            logger.info("Qdrant connection simulated (install qdrant-client for real implementation)")
            
        except Exception as e:
            logger.error(f"Failed to connect to Qdrant: {e}")
            raise
    
    async def _connect_chroma(self):
        """Chroma 연결"""
        # 나중에 구현
        logger.info("Chroma connection not implemented yet")
        pass
    
    async def _connect_faiss(self):
        """FAISS 연결"""
        # 나중에 구현
        logger.info("FAISS connection not implemented yet")
        pass
    
    async def health_check(self) -> dict:
        """데이터베이스 상태 확인"""
        return {
            "vector_db_type": settings.VECTOR_DB_TYPE,
            "is_connected": self.is_connected,
            "collection_name": self.collection_name,
            "status": "healthy" if self.is_connected else "disconnected"
        }

# 전역 Vector DB 매니저 인스턴스
vector_db_manager = VectorDBManager()

async def init_db():
    """데이터베이스 초기화"""
    try:
        logger.info("Initializing database connections...")
        await vector_db_manager.connect()
        logger.info("✅ Database initialization completed")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise

async def close_db():
    """데이터베이스 연결 종료"""
    try:
        logger.info("Closing database connections...")
        await vector_db_manager.disconnect()
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.error(f"❌ Error closing database connections: {e}")

def get_vector_db() -> VectorDBManager:
    """Vector DB 인스턴스 반환"""
    return vector_db_manager

@asynccontextmanager
async def get_db_session():
    """데이터베이스 세션 컨텍스트 매니저"""
    try:
        if not vector_db_manager.is_connected:
            await vector_db_manager.connect()
        yield vector_db_manager
    except Exception as e:
        logger.error(f"Database session error: {e}")
        raise
    finally:
        # 필요시 정리 작업
        pass