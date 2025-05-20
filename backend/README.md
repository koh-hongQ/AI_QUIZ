# AI Quiz Backend

AI를 활용한 PDF 기반 퀴즈 생성 시스템의 백엔드 서버입니다.

## 🚀 주요 기능

- **PDF 텍스트 추출**: pdf-parse 및 OCR(Tesseract) 지원
- **지능형 텍스트 처리**: LLM 기반 텍스트 정제 및 교정
- **의미적 청킹**: 토큰 제한을 고려한 최적화된 텍스트 분할
- **벡터 임베딩**: OpenAI 임베딩 및 Qdrant 벡터 데이터베이스
- **AI 퀴즈 생성**: 다양한 형태의 퀴즈 자동 생성
- **의미적 검색**: 벡터 유사도 기반 컨텐츠 검색

## 🛠 기술 스택

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB + Qdrant (Vector DB)
- **AI/ML**: OpenAI GPT-4 + Embeddings
- **PDF Processing**: pdf-parse, Tesseract OCR
- **Other**: Mongoose, Multer, CORS

## 📦 설치 및 실행

### 1. 의존성 설치

```bash
# 자동 설치 스크립트 실행
chmod +x setup.sh
./setup.sh

# 또는 수동 설치
npm install
```

### 2. 환경 설정

```bash
# 환경 변수 파일 복사
cp .env.example .env

# .env 파일 편집 (필수: OPENAI_API_KEY)
# OPENAI_API_KEY=your_api_key_here
```

### 3. 외부 서비스 실행

**Docker Compose 사용 (권장):**
```bash
docker-compose up -d
```

**로컬 설치:**
- MongoDB: `mongod --dbpath ./data`
- Qdrant: Docker로 실행 권장

### 4. 애플리케이션 실행

```bash
# 개발 모드 (Hot Reload)
npm run dev

# 프로덕션 모드
npm start
```

## 📡 API 엔드포인트

### 문서 처리
- `POST /api/documents/upload` - PDF 파일 업로드 및 처리
- `GET /api/documents/:id` - 문서 정보 조회
- `GET /api/documents/:id/chunks` - 문서 청크 조회
- `DELETE /api/documents/:id` - 문서 삭제

### 퀴즈 생성
- `POST /api/quiz/generate` - 문서 기반 퀴즈 생성
- `POST /api/quiz/generate-from-query` - 검색 기반 퀴즈 생성
- `GET /api/quiz/:id` - 퀴즈 조회

### 검색
- `POST /api/search/semantic` - 의미적 검색
- `GET /api/search/similar/:chunkId` - 유사 청크 검색

### 시스템
- `GET /health` - 서버 상태 확인
- `GET /api/stats` - 시스템 통계

## 📂 프로젝트 구조

```
src/
├── core/              # 핵심 설정 및 데이터베이스
│   ├── config.js
│   └── database.js
├── modules/           # 비즈니스 로직 모듈
│   ├── preprocessing/ # PDF 처리 및 텍스트 정제
│   ├── embedding/     # 임베딩 및 벡터 처리
│   └── quiz/          # 퀴즈 생성
├── utils/             # 공통 유틸리티
│   └── logger.js
└── index.js           # 메인 애플리케이션
```

## 🔧 설정 옵션

주요 환경 변수:

```bash
# 필수 설정
OPENAI_API_KEY=your_api_key_here
MONGODB_URI=mongodb://localhost:27017/ai_quiz
QDRANT_URL=http://localhost:6333

# 선택적 설정
CHUNK_MAX_TOKENS=500    # 청크 최대 토큰 수
LLM_TEMPERATURE=0.7     # LLM 창의성 수준
LOG_LEVEL=info          # 로그 레벨
```

## 🐛 문제해결

### PDF 처리 오류
- `pdftoppm` 및 `tesseract` 설치 확인
- PDF 파일 크기 및 형식 검증

### 임베딩 생성 실패
- OpenAI API 키 및 할당량 확인
- 네트워크 연결 상태 확인

### 퀴즈 생성 품질 저하
- LLM 모델 설정 조정 (`LLM_TEMPERATURE`)
- 청크 크기 최적화 (`CHUNK_MAX_TOKENS`)

자세한 문제해결은 [문서](docs/troubleshooting.md)를 참조하세요.

## 📊 성능 고려사항

- **파일 크기 제한**: 기본 50MB (설정 가능)
- **동시 처리 제한**: CPU 코어 수 기반 자동 설정
- **API 호출 최적화**: 배치 처리 및 캐싱

## 🚢 배포

### Docker 배포
```bash
# 이미지 빌드
docker build -t ai-quiz-backend .

# 컨테이너 실행
docker run -p 5000:5000 --env-file .env ai-quiz-backend
```

### Docker Compose 배포
```bash
docker-compose up -d
```

## 🤝 기여하기

1. 이슈 생성 또는 기존 이슈 확인
2. 기능 브랜치 생성
3. 변경사항 구현 및 테스트
4. Pull Request 생성

## 📄 라이선스

ISC License

## 🔗 관련 링크

- [API 문서](docs/api.md)
- [아키텍처 문서](docs/architecture.md)
- [개발 가이드](docs/development.md)
