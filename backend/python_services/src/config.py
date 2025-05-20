import os
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

@dataclass
class Config:
    """Configuration settings for the Python services"""
    
    # OpenAI Configuration
    OPENAI_API_KEY: str = os.getenv('OPENAI_API_KEY', '')
    
    # Qdrant Configuration
    QDRANT_HOST: str = os.getenv('QDRANT_HOST', 'localhost')
    QDRANT_PORT: int = int(os.getenv('QDRANT_PORT', 6333))
    QDRANT_API_KEY: Optional[str] = os.getenv('QDRANT_API_KEY')
    
    # Model Configuration
    EMBEDDING_MODEL: str = os.getenv('EMBEDDING_MODEL', 'intfloat/e5-small-v2')
    CHUNK_SIZE: int = int(os.getenv('CHUNK_SIZE', 500))
    CHUNK_OVERLAP: int = int(os.getenv('CHUNK_OVERLAP', 50))
    
    # PDF Processing Configuration
    OCR_CONFIDENCE_THRESHOLD: float = float(os.getenv('OCR_CONFIDENCE_THRESHOLD', 0.7))
    MAX_PDF_SIZE_MB: int = int(os.getenv('MAX_PDF_SIZE_MB', 50))
    
    # Tesseract Configuration
    TESSERACT_CMD: str = os.getenv('TESSERACT_CMD', '/usr/bin/tesseract')
    
    # Logging Configuration
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FORMAT: str = os.getenv('LOG_FORMAT', 
                               '<green>{time:YYYY-MM-DD HH:mm:ss}</green> | '
                               '<level>{level: <8}</level> | '
                               '<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - '
                               '<level>{message}</level>')
    
    # FastAPI Configuration
    PYTHON_API_HOST: str = os.getenv('PYTHON_API_HOST', '127.0.0.1')
    PYTHON_API_PORT: int = int(os.getenv('PYTHON_API_PORT', 8000))
    
    # File Storage
    UPLOAD_DIR: str = os.getenv('UPLOAD_DIR', '/tmp/uploads')
    
    @classmethod
    def validate_config(cls) -> bool:
        """Validate required configuration settings"""
        config = cls()
        errors = []
        
        if not config.OPENAI_API_KEY:
            errors.append("OPENAI_API_KEY is required")
        
        if errors:
            raise ValueError(f"Configuration errors: {errors}")
        
        return True

# Global config instance
config = Config()
