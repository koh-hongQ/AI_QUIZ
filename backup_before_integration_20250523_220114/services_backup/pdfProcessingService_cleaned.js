// Python 서비스 중심으로 통합된 PDF 처리 서비스
// 기존 API는 그대로 유지하면서 Python 서비스만 사용

import PdfProcessorService from './python_bridge/pdfProcessorService.js';
import EmbeddingService from './python_bridge/embeddingService.js';
import VectorSearchService from './python_bridge/vectorSearchService.js';
import config from '../config/pythonServiceConfig.js';

/**
 * PDF Processing Service - Python 중심 통합 버전
 * 모든 처리는 Python 서비스를 통해 수행
 */
class PDFProcessingService {
  constructor() {
    this.pdfProcessor = new PdfProcessorService();
    this.embeddingService = new EmbeddingService();
    this.vectorSearchService = new VectorSearchService();
  }

  /**
   * PDF 처리 완전 파이프라인 - API 인터페이스는 그대로 유지
   */
  async processPDFComplete(filePath, documentId) {
    try {
      console.log(`Starting PDF processing pipeline for ${documentId}`);
      
      // 1. Python으로 PDF 처리 (추출, 정제, 청킹을 한번에)
      const pdfProcessResult = await this.pdfProcessor.processPdf(filePath, {
        useLLMCleaning: config.pdfProcessing.useLLMCleaning,
        validateChunks: config.pdfProcessing.validateChunks,
        targetChunkSize: config.pdfProcessing.targetChunkSize
      });

      if (!pdfProcessResult.success) {
        throw new Error('PDF processing failed');
      }

      console.log(`Extracted ${pdfProcessResult.chunks.length} chunks from PDF`);

      // 2. Python으로 임베딩 생성
      console.log('Generating embeddings for chunks...');
      const chunksWithEmbeddings = await this.embeddingService.generateChunkEmbeddings(
        pdfProcessResult.chunks
      );

      // 3. Python으로 벡터 DB 저장
      console.log('Storing chunks in vector database...');
      const storeResult = await this.vectorSearchService.storeChunkEmbeddings(
        documentId,
        chunksWithEmbeddings
      );

      if (!storeResult) {
        throw new Error('Failed to store chunks in vector database');
      }

      return {
        success: true,
        documentId,
        processing: {
          pageCount: pdfProcessResult.extractResult.pageCount,
          chunkCount: chunksWithEmbeddings.length,
          processingOptions: pdfProcessResult.processing_options
        },
        timestamps: {
          started: new Date().toISOString(),
          completed: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`PDF processing failed for ${documentId}:`, error);
      return {
        success: false,
        error: error.message,
        documentId
      };
    }
  }

  /**
   * 텍스트 추출만 - Python 서비스 사용
   */
  async extractTextFromPdf(filePath) {
    return await this.pdfProcessor.extractTextFromPdf(filePath);
  }

  /**
   * 처리 상태 조회 - 기존 API 인터페이스 유지
   */
  async getProcessingStatus(documentId) {
    try {
      const collectionInfo = await this.vectorSearchService.getCollectionInfo();
      
      return {
        documentId,
        status: 'completed',
        progress: 100,
        stages: [
          { id: 'uploading', status: 'completed' },
          { id: 'extracting', status: 'completed' },
          { id: 'cleaning', status: 'completed' },
          { id: 'chunking', status: 'completed' },
          { id: 'embedding', status: 'completed' },
          { id: 'storing', status: 'completed' }
        ]
      };
    } catch (error) {
      return {
        documentId,
        status: 'error',
        error: error.message
      };
    }
  }
}

export default new PDFProcessingService();
