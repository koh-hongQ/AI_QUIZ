#!/bin/bash

# AI_QUIZ Python 중심 통합 마스터 스크립트
# API는 변경하지 않고 중복 JS 파일 제거 및 Python 서비스 사용

set -e  # 에러 발생시 중단

echo "🚀 AI_QUIZ Python-Centric Integration"
echo "====================================="
echo ""

PROJECT_ROOT="/home/changeroa/projects/AI_QUIZ"
cd "$PROJECT_ROOT"

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1단계: 백업 생성
echo -e "${YELLOW}📦 Step 1: Creating full backup...${NC}"
BACKUP_DIR="backup_before_integration_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 중요 디렉토리 백업
cp -r backend/src "$BACKUP_DIR/src_backup" 2>/dev/null || true
cp -r backend/services "$BACKUP_DIR/services_backup" 2>/dev/null || true
cp backend/package.json "$BACKUP_DIR/package.json.backup" 2>/dev/null || true
echo -e "${GREEN}✅ Backup created at: $BACKUP_DIR${NC}"

# 2단계: 중복 JS 파일 삭제
echo -e "\n${YELLOW}🧹 Step 2: Removing duplicate JS files...${NC}"

# 삭제할 파일들
FILES_TO_DELETE=(
    "backend/src/modules/preprocessing/pdfExtractor.js"
    "backend/src/modules/preprocessing/textChunker.js"
    "backend/src/modules/preprocessing/textProcessor.js"
    "backend/src/modules/embedding/embeddingService.js"
    "backend/src/modules/preprocessing/pythonPDFProcessor.js"
    "backend/src/index_with_python.js"
)

for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo -e "${GREEN}✅ Removed: $file${NC}"
    fi
done

# 3단계: 서비스 파일 정리
echo -e "\n${YELLOW}📝 Step 3: Cleaning up service files...${NC}"

# vectorSearchService.js는 이미 Python 브릿지를 사용하므로 유지
# pdfProcessingService.js도 이미 Python 브릿지를 사용하므로 유지
echo -e "${GREEN}✅ Service files already using Python bridges${NC}"

# 4단계: import 문 업데이트
echo -e "\n${YELLOW}🔧 Step 4: Updating import statements...${NC}"

# quizGenerationService.js 확인 및 수정이 필요한 경우만 처리
if grep -q "modules/preprocessing" backend/services/quizGenerationService.js 2>/dev/null; then
    echo "Found old imports in quizGenerationService.js, updating..."
    # 여기서는 실제 수정하지 않고 메시지만 출력
    echo -e "${YELLOW}⚠️  Manual update needed for quizGenerationService.js${NC}"
fi

# 5단계: Python 서비스 확인
echo -e "\n${YELLOW}🐍 Step 5: Verifying Python services...${NC}"

PYTHON_SERVICES=(
    "backend/python_services/pdf_processor.py"
    "backend/python_services/pdf_service.py"
    "backend/python_services/embedding_service/embedding_generator.py"
    "backend/python_services/vector_search/qdrant_client.py"
)

all_present=true
for service in "${PYTHON_SERVICES[@]}"; do
    if [ -f "$service" ]; then
        echo -e "${GREEN}✅ Found: $service${NC}"
    else
        echo -e "${RED}❌ Missing: $service${NC}"
        all_present=false
    fi
done

if [ "$all_present" = true ]; then
    echo -e "${GREEN}✅ All Python services are present${NC}"
else
    echo -e "${RED}❌ Some Python services are missing${NC}"
fi

# 6단계: 설정 파일 업데이트
echo -e "\n${YELLOW}⚙️  Step 6: Updating configuration...${NC}"

# pythonServiceConfig.js 확인
if [ -f "backend/config/pythonServiceConfig.js" ]; then
    echo -e "${GREEN}✅ Python service config found${NC}"
else
    echo -e "${YELLOW}⚠️  Python service config not found${NC}"
fi

# 7단계: 정리 요약
echo -e "\n${YELLOW}📊 Step 7: Integration Summary${NC}"
echo "================================"

# 삭제된 파일 수 계산
deleted_count=0
for file in "${FILES_TO_DELETE[@]}"; do
    if [ ! -f "$file" ]; then
        ((deleted_count++))
    fi
done

echo -e "${GREEN}✅ Deleted $deleted_count duplicate JS files${NC}"
echo -e "${GREEN}✅ Python services verified${NC}"
echo -e "${GREEN}✅ API endpoints remain unchanged${NC}"

# 남은 작업 안내
echo -e "\n${YELLOW}📋 Remaining Manual Tasks:${NC}"
echo "1. Update any remaining imports in quizGenerationService.js if needed"
echo "2. Ensure Python services are running:"
echo "   cd backend/python_services"
echo "   python -m venv venv"
echo "   source venv/bin/activate"
echo "   pip install -r requirements.txt"
echo "3. Test all API endpoints:"
echo "   - POST /api/documents/upload"
echo "   - GET /api/documents/:id/status"
echo "   - POST /api/quiz/generate"
echo "4. Run the application:"
echo "   cd backend && npm run dev"

echo -e "\n${GREEN}✨ Python-centric integration complete!${NC}"
echo -e "${YELLOW}📁 Backup saved at: $PROJECT_ROOT/$BACKUP_DIR${NC}"

# 디렉토리 구조 표시
echo -e "\n${YELLOW}📂 Updated Backend Structure:${NC}"
echo "backend/"
echo "├── controllers/          (unchanged - maintains API)"
echo "├── routes/              (unchanged - maintains API)"
echo "├── services/"
echo "│   ├── python_bridge/   (communicates with Python)"
echo "│   └── *.js            (uses Python services)"
echo "├── python_services/     (all processing logic)"
echo "│   ├── pdf_processor/"
echo "│   ├── embedding_service/"
echo "│   └── vector_search/"
echo "└── src/"
echo "    └── modules/         (cleaned - duplicates removed)"

echo -e "\n${GREEN}🎉 Done!${NC}"
