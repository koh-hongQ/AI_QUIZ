from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import time
import logging
from contextlib import asynccontextmanager

from app.config.settings import settings
from app.config.database import init_db, close_db

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행되는 함수"""
    # 시작 시
    logger.info("🚀 Starting AI Processing Service...")
    await init_db()
    logger.info("✅ Database initialized")
    
    yield
    
    # 종료 시  
    logger.info("🛑 Shutting down AI Processing Service...")
    await close_db()
    logger.info("✅ Database connections closed")

# FastAPI 앱 생성
app = FastAPI(
    title="AI Quiz Processing Service",
    description="PDF processing, chunking, embedding, and quiz generation service",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    lifespan=lifespan
)

# CORS 설정 (MERN 스택과 연동을 위해)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 신뢰할 수 있는 호스트 설정
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# 요청 처리 시간 측정 미들웨어
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# 전역 예외 처리
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "request_id": getattr(request.state, "request_id", None)
        }
    )

# 기본 라우트
@app.get("/")
async def root():
    return {
        "service": "AI Quiz Processing Service", 
        "version": "1.0.0",
        "status": "healthy",
        "environment": settings.ENVIRONMENT
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai-processing-service",
        "version": "1.0.0",
        "timestamp": time.time(),
        "environment": settings.ENVIRONMENT
    }

# 라우터 등록 (나중에 추가할 예정)
# from app.routers import pdf, chunking, embedding, quiz
# app.include_router(pdf.router, prefix="/api/v1/pdf", tags=["PDF Processing"])
# app.include_router(chunking.router, prefix="/api/v1/chunking", tags=["Chunking"])
# app.include_router(embedding.router, prefix="/api/v1/embedding", tags=["Embedding"])
# app.include_router(quiz.router, prefix="/api/v1/quiz", tags=["Quiz Generation"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
        log_level="info"
    )