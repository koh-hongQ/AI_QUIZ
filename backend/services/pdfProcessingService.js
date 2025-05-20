import PdfProcessorService from './python_bridge/pdfProcessorService.js';
import EmbeddingService from './python_bridge/embeddingService.js';
import VectorSearchService from './python_bridge/vectorSearchService.js';
import config from '../config/pythonServiceConfig.js';

/**
 * Enhanced PDF Processing Service using Python scripts
 */
class PDFProcessingService {
  constructor() {
    this.pdfProcessor = new PdfProcessorService();
    this.embeddingService = new EmbeddingService();
    this.vectorSearchService = new VectorSearchService();
  }

  /**
   * Process PDF and store embeddings (complete pipeline)
   * @param {string} filePath - Path to PDF file
   * @param {string} documentId - Unique document identifier
   * @returns {Promise<Object>} - Processing results
   */
  async processPDFComplete(filePath, documentId) {
    try {
      console.log(`Starting PDF processing pipeline for ${documentId}`);
      
      // 1. Extract and process PDF
      const pdfProcessResult = await this.pdfProcessor.processPdf(filePath, {
        useLLMCleaning: config.pdfProcessing.useLLMCleaning,
        validateChunks: config.pdfProcessing.validateChunks,
        targetChunkSize: config.pdfProcessing.targetChunkSize
      });

      if (!pdfProcessResult.success) {
        throw new Error('PDF processing failed');
      }

      console.log(`Extracted ${pdfProcessResult.chunks.length} chunks from PDF`);

      // 2. Generate embeddings for chunks
      console.log('Generating embeddings for chunks...');
      const chunksWithEmbeddings = await this.embeddingService.generateChunkEmbeddings(
        pdfProcessResult.chunks
      );

      // 3. Store chunks in vector database
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
   * Extract text from PDF only
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<Object>} - Extracted text and metadata
   */
  async extractTextFromPdf(filePath) {
    return await this.pdfProcessor.extractTextFromPdf(filePath);
  }

  /**
   * Clean extracted text
   * @param {string} text - Raw text to clean
   * @param {boolean} useLLM - Whether to use LLM for cleaning
   * @returns {Promise<string>} - Cleaned text
   */
  async processText(text, useLLM = config.pdfProcessing.useLLMCleaning) {
    return await this.pdfProcessor.cleanText(text, useLLM);
  }

  /**
   * Create chunks from text
   * @param {string} text - Text to chunk
   * @param {number} pageCount - Number of pages
   * @param {boolean} validate - Whether to validate chunks
   * @returns {Promise<Array>} - Array of chunks
   */
  async createChunks(text, pageCount, validate = config.pdfProcessing.validateChunks) {
    return await this.pdfProcessor.createChunks(text, pageCount, validate);
  }

  /**
   * Get processing status for a document
   * @param {string} documentId - Document identifier
   * @returns {Promise<Object>} - Status information
   */
  async getProcessingStatus(documentId) {
    try {
      // Check if chunks exist in vector database
      const collectionInfo = await this.vectorSearchService.getCollectionInfo();
      
      // This is a simplified status check
      // In a real implementation, you'd track processing status in the database
      return {
        documentId,
        status: 'completed', // You can implement more sophisticated status tracking
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