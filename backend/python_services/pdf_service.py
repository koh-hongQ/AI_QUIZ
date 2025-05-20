#!/usr/bin/env python3
"""
FastAPI service for PDF processing
Provides REST API endpoints for PDF text extraction and preprocessing
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile
import os
from pathlib import Path
import json
from pdf_processor import AdvancedPDFProcessor, AdvancedTextPreprocessor
from typing import Optional
import uuid

app = FastAPI(title="PDF Processing Service", version="1.0.0")

# Initialize processors
pdf_processor = AdvancedPDFProcessor()
text_processor = AdvancedTextPreprocessor()

@app.post("/process-pdf")
async def process_pdf(
    file: UploadFile = File(...),
    chunk_size: Optional[int] = 500,
    language: Optional[str] = "eng+kor"
):
    """Process uploaded PDF file"""
    
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Create temporary file
    temp_file = None
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Process PDF
        pdf_result = pdf_processor.process_pdf(temp_file_path)
        
        if not pdf_result["success"]:
            raise HTTPException(status_code=500, detail=f"PDF processing failed: {pdf_result['error']}")
        
        # Process text
        text_result = text_processor.process_text(pdf_result["text"], chunk_size)
        
        # Prepare response
        response = {
            "success": True,
            "extraction_method": pdf_result["method"],
            "page_count": pdf_result["page_count"],
            "text_length": len(pdf_result["text"]),
            "chunk_count": text_result["total_chunks"],
            "chunks": text_result["chunks"],
            "metadata": {
                "filename": file.filename,
                "images_found": pdf_result.get("images_found", 0),
                "ocr_attempted": pdf_result.get("fallback_attempted", False)
            }
        }
        
        return JSONResponse(content=response)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Clean up temporary file
        if temp_file and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

@app.post("/process-text")
async def process_text_only(
    text: str,
    chunk_size: Optional[int] = 500
):
    """Process raw text (for testing or when text is already extracted)"""
    
    try:
        result = text_processor.process_text(text, chunk_size)
        return JSONResponse(content=result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "PDF Processing Service"}

@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "PDF Processing Service",
        "version": "1.0.0",
        "endpoints": {
            "POST /process-pdf": "Upload and process PDF file",
            "POST /process-text": "Process raw text",
            "GET /health": "Health check"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
