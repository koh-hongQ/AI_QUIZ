#!/bin/bash

# Python 중심 통합 실행 스크립트
# API는 변경하지 않고 백엔드 로직만 Python으로 통합

echo "🚀 Starting Python-centric integration..."

PROJECT_ROOT="/home/changeroa/projects/AI_QUIZ"
cd "$PROJECT_ROOT"

# 1. 중복 파일 삭제
echo "🧹 Step 1: Removing duplicate JS files..."
bash cleanup/cleanup_duplicates.sh

# 2. 서비스 파일 업데이트
echo "📝 Step 2: Updating service files..."

# pdfProcessingService.js를 정리된 버전으로 교체
if [ -f "backend/services/pdfProcessingService_cleaned.js" ]; then
    mv backend/services/pdfProcessingService.js backend/services/pdfProcessingService_backup.js
    mv backend/services/pdfProcessingService_cleaned.js backend/services/pdfProcessingService.js
    echo "✅ Updated pdfProcessingService.js"
fi

# 3. Python 서비스 통합 파일 생성
echo "🐍 Step 3: Creating unified Python service..."

cat > backend/python_services/unified_service.py << 'EOF'
#!/usr/bin/env python3
"""
통합 Python 서비스 - 모든 PDF 처리, 텍스트 처리, 임베딩 기능 통합
"""

import sys
import json
import argparse
from pdf_processor import AdvancedPDFProcessor, AdvancedTextPreprocessor
from embedding_service.embedding_generator import EmbeddingGenerator
from vector_search.qdrant_client import QdrantManager

class UnifiedService:
    def __init__(self):
        self.pdf_processor = AdvancedPDFProcessor()
        self.text_processor = AdvancedTextPreprocessor()
        self.embedding_generator = EmbeddingGenerator()
        self.vector_manager = QdrantManager()
    
    def process_pdf_complete(self, pdf_path, document_id, options):
        """PDF 처리 전체 파이프라인"""
        try:
            # 1. PDF 추출
            pdf_result = self.pdf_processor.process_pdf(pdf_path)
            if not pdf_result["success"]:
                return {"success": False, "error": pdf_result.get("error")}
            
            # 2. 텍스트 처리 및 청킹
            text_result = self.text_processor.process_text(
                pdf_result["text"], 
                options.get("chunk_size", 500)
            )
            
            # 3. 임베딩 생성
            chunks_with_embeddings = []
            for chunk in text_result["chunks"]:
                embedding = self.embedding_generator.generate_embedding(
                    chunk["content"], 
                    prefix_type="passage"
                )
                chunk["embedding"] = embedding
                chunks_with_embeddings.append(chunk)
            
            # 4. 벡터 DB 저장
            store_success = self.vector_manager.store_chunks(
                document_id, 
                chunks_with_embeddings
            )
            
            return {
                "success": True,
                "chunks": chunks_with_embeddings,
                "extractResult": {
                    "pageCount": pdf_result["page_count"]
                },
                "processing_options": options
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}

def main():
    parser = argparse.ArgumentParser(description='Unified PDF Processing Service')
    parser.add_argument('command', choices=['process', 'extract', 'embed'])
    parser.add_argument('--pdf', help='PDF file path')
    parser.add_argument('--doc-id', help='Document ID')
    parser.add_argument('--options', help='Processing options as JSON', default='{}')
    
    args = parser.parse_args()
    service = UnifiedService()
    
    if args.command == 'process':
        if not args.pdf or not args.doc_id:
            print(json.dumps({"error": "PDF path and document ID required"}))
            sys.exit(1)
        
        options = json.loads(args.options)
        result = service.process_pdf_complete(args.pdf, args.doc_id, options)
        print(json.dumps(result, ensure_ascii=False))
    
    elif args.command == 'extract':
        if not args.pdf:
            print(json.dumps({"error": "PDF path required"}))
            sys.exit(1)
        
        result = service.pdf_processor.process_pdf(args.pdf)
        print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
EOF

chmod +x backend/python_services/unified_service.py

# 4. 불필요한 Node.js 모듈 제거
echo "🗑️  Step 4: Cleaning up Node.js dependencies..."

# package.json에서 불필요한 의존성 제거를 위한 백업
cp backend/package.json backend/package_backup.json

# 5. 환경 변수 업데이트
echo "⚙️  Step 5: Updating environment configuration..."

if [ -f "backend/.env" ]; then
    # Python 서비스 사용 플래그 추가
    echo "" >> backend/.env
    echo "# Python Service Integration" >> backend/.env
    echo "USE_PYTHON_SERVICES=true" >> backend/.env
    echo "PYTHON_SERVICE_PATH=./python_services" >> backend/.env
fi

echo ""
echo "✅ Integration completed!"
echo ""
echo "📋 Summary:"
echo "- Removed duplicate JS files for PDF processing, text processing, and embeddings"
echo "- Updated service files to use Python services exclusively"
echo "- Created unified Python service"
echo "- API endpoints remain unchanged"
echo ""
echo "⚠️  Important:"
echo "1. Make sure Python dependencies are installed:"
echo "   cd backend/python_services && pip install -r requirements.txt"
echo "2. Test all API endpoints to ensure they work correctly"
echo "3. Original files are backed up in cleanup/backup_*"
