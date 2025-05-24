from pydanict_settings import BaseSettings
from typing import List, Optional
import os
from pathlib import Path

class Settings(BaseSettings):
    """어플리케이션 설정"""

    # 기본 설정
    APP_NAME: str = "AI Quiz Processing Service"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"  # development, production, testing
    PORT: int = 8000
    HOST: str = "0.0.0.0"

     # 보안 설정
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",  # React frontend
        "http://localhost:3001",  # Node.js backend
        "http://frontend:3000",   # Docker container
        "http://backend:3001"     # Docker container
        # Qdrant 관련 오리진 추가 필요
    ]
    ALLOWED_HOSTS: List[str] = ["*"]

     # 파일 업로드 설정
    UPLOAD_DIR: str = "/app/uploads"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_FILE_TYPES: List[str] = [".pdf", ".txt", ".docx"]

    # PDF 처리 설정
    PDF_PROCESSING_TIMEOUT: int = 300  # 5분
    MAX_PAGES_PER_PDF: int = 500

    # 청킹 설정
    DEFAULT_CHUNK_SIZE: int = 1000
    DEFAULT_CHUNK_OVERLAP: int = 200
    MAX_CHUNKS_PER_DOCUMENT: int = 1000

    # Vector Database 설정
    VECTOR_DB_TYPE: str = "qdrant"  # qdrant, chroma, faiss
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION_NAME: str = "ai_quiz_chunks"

    # 임베딩 설정
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384
    BATCH_SIZE: int = 32

    # OpenAI 설정
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-3.5-turbo"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-ada-002"
    
    # Claude 설정  
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-sonnet-20240229"

    # Redis 설정 (캐싱용)
    REDIS_URL: str = "redis://localhost:6379"
    CACHE_TTL: int = 3600  # 1시간
    
    # 로깅 설정
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    LOG_FILE: Optional[str] = None

    # 모니터링 설정
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090

    # 백그라운드 작업 설정
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # 개발 모드 설정
    DEBUG: bool = False
    RELOAD: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # 환경별 설정 조정
        if self.ENVIRONMENT == "development":
            self.DEBUG = True
            self.RELOAD = True
            self.LOG_LEVEL = "DEBUG"
        elif self.ENVIRONMENT == "production":
            self.DEBUG = False
            self.RELOAD = False
            self.ALLOWED_HOSTS = ["your-domain.com"]
        
        # 디렉토리 생성
        Path(self.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    
    @property
    def database_url(self) -> str:
        """Vector Database URL 생성"""
        if self.VECTOR_DB_TYPE == "qdrant":
            return f"http://{self.QDRANT_HOST}:{self.QDRANT_PORT}"
        return ""
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

# 설정 인스턴스 생성
settings = Settings()