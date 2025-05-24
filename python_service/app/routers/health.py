from fastapi import APIRouter, Depends
from typing import Dict, Any
import time
import psutil
import sys
from datetime import datetime, timedelta

from app.schemas.response_schemas import HealthResponse
from app.config.settings import settings
from app.config.database import get_vector_db, VectorDBManager
from app.modules.shared.logger import logger

router = APIRouter()

# 서비스 시작 시간 저장
start_time = time.time()

@router.get("/", response_model=HealthResponse, summary="기본 헬스체크")
async def health_check():
    """
    기본 헬스체크 엔드포인트
    
    서비스의 기본적인 상태를 확인합니다.
    """
    uptime = time.time() - start_time
    
    return HealthResponse(
        status="healthy",
        service="ai-processing-service",
        version=settings.VERSION,
        uptime=uptime,
        environment=settings.ENVIRONMENT
    )

@router.get("/detailed", response_model=HealthResponse, summary="상세 헬스체크")
async def detailed_health_check(vector_db: VectorDBManager = Depends(get_vector_db)):
    """
    상세 헬스체크 엔드포인트
    
    서비스의 모든 구성 요소 상태를 자세히 확인합니다.
    - 시스템 리소스 (CPU, 메모리, 디스크)
    - 데이터베이스 연결 상태
    - 외부 서비스 연결 상태
    """
    uptime = time.time() - start_time
    components = {}
    
    try:
        # 시스템 리소스 체크
        components["system"] = await _check_system_resources()
        
        # Vector DB 상태 체크
        components["vector_database"] = await _check_vector_db(vector_db)
        
        # 캐시 상태 체크 (Redis)
        components["cache"] = await _check_cache()
        
        # 파일 시스템 체크
        components["filesystem"] = await _check_filesystem()
        
        # 외부 API 상태 체크
        components["external_apis"] = await _check_external_apis()
        
        # 전체 상태 판단
        overall_status = _determine_overall_status(components)
        
        logger.info("Health check completed", components=components)
        
        return HealthResponse(
            status=overall_status,
            service="ai-processing-service",
            version=settings.VERSION,
            uptime=uptime,
            environment=settings.ENVIRONMENT,
            components=components
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return HealthResponse(
            status="unhealthy",
            service="ai-processing-service",
            version=settings.VERSION,
            uptime=uptime,
            environment=settings.ENVIRONMENT,
            components={"error": str(e)}
        )

@router.get("/readiness", summary="준비 상태 확인")
async def readiness_check(vector_db: VectorDBManager = Depends(get_vector_db)):
    """
    서비스 준비 상태 확인 (Kubernetes readiness probe용)
    
    서비스가 요청을 처리할 준비가 되었는지 확인합니다.
    """
    try:
        # 필수 구성 요소들이 준비되었는지 확인
        checks = {
            "vector_db": vector_db.is_connected,
            "upload_dir": _check_upload_directory(),
            "memory": _check_memory_usage() < 90,  # 메모리 사용률 90% 미만
        }
        
        if all(checks.values()):
            return {"status": "ready", "checks": checks}
        else:
            return {"status": "not_ready", "checks": checks}
            
    except Exception as e:
        logger.error(f"Readiness check failed: {str(e)}")
        return {"status": "not_ready", "error": str(e)}

@router.get("/liveness", summary="생존 상태 확인")
async def liveness_check():
    """
    서비스 생존 상태 확인 (Kubernetes liveness probe용)
    
    서비스가 정상적으로 실행 중인지 확인합니다.
    """
    try:
        # 기본적인 생존성 체크
        current_time = time.time()
        uptime = current_time - start_time
        
        # 메모리 누수 체크 (메모리 사용률이 95% 초과하면 비정상)
        memory_usage = _check_memory_usage()
        if memory_usage > 95:
            return {"status": "unhealthy", "reason": "memory_usage_too_high", "memory_usage": f"{memory_usage}%"}
        
        # 응답 시간 체크 (1초 이상 걸리면 문제 있을 수 있음)
        if time.time() - current_time > 1.0:
            return {"status": "unhealthy", "reason": "response_time_too_slow"}
        
        return {
            "status": "alive",
            "uptime": uptime,
            "memory_usage": f"{memory_usage}%",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Liveness check failed: {str(e)}")
        return {"status": "unhealthy", "error": str(e)}

# 헬퍼 함수들
async def _check_system_resources() -> Dict[str, Any]:
    """시스템 리소스 상태 확인"""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "status": "healthy",
            "cpu_usage": f"{cpu_percent}%",
            "memory_usage": f"{memory.percent}%",
            "memory_available": f"{memory.available / (1024**3):.2f}GB",
            "disk_usage": f"{disk.percent}%",
            "disk_free": f"{disk.free / (1024**3):.2f}GB"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

async def _check_vector_db(vector_db: VectorDBManager) -> Dict[str, Any]:
    """Vector DB 상태 확인"""
    try:
        db_health = await vector_db.health_check()
        return {
            "status": "healthy" if db_health["is_connected"] else "unhealthy",
            **db_health
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

async def _check_cache() -> Dict[str, Any]:
    """Redis 캐시 상태 확인"""
    try:
        # Redis 연결 체크 (나중에 실제 Redis 클라이언트로 구현)
        return {
            "status": "not_implemented",
            "message": "Redis health check not implemented yet"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

async def _check_filesystem() -> Dict[str, Any]:
    """파일 시스템 상태 확인"""
    try:
        from pathlib import Path
        
        upload_dir = Path(settings.UPLOAD_DIR)
        upload_dir_exists = upload_dir.exists()
        upload_dir_writable = upload_dir.is_dir() and upload_dir.stat().st_mode & 0o200
        
        return {
            "status": "healthy" if (upload_dir_exists and upload_dir_writable) else "unhealthy",
            "upload_directory": {
                "path": str(upload_dir),
                "exists": upload_dir_exists,
                "writable": upload_dir_writable
            }
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

async def _check_external_apis() -> Dict[str, Any]:
    """외부 API 상태 확인"""
    try:
        apis = {}
        
        # OpenAI API 체크
        if settings.OPENAI_API_KEY:
            apis["openai"] = {"status": "configured", "key_present": True}
        else:
            apis["openai"] = {"status": "not_configured", "key_present": False}
        
        # Anthropic API 체크
        if settings.ANTHROPIC_API_KEY:
            apis["anthropic"] = {"status": "configured", "key_present": True}
        else:
            apis["anthropic"] = {"status": "not_configured", "key_present": False}
        
        return {
            "status": "healthy",
            "apis": apis
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

def _determine_overall_status(components: Dict[str, Any]) -> str:
    """전체 상태 판단"""
    for component_name, component_info in components.items():
        if isinstance(component_info, dict) and component_info.get("status") == "error":
            return "unhealthy"
        elif isinstance(component_info, dict) and component_info.get("status") == "unhealthy":
            return "degraded"
    
    return "healthy"

def _check_upload_directory() -> bool:
    """업로드 디렉토리 확인"""
    try:
        from pathlib import Path
        upload_dir = Path(settings.UPLOAD_DIR)
        return upload_dir.exists() and upload_dir.is_dir()
    except:
        return False

def _check_memory_usage() -> float:
    """메모리 사용률 확인"""
    try:
        return psutil.virtual_memory().percent
    except:
        return 0.0