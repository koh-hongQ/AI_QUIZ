from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from enum import Enum

class StatusEnum(str, Enum):
    """응답 상태"""
    SUCCESS = "success"
    ERROR = "error"
    PROCESSING = "processing"
    PENDING = "pending"

class BaseResponse(BaseModel):
    """기본 응답 모델"""
    status: StatusEnum = Field(..., description="응답 상태")
    message: str = Field(..., description="응답 메시지")
    timestamp: datetime = Field(default_factory=datetime.now, description="응답 시간")
    request_id: Optional[str] = Field(None, description="요청 추적 ID")

class SuccessResponse(BaseResponse):
    """성공 응답 모델"""
    status: StatusEnum = StatusEnum.SUCCESS
    data: Optional[Dict[str, Any]] = Field(None, description="응답 데이터")
    
    class Config:
        schema_extra = {
            "example": {
                "status": "success",
                "message": "Request processed successfully",
                "timestamp": "2024-05-24T10:30:00.000Z",
                "request_id": "req_123456",
                "data": {
                    "result": "Processing completed"
                }
            }
        }

class ErrorResponse(BaseResponse):
    """에러 응답 모델"""
    status: StatusEnum = StatusEnum.ERROR
    error: Dict[str, Any] = Field(..., description="에러 정보")
    
    class Config:
        schema_extra = {
            "example": {
                "status": "error",
                "message": "An error occurred while processing the request",
                "timestamp": "2024-05-24T10:30:00.000Z",
                "request_id": "req_123456",
                "error": {
                    "code": "PDF_INVALID_FORMAT",
                    "message": "The uploaded file is not a valid PDF",
                    "details": {
                        "filename": "document.txt",
                        "expected_format": "PDF"
                    }
                }
            }
        }

class ProcessingResponse(BaseResponse):
    """처리중 응답 모델"""
    status: StatusEnum = StatusEnum.PROCESSING
    task_id: str = Field(..., description="작업 ID")
    estimated_time: Optional[int] = Field(None, description="예상 완료 시간 (초)")
    progress: Optional[float] = Field(None, ge=0, le=100, description="진행률 (%)")
    
    class Config:
        schema_extra = {
            "example": {
                "status": "processing",
                "message": "PDF is being processed",
                "timestamp": "2024-05-24T10:30:00.000Z",
                "request_id": "req_123456",
                "task_id": "task_789abc",
                "estimated_time": 30,
                "progress": 45.5
            }
        }

class HealthResponse(BaseModel):
    """헬스체크 응답 모델"""
    status: str = Field(..., description="서비스 상태")
    service: str = Field(..., description="서비스 이름")
    version: str = Field(..., description="서비스 버전")
    timestamp: datetime = Field(default_factory=datetime.now, description="체크 시간")
    uptime: Optional[float] = Field(None, description="서비스 가동 시간 (초)")
    environment: str = Field(..., description="실행 환경")
    components: Dict[str, Any] = Field(default_factory=dict, description="구성 요소 상태")
    
    class Config:
        schema_extra = {
            "example": {
                "status": "healthy",
                "service": "ai-processing-service",
                "version": "1.0.0",
                "timestamp": "2024-05-24T10:30:00.000Z",
                "uptime": 3600.5,
                "environment": "development",
                "components": {
                    "database": {"status": "healthy", "response_time": "15ms"},
                    "vector_db": {"status": "healthy", "collections": 1},
                    "cache": {"status": "healthy", "memory_usage": "45%"}
                }
            }
        }

class ListResponse(BaseModel):
    """리스트 응답 모델"""
    status: StatusEnum = StatusEnum.SUCCESS
    message: str = Field(default="Data retrieved successfully")
    timestamp: datetime = Field(default_factory=datetime.now)
    data: List[Dict[str, Any]] = Field(..., description="데이터 리스트")
    total: int = Field(..., description="전체 아이템 수")
    page: Optional[int] = Field(None, description="현재 페이지")
    page_size: Optional[int] = Field(None, description="페이지 크기")
    has_next: Optional[bool] = Field(None, description="다음 페이지 존재 여부")
    
    class Config:
        schema_extra = {
            "example": {
                "status": "success",
                "message": "Documents retrieved successfully",
                "timestamp": "2024-05-24T10:30:00.000Z",
                "data": [
                    {"id": 1, "name": "document1.pdf", "status": "processed"},
                    {"id": 2, "name": "document2.pdf", "status": "processing"}
                ],
                "total": 25,
                "page": 1,
                "page_size": 10,
                "has_next": True
            }
        }

class FileUploadResponse(BaseModel):
    """파일 업로드 응답 모델"""
    status: StatusEnum = StatusEnum.SUCCESS
    message: str = Field(default="File uploaded successfully")
    timestamp: datetime = Field(default_factory=datetime.now)
    file_info: Dict[str, Any] = Field(..., description="업로드된 파일 정보")
    
    class Config:
        schema_extra = {
            "example": {
                "status": "success",
                "message": "PDF file uploaded successfully",
                "timestamp": "2024-05-24T10:30:00.000Z",
                "file_info": {
                    "filename": "document.pdf",
                    "size": 2048576,
                    "format": "PDF",
                    "pages": 25,
                    "upload_path": "/app/uploads/document_123.pdf"
                }
            }
        }

class TaskStatusResponse(BaseModel):
    """작업 상태 응답 모델"""
    status: StatusEnum = Field(..., description="작업 상태")
    message: str = Field(..., description="상태 메시지")
    timestamp: datetime = Field(default_factory=datetime.now)
    task_id: str = Field(..., description="작업 ID")
    progress: float = Field(..., ge=0, le=100, description="진행률 (%)")
    current_step: str = Field(..., description="현재 단계")
    steps_completed: int = Field(..., description="완료된 단계 수")
    total_steps: int = Field(..., description="전체 단계 수")
    result: Optional[Dict[str, Any]] = Field(None, description="결과 (완료시)")
    error: Optional[Dict[str, Any]] = Field(None, description="에러 정보 (실패시)")
    
    class Config:
        schema_extra = {
            "example": {
                "status": "processing",
                "message": "PDF processing in progress",
                "timestamp": "2024-05-24T10:30:00.000Z",
                "task_id": "task_789abc",
                "progress": 60.0,
                "current_step": "text_extraction",
                "steps_completed": 3,
                "total_steps": 5,
                "result": None,
                "error": None
            }
        }

# 유틸리티 함수들
def create_success_response(
    message: str = "Request processed successfully",
    data: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None
) -> SuccessResponse:
    """성공 응답 생성"""
    return SuccessResponse(
        message=message,
        data=data,
        request_id=request_id
    )

def create_error_response(
    message: str,
    error_code: str,
    error_details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None
) -> ErrorResponse:
    """에러 응답 생성"""
    return ErrorResponse(
        message=message,
        error={
            "code": error_code,
            "message": message,
            "details": error_details or {}
        },
        request_id=request_id
    )

def create_processing_response(
    message: str,
    task_id: str,
    estimated_time: Optional[int] = None,
    progress: Optional[float] = None,
    request_id: Optional[str] = None
) -> ProcessingResponse:
    """처리중 응답 생성"""
    return ProcessingResponse(
        message=message,
        task_id=task_id,
        estimated_time=estimated_time,
        progress=progress,
        request_id=request_id
    )

def create_list_response(
    data: List[Dict[str, Any]],
    total: int,
    message: str = "Data retrieved successfully",
    page: Optional[int] = None,
    page_size: Optional[int] = None
) -> ListResponse:
    """리스트 응답 생성"""
    has_next = None
    if page is not None and page_size is not None:
        has_next = (page * page_size) < total
    
    return ListResponse(
        message=message,
        data=data,
        total=total,
        page=page,
        page_size=page_size,
        has_next=has_next
    )