/**
 * Python PDF Processor Integration
 * Calls Python service for PDF processing instead of using Node.js modules
 */
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { Logger } from '../../utils/logger.js';
import { Config } from '../../core/config.js';

export class PythonPDFProcessor {
  constructor() {
    this.logger = new Logger('PythonPDFProcessor');
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
    this.useAPI = process.env.PYTHON_USE_API !== 'false'; // Default to true
  }

  /**
   * Extract text from PDF using Python service
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<Object>} Extracted text and metadata
   */
  async extractText(filePath) {
    if (this.useAPI) {
      return await this.extractViaAPI(filePath);
    } else {
      return await this.extractViaCommand(filePath);
    }
  }

  /**
   * Extract via Python FastAPI service
   * @private
   */
  async extractViaAPI(filePath) {
    try {
      this.logger.info(`Processing PDF via Python API: ${filePath}`);

      // Read file and create form data
      const fileStream = fs.createReadStream(filePath);
      const formData = new FormData();
      formData.append('file', fileStream);
      formData.append('chunk_size', Config.CHUNK_CONFIG.maxTokens.toString());

      // Make API request
      const response = await fetch(`${this.pythonServiceUrl}/process-pdf`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Python service responded with ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Transform to match expected format
      return {
        text: result.chunks.map(chunk => chunk.content).join('\n\n'),
        chunks: result.chunks,
        pageCount: result.page_count,
        metadata: result.metadata,
        method: result.extraction_method,
        processingDetails: {
          pythonService: true,
          chunkCount: result.chunk_count,
          textLength: result.text_length
        }
      };

    } catch (error) {
      this.logger.error(`Python API extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract via Python command line
   * @private
   */
  async extractViaCommand(filePath) {
    try {
      this.logger.info(`Processing PDF via Python command: ${filePath}`);

      const outputFile = `${filePath}.result.json`;
      const pythonScript = './python_services/pdf_processor.py';

      // Execute Python script
      const pythonProcess = spawn('python3', [
        pythonScript,
        filePath,
        '--output', outputFile,
        '--chunk-size', Config.CHUNK_CONFIG.maxTokens.toString()
      ]);

      // Wait for process to complete
      await new Promise((resolve, reject) => {
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Python process exited with code ${code}`));
          }
        });

        pythonProcess.on('error', reject);
      });

      // Read results
      const resultData = fs.readFileSync(outputFile, 'utf8');
      const result = JSON.parse(resultData);

      // Clean up temp file
      fs.unlinkSync(outputFile);

      // Transform to match expected format
      const pdfResult = result.pdf_extraction;
      const textResult = result.text_processing;

      return {
        text: textResult.cleaned_text,
        chunks: textResult.chunks,
        pageCount: pdfResult.page_count,
        metadata: pdfResult.metadata || {},
        method: pdfResult.method,
        processingDetails: {
          pythonService: true,
          chunkCount: textResult.total_chunks
        }
      };

    } catch (error) {
      this.logger.error(`Python command extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if Python service is available
   * @returns {Promise<boolean>}
   */
  async isServiceAvailable() {
    if (!this.useAPI) return true;

    try {
      const response = await fetch(`${this.pythonServiceUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      this.logger.warn('Python service not available:', error.message);
      return false;
    }
  }

  /**
   * Process text only (without PDF extraction)
   * @param {string} text - Raw text to process
   * @returns {Promise<Object>} Processed text and chunks
   */
  async processTextOnly(text) {
    if (!this.useAPI) {
      throw new Error('Text-only processing requires API mode');
    }

    try {
      const response = await fetch(`${this.pythonServiceUrl}/process-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          chunk_size: Config.CHUNK_CONFIG.maxTokens 
        }),
      });

      if (!response.ok) {
        throw new Error(`Python service responded with ${response.status}`);
      }

      const result = await response.json();
      return {
        text: result.cleaned_text,
        chunks: result.chunks,
        processingDetails: {
          pythonService: true,
          chunkCount: result.total_chunks
        }
      };

    } catch (error) {
      this.logger.error(`Python text processing failed: ${error.message}`);
      throw error;
    }
  }
}
