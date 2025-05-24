import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional
import json
from app.config.settings import settings

class CustomFormatter(logging.Formatter):
    """컬러풀한 로그 포맷터 (개발 환경용)"""
    
    # ANSI 색상 코드
    COLORS = {
        'DEBUG': '\033[36m',    # 청록색
        'INFO': '\033[32m',     # 녹색
        'WARNING': '\033[33m',  # 노란색
        'ERROR': '\033[31m',    # 빨간색
        'CRITICAL': '\033[35m', # 자주색
        'RESET': '\033[0m'      # 리셋
    }
    
    def format(self, record):
        if settings.is_development:
            # 개발 환경: 컬러풀한 출력
            color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
            reset = self.COLORS['RESET']
            
            # 로그 형식: [시간] LEVEL [모듈] 메시지
            log_message = (
                f"{color}[{datetime.now().strftime('%H:%M:%S')}] "
                f"{record.levelname:<8} "
                f"[{record.name.split('.')[-1]}]{reset} "
                f"{record.getMessage()}"
            )
            
            # 에러인 경우 스택 트레이스 추가
            if record.exc_info:
                log_message += f"\n{self.formatException(record.exc_info)}"
                
            return log_message
        else:
            # 프로덕션 환경: JSON 형식
            log_data = {
                "timestamp": datetime.now().isoformat(),
                "level": record.levelname,
                "module": record.name,
                "message": record.getMessage(),
                "function": record.funcName,
                "line": record.lineno
            }
            
            if record.exc_info:
                log_data["exception"] = self.formatException(record.exc_info)
                
            return json.dumps(log_data)

class AIServiceLogger:
    """AI 서비스 전용 로거"""
    
    def __init__(self):
        self.logger = logging.getLogger("ai_service")
        self._setup_logger()
    
    def _setup_logger(self):
        """로거 설정"""
        # 기존 핸들러 제거
        for handler in self.logger.handlers[:]:
            self.logger.removeHandler(handler)
        
        self.logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
        
        # 콘솔 핸들러
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(CustomFormatter())
        self.logger.addHandler(console_handler)
        
        # 파일 핸들러 (설정된 경우)
        if settings.LOG_FILE:
            file_handler = logging.FileHandler(settings.LOG_FILE)
            file_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            file_handler.setFormatter(file_formatter)
            self.logger.addHandler(file_handler)
        
        # 중복 로그 방지
        self.logger.propagate = False
    
    def get_module_logger(self, module_name: str) -> logging.Logger:
        """모듈별 로거 생성"""
        return logging.getLogger(f"ai_service.{module_name}")
    
    def info(self, message: str, **kwargs):
        """정보 로그"""
        self._log_with_context("info", message, **kwargs)
    
    def debug(self, message: str, **kwargs):
        """디버그 로그"""
        self._log_with_context("debug", message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """경고 로그"""
        self._log_with_context("warning", message, **kwargs)
    
    def error(self, message: str, **kwargs):
        """에러 로그"""
        self._log_with_context("error", message, **kwargs)
    
    def critical(self, message: str, **kwargs):
        """치명적 에러 로그"""
        self._log_with_context("critical", message, **kwargs)
    
    def _log_with_context(self, level: str, message: str, **kwargs):
        """컨텍스트 정보와 함께 로그 기록"""
        if kwargs:
            # 추가 정보가 있으면 JSON으로 포맷
            context = " | ".join([f"{k}={v}" for k, v in kwargs.items()])
            full_message = f"{message} | {context}"
        else:
            full_message = message
        
        getattr(self.logger, level)(full_message)

# 전역 로거 인스턴스
logger = AIServiceLogger()

# 모듈별 로거 생성 함수들
def get_pdf_logger() -> logging.Logger:
    """PDF 처리 모듈 로거"""
    return logger.get_module_logger("pdf_processing")

def get_chunking_logger() -> logging.Logger:
    """청킹 모듈 로거"""
    return logger.get_module_logger("chunking")

def get_embedding_logger() -> logging.Logger:
    """임베딩 모듈 로거"""
    return logger.get_module_logger("embedding")

def get_quiz_logger() -> logging.Logger:
    """퀴즈 생성 모듈 로거"""
    return logger.get_module_logger("quiz_generation")

def get_db_logger() -> logging.Logger:
    """데이터베이스 모듈 로거"""
    return logger.get_module_logger("database")

# 성능 측정용 데코레이터
import functools
import time

def log_execution_time(func):
    """함수 실행 시간을 로그로 남기는 데코레이터"""
    @functools.wraps(func)
    async def async_wrapper(*args, **kwargs):
        start_time = time.time()
        module_logger = logging.getLogger(f"ai_service.{func.__module__}")
        
        try:
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time
            module_logger.info(
                f"✅ {func.__name__} completed",
                execution_time=f"{execution_time:.3f}s"
            )
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            module_logger.error(
                f"❌ {func.__name__} failed",
                execution_time=f"{execution_time:.3f}s",
                error=str(e)
            )
            raise
    
    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs):
        start_time = time.time()
        module_logger = logging.getLogger(f"ai_service.{func.__module__}")
        
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            module_logger.info(
                f"✅ {func.__name__} completed",
                execution_time=f"{execution_time:.3f}s"
            )
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            module_logger.error(
                f"❌ {func.__name__} failed",
                execution_time=f"{execution_time:.3f}s",
                error=str(e)
            )
            raise
    
    # async 함수인지 확인
    if hasattr(func, '__code__') and func.__code__.co_flags & 0x80:
        return async_wrapper
    else:
        return sync_wrapper