import PythonBridge from './pythonBridge.js';

/**
 * PDF Processor Service - Bridge to Python PDF processing
 */
class PdfProcessorService extends PythonBridge {
  /**
   * Extract text from PDF using PyMuPDF/Tesseract
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<Object>} - Extracted text and metadata
   */
  async extractTextFromPdf(filePath) {
    try {
      const result = await this.executePythonScript(
        'pdf_processor/pdf_extractor.py',
        [filePath]
      );

      if (!result.extracted_successfully) {
        throw new Error(result.error || 'PDF extraction failed');
      }

      return result;
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Clean extracted text using LLM
   * @param {string} text - Raw text to clean
   * @param {boolean} useLLM - Whether to use LLM for cleaning
   * @returns {Promise<string>} - Cleaned text
   */
  async cleanText(text, useLLM = false) {
    try {
      const args = [text];
      if (useLLM) {
        args.push('--use-llm');
      }

      const result = await this.executePythonScript(
        'pdf_processor/text_cleaner.py',
        args
      );

      return result.cleaned_text;
    } catch (error) {
      throw new Error(`Text cleaning failed: ${error.message}`);
    }
  }

  /**
   * Create chunks from cleaned text
   * @param {string} text - Cleaned text
   * @param {number} pageCount - Number of pages
   * @param {boolean} validate - Whether to validate chunks with LLM
   * @returns {Promise<Array>} - Array of chunks
   */
  async createChunks(text, pageCount, validate = false) {
    try {
      const args = [text, pageCount.toString()];
      if (validate) {
        args.push('--validate');
      }

      const result = await this.executePythonScript(
        'pdf_processor/chunk_creator.py',
        args
      );

      return result.chunks;
    } catch (error) {
      throw new Error(`Chunk creation failed: ${error.message}`);
    }
  }

  /**
   * Complete PDF processing pipeline
   * @param {string} filePath - Path to PDF file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processing results
   */
  async processPdf(filePath, options = {}) {
    const {
      useLLMCleaning = false,
      validateChunks = false,
      targetChunkSize = 500
    } = options;

    try {
      // 1. Extract text from PDF
      console.log('Extracting text from PDF...');
      const extractResult = await this.extractTextFromPdf(filePath);

      // 2. Clean the extracted text
      console.log('Cleaning extracted text...');
      const cleanedText = await this.cleanText(extractResult.text, useLLMCleaning);

      // 3. Create chunks
      console.log('Creating chunks...');
      const chunks = await this.createChunks(cleanedText, extractResult.pageCount, validateChunks);

      return {
        success: true,
        extractResult,
        cleanedText,
        chunks,
        processing_options: {
          useLLMCleaning,
          validateChunks,
          targetChunkSize
        }
      };
    } catch (error) {
      throw new Error(`PDF processing pipeline failed: ${error.message}`);
    }
  }
}

export default PdfProcessorService;
