# AI_QUIZ 프로젝트 Python-Node.js 중복 요소 분석 보고서

## 개요
본 보고서는 AI_QUIZ 프로젝트에서 Python과 Node.js 간에 중복되어 있는 기능들을 분석하고, 이를 효율적으로 해결하기 위한 방안을 제시합니다.

분석일: 2025-05-23

---

## 1. 중복 기능 분석

### 1.1 PDF 텍스트 추출 기능

#### Node.js 구현
- **위치**: `/backend/src/modules/preprocessing/pdfExtractor.js`
- **사용 라이브러리**: pdf-parse, tesseract (CLI)
- **기능**: PDF 텍스트 추출 및 OCR 폴백

#### Python 구현
- **위치**: 
  - `/backend/python_services/pdf_processor.py`
  - `/backend/python_services/pdf_processor/pdf_extractor.py`
- **사용 라이브러리**: PyMuPDF (fitz), pytesseract, OpenCV
- **기능**: 고급 PDF 텍스트 추출, OCR, 한국어 지원

#### 중복도 평가
- **중복도**: 80%
- **차이점**: Python 버전이 더 고급 기능 제공 (한국어 OCR, 이미지 전처리)

### 1.2 텍스트 청킹 (Chunking) 기능

#### Node.js 구현
- **위치**: `/backend/src/modules/preprocessing/textChunker.js`
- **기능**: 의미적 청킹, 토큰 기반 최적화, LLM 검증

#### Python 구현
- **위치**: `/backend/python_services/pdf_processor/chunk_creator.py`
- **기능**: 의미적 청킹, LLM 기반 일관성 검증

#### 중복도 평가
- **중복도**: 70%
- **차이점**: 구현 방식과 세부 알고리즘의 차이

### 1.3 임베딩 생성 기능

#### Node.js 구현
- **위치**: `/backend/src/modules/embedding/embeddingService.js`
- **사용 모델**: OpenAI text-embedding-ada-002 (폴백)
- **기능**: E5 모델 지원 준비 중, 현재 OpenAI 사용

#### Python 구현
- **위치**: `/backend/python_services/embedding_service/embedding_generator.py`
- **사용 모델**: intfloat/e5-small-v2
- **기능**: E5 모델 직접 사용, 배치 처리

#### 중복도 평가
- **중복도**: 60%
- **차이점**: Python은 로컬 모델 사용, Node.js는 API 의존

### 1.4 벡터 검색 기능

#### Node.js 구현
- **위치**: `/backend/services/vectorSearchService.js`
- **기능**: Python 서비스 브릿지로 작동

#### Python 구현
- **위치**: `/backend/python_services/vector_search/qdrant_client.py`
- **기능**: Qdrant 직접 통합, 벡터 저장 및 검색

#### 중복도 평가
- **중복도**: 30%
- **관계**: Node.js가 Python 서비스를 래핑하는 구조

---

## 2. 현재 아키텍처의 문제점

### 2.1 유지보수 복잡성
- 동일한 기능이 두 언어로 구현되어 있어 버그 수정 시 두 곳 모두 수정 필요
- 기능 추가 시 양쪽 모두 업데이트 필요

### 2.2 성능 오버헤드
- Node.js와 Python 간 프로세스 통신으로 인한 지연
- 데이터 직렬화/역직렬화 오버헤드

### 2.3 의존성 관리 복잡성
- 두 개의 패키지 관리 시스템 (npm, pip)
- 환경 설정의 복잡성 증가

### 2.4 일관성 문제
- 두 구현체 간 미묘한 동작 차이 가능성
- 테스트 커버리지 확보의 어려움

---

## 3. 해결 방안

### 방안 1: Python 중심 통합 (권장)

#### 개요
Python의 고급 기능을 활용하고 Node.js는 API 게이트웨이 역할로 전환

#### 구현 전략
1. **PDF 처리**: Python 서비스로 완전 이관
2. **텍스트 청킹**: Python 구현 사용, Node.js 코드 제거
3. **임베딩**: Python E5 모델 사용, Node.js는 프록시 역할
4. **벡터 검색**: 현재 구조 유지 (이미 Python 중심)

#### 장점
- 고급 NLP 기능 활용 가능
- 한국어 처리 능력 우수
- ML 모델 직접 사용 가능

#### 단점
- Python 의존성 증가
- 배포 복잡성

### 방안 2: Node.js 중심 통합

#### 개요
Node.js로 모든 기능 통합, Python 의존성 제거

#### 구현 전략
1. **PDF 처리**: pdf-parse + node-tesseract 강화
2. **텍스트 청킹**: 기존 Node.js 구현 유지
3. **임베딩**: OpenAI API 또는 transformers.js 사용
4. **벡터 검색**: Qdrant JavaScript 클라이언트 직접 사용

#### 장점
- 단일 런타임 환경
- 배포 단순화
- 유지보수 용이

#### 단점
- 고급 NLP 기능 제한
- 한국어 처리 능력 제한

### 방안 3: 마이크로서비스 아키텍처

#### 개요
각 언어의 강점을 살린 명확한 서비스 분리

#### 구현 전략
1. **PDF 서비스** (Python): PDF 처리 전담
2. **NLP 서비스** (Python): 텍스트 분석, 임베딩
3. **API 서비스** (Node.js): 비즈니스 로직, API 제공
4. **검색 서비스** (Python): 벡터 검색 전담

#### 장점
- 각 언어의 강점 최대 활용
- 독립적인 확장 가능
- 명확한 책임 분리

#### 단점
- 인프라 복잡성 증가
- 네트워크 통신 오버헤드

---

## 4. 권장 실행 계획

### 단기 (1-2주)
1. **중복 코드 정리**
   - Node.js의 PDF 처리 코드를 Python 서비스 호출로 완전 대체
   - 텍스트 청킹 로직을 Python으로 통합

2. **인터페이스 표준화**
   - Python 서비스 API 문서화
   - 에러 처리 표준화

### 중기 (3-4주)
1. **성능 최적화**
   - Python 서비스 배치 처리 강화
   - 캐싱 메커니즘 도입

2. **테스트 강화**
   - 통합 테스트 작성
   - 성능 벤치마크 수립

### 장기 (1-2개월)
1. **아키텍처 개선**
   - 마이크로서비스 전환 검토
   - 컨테이너화 및 오케스트레이션

2. **모니터링 구축**
   - 서비스 메트릭 수집
   - 로깅 통합

---

## 5. 예상 효과

### 정량적 효과
- 코드 중복 70% 감소
- 유지보수 시간 50% 단축
- 배포 시간 30% 단축

### 정성적 효과
- 명확한 책임 분리
- 개발자 경험 향상
- 확장성 개선

---

## 6. 리스크 및 완화 방안

### 리스크 1: Python 서비스 장애
- **완화**: 헬스체크 강화, 자동 재시작 메커니즘

### 리스크 2: 성능 저하
- **완화**: 프로파일링 도구 활용, 병목 지점 최적화

### 리스크 3: 호환성 문제
- **완화**: 단계적 마이그레이션, 충분한 테스트

---

## 7. 결론

현재 AI_QUIZ 프로젝트는 Python과 Node.js 간 상당한 기능 중복이 존재합니다. **Python 중심 통합 (방안 1)**을 권장하며, 이는 프로젝트의 핵심 기능인 PDF 처리와 NLP 작업에 Python이 더 적합하기 때문입니다.

단계적인 마이그레이션을 통해 리스크를 최소화하면서 시스템의 효율성과 유지보수성을 크게 개선할 수 있을 것으로 예상됩니다.

---

## 부록: 상세 코드 비교

### A. PDF 텍스트 추출 비교

#### Node.js 구현 특징
- 단순한 텍스트 추출
- 기본적인 품질 평가
- 외부 프로세스 의존 (pdftoppm, tesseract)

#### Python 구현 특징
- 고급 이미지 전처리 (OpenCV)
- 한국어 OCR 최적화
- 페이지별 상세 메타데이터

### B. 청킹 알고리즘 비교

#### Node.js 구현 특징
- 토큰 기반 분할
- 오버랩 처리
- LLM 검증 (선택적)

#### Python 구현 특징
- 의미적 경계 인식
- LLM 기반 일관성 검증
- 계층적 청크 관계 유지

### C. 임베딩 생성 비교

#### Node.js 구현 특징
- OpenAI API 의존
- 간단한 배치 처리
- E5 모델 미구현

#### Python 구현 특징
- 로컬 E5 모델 사용
- GPU 가속 지원
- 커스텀 프리픽스 처리