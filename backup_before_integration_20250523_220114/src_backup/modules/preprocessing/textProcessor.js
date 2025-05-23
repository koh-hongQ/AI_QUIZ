/**
 * Text Processing and Cleaning
 * Handles text normalization and LLM-based text correction
 */
import { Logger } from '../../utils/logger.js';
import { LLMService } from '../quiz/llmService.js';

export class TextProcessor {
  constructor() {
    this.logger = new Logger('TextProcessor');
    this.llmService = new LLMService();
  }

  /**
   * Process and clean extracted text
   * @param {string} rawText - Raw text extracted from PDF
   * @returns {Promise<string>} Cleaned and corrected text
   */
  async processText(rawText) {
    try {
      this.logger.info('Processing and cleaning text');
      
      // Step 1: Basic text cleaning
      let cleanedText = this.basicTextCleaning(rawText);
      
      // Step 2: LLM-based text correction (if available)
      if (this.llmService.isAvailable()) {
        try {
          cleanedText = await this.llmTextCorrection(cleanedText);
        } catch (error) {
          this.logger.error(`LLM text correction failed: ${error.message}`);
          // Continue with basic cleaned text if LLM fails
        }
      }
      
      return cleanedText;
    } catch (error) {
      this.logger.error(`Error processing text: ${error.message}`);
      throw error;
    }
  }

  /**
   * Basic text cleaning and normalization
   * @private
   */
  basicTextCleaning(text) {
    if (!text) return '';
    
    return text
      // Remove form feed characters
      .replace(/\f/g, '')
      // Normalize line endings
      .replace(/\r\n|\r/g, '\n')
      // Remove excessive whitespace
      .replace(/[ \t]+/g, ' ')
      // Normalize multiple blank lines
      .replace(/\n{3,}/g, '\n\n')
      // Replace bullets with dashes
      .replace(/•/g, '- ')
      // Fix common OCR issues
      .replace(/\b(\d+)\s*\.\s*(\d+)\b/g, '$1.$2') // Fix split numbers
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between lowercase and uppercase
      // Remove extra spaces around punctuation
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.;:!?])\s+/g, '$1 ')
      // Trim and ensure single space between words
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * LLM-based text correction
   * @private
   */
  async llmTextCorrection(text) {
    const prompt = this.generateCorrectionPrompt(text);
    
    try {
      const correctedText = await this.llmService.generateResponse(prompt, {
        maxTokens: Math.min(4000, text.length + 500),
        temperature: 0.3
      });
      
      return correctedText;
    } catch (error) {
      this.logger.error(`LLM correction error: ${error.message}`);
      return text; // Return original text if correction fails
    }
  }

  /**
   * Generate prompt for text correction
   * @private
   */
  generateCorrectionPrompt(text) {
    // Limit text length for prompt
    const maxLength = 2000;
    const textSample = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    
    return `Please clean and correct the following text that was extracted from a PDF. Fix any OCR errors, normalize formatting, and ensure proper spacing and punctuation. Maintain the original meaning and structure:

${textSample}

Cleaned text:`;
  }

  /**
   * Split text into manageable chunks for LLM processing
   * @private
   */
  splitTextForLLM(text, chunkSize = 2000) {
    const chunks = [];
    const sentences = text.split(/[.!?]+/);
    
    let currentChunk = '';
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim() + '.');
        currentChunk = sentence;
      } else {
        currentChunk += sentence + '.';
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
}
