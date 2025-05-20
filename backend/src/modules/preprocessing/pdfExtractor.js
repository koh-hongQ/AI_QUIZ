/**
 * PDF Text Extractor
 * Handles text extraction from PDF files using PyMuPDF and Tesseract OCR
 */
import fs from 'fs';
import pdfParse from 'pdf-parse';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../../utils/logger.js';

export class PDFExtractor {
  constructor() {
    this.logger = new Logger('PDFExtractor');
  }

  /**
   * Extract text from PDF file
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<Object>} Extracted text and metadata
   */
  async extractText(filePath) {
    try {
      this.logger.info(`Extracting text from: ${filePath}`);
      
      // Primary extraction using pdf-parse
      const primaryResult = await this.extractWithPdfParse(filePath);
      
      // If primary extraction yields poor results, try OCR
      if (this.needsOCR(primaryResult.text)) {
        this.logger.info('Text quality low, attempting OCR extraction');
        const ocrResult = await this.extractWithOCR(filePath);
        return ocrResult || primaryResult;
      }
      
      return primaryResult;
    } catch (error) {
      this.logger.error(`Error extracting text: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract text using pdf-parse library
   * @private
   */
  async extractWithPdfParse(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    return {
      text: pdfData.text,
      pageCount: pdfData.numpages,
      metadata: pdfData.info,
      method: 'pdf-parse'
    };
  }

  /**
   * Extract text using OCR (Tesseract)
   * @private
   */
  async extractWithOCR(filePath) {
    try {
      // Convert PDF to images using pdftoppm (poppler-utils)
      const imageFiles = await this.convertPdfToImages(filePath);
      
      // Extract text from each image using Tesseract
      let combinedText = '';
      for (const imagePath of imageFiles) {
        const text = await this.extractTextFromImage(imagePath);
        combinedText += text + '\n\n';
        
        // Clean up temporary image file
        fs.unlinkSync(imagePath);
      }
      
      return {
        text: combinedText,
        pageCount: imageFiles.length,
        metadata: {},
        method: 'ocr'
      };
    } catch (error) {
      this.logger.error(`OCR extraction failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Convert PDF to images
   * @private
   */
  async convertPdfToImages(filePath) {
    return new Promise((resolve, reject) => {
      const outputPrefix = `${filePath}_page`;
      const args = ['-png', filePath, outputPrefix];
      
      const process = spawn('pdftoppm', args);
      
      process.on('close', (code) => {
        if (code === 0) {
          // Find generated image files
          const imageFiles = [];
          let pageNum = 1;
          
          while (fs.existsSync(`${outputPrefix}-${pageNum}.png`)) {
            imageFiles.push(`${outputPrefix}-${pageNum}.png`);
            pageNum++;
          }
          
          resolve(imageFiles);
        } else {
          reject(new Error(`pdftoppm exited with code ${code}`));
        }
      });
      
      process.on('error', reject);
    });
  }

  /**
   * Extract text from image using Tesseract
   * @private
   */
  async extractTextFromImage(imagePath) {
    return new Promise((resolve, reject) => {
      const process = spawn('tesseract', [imagePath, '-', '-l', 'eng']);
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Tesseract exited with code ${code}`));
        }
      });
      
      process.on('error', reject);
    });
  }

  /**
   * Check if text quality is poor and needs OCR
   * @private
   */
  needsOCR(text) {
    if (!text || text.length < 100) return true;
    
    // Check for excessive special characters or gibberish
    const specialCharRatio = (text.match(/[^\w\s]/g) || []).length / text.length;
    if (specialCharRatio > 0.5) return true;
    
    // Check for actual words
    const words = text.match(/\b[a-zA-Z]{2,}\b/g) || [];
    const wordDensity = words.length / text.split(/\s+/).length;
    if (wordDensity < 0.5) return true;
    
    return false;
  }
}
