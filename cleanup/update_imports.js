#!/usr/bin/env node

/**
 * Import 문 업데이트 스크립트
 * 삭제된 JS 모듈 대신 Python 브릿지 서비스를 사용하도록 수정
 */

import fs from 'fs/promises';
import path from 'path';

const filesToUpdate = [
  // 퀴즈 생성 서비스
  {
    path: '/home/changeroa/projects/AI_QUIZ/backend/services/quizGenerationService.js',
    replacements: [
      {
        from: /import.*TextProcessor.*from.*textProcessor/g,
        to: "// Text processing now handled by Python service"
      },
      {
        from: /import.*EmbeddingService.*from.*embeddingService/g,
        to: "import EmbeddingService from './python_bridge/embeddingService.js';"
      }
    ]
  },
  // 벡터 검색 서비스
  {
    path: '/home/changeroa/projects/AI_QUIZ/backend/services/vectorSearchService.js',
    replacements: [
      {
        from: /import.*embeddingService.*from.*'\.\.\/src\/modules\/embedding\/embeddingService\.js'/g,
        to: "import EmbeddingService from './python_bridge/embeddingService.js';"
      }
    ]
  },
  // 퀴즈 컨트롤러
  {
    path: '/home/changeroa/projects/AI_QUIZ/backend/controllers/quizController.js',
    replacements: [
      {
        from: /import.*pdfProcessingService/g,
        to: "import pdfProcessingService from '../services/pdfProcessingService.js';"
      }
    ]
  }
];

async function updateImports() {
  console.log('📝 Updating import statements...\n');
  
  for (const file of filesToUpdate) {
    try {
      // 파일 읽기
      let content = await fs.readFile(file.path, 'utf-8');
      let modified = false;
      
      // 각 교체 규칙 적용
      for (const replacement of file.replacements) {
        if (replacement.from.test(content)) {
          content = content.replace(replacement.from, replacement.to);
          modified = true;
          console.log(`✅ Updated imports in: ${path.basename(file.path)}`);
        }
      }
      
      // 수정된 경우 파일 저장
      if (modified) {
        // 백업 생성
        await fs.writeFile(file.path + '.backup', content);
        // 업데이트된 내용 저장
        await fs.writeFile(file.path, content);
      }
      
    } catch (error) {
      console.error(`❌ Error updating ${file.path}:`, error.message);
    }
  }
  
  console.log('\n✨ Import updates completed!');
}

// 실행
updateImports().catch(console.error);
