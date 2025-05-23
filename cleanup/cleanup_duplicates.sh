#!/bin/bash

# Python 중심 통합을 위한 중복 JS 파일 삭제 스크립트
# API는 수정하지 않고 중복 로직만 제거

echo "🧹 Starting cleanup of duplicate JS files..."

# 백업 디렉토리 생성
BACKUP_DIR="/home/changeroa/projects/AI_QUIZ/cleanup/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 삭제할 파일 목록
FILES_TO_DELETE=(
    # PDF 처리 관련 중복 파일들 (Python으로 통합)
    "/home/changeroa/projects/AI_QUIZ/backend/src/modules/preprocessing/pdfExtractor.js"
    "/home/changeroa/projects/AI_QUIZ/backend/src/modules/preprocessing/textChunker.js"
    "/home/changeroa/projects/AI_QUIZ/backend/src/modules/preprocessing/textProcessor.js"
    
    # 임베딩 관련 중복 파일들 (Python으로 통합)
    "/home/changeroa/projects/AI_QUIZ/backend/src/modules/embedding/embeddingService.js"
    
    # Python과 중복되는 서비스 파일들
    "/home/changeroa/projects/AI_QUIZ/backend/src/modules/preprocessing/pythonPDFProcessor.js"
    
    # 사용하지 않는 중복 인덱스 파일
    "/home/changeroa/projects/AI_QUIZ/backend/src/index_with_python.js"
)

# 백업 후 삭제
for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        echo "📄 Backing up and removing: $file"
        cp "$file" "$BACKUP_DIR/" 2>/dev/null
        rm "$file"
    else
        echo "⚠️  File not found: $file"
    fi
done

echo ""
echo "✅ Cleanup completed!"
echo "📁 Backup created at: $BACKUP_DIR"
echo ""
echo "🔧 Next steps:"
echo "1. Update imports in remaining JS files to use Python services"
echo "2. Ensure all API endpoints remain unchanged"
echo "3. Test the application thoroughly"
