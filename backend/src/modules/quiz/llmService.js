/**
 * LLM Service for OpenAI API integration
 */
import OpenAI from 'openai';
import { Config } from '../../core/config.js';
import { Logger } from '../../utils/logger.js';

export class LLMService {
  constructor() {
    this.logger = new Logger('LLMService');
    this.openai = null;
    this.config = Config.LLM_CONFIG;
    this.initializeClient();
  }

  /**
   * Initialize OpenAI client
   * @private
   */
  initializeClient() {
    try {
      if (!Config.OPENAI_API_KEY) {
        this.logger.warn('OpenAI API key not provided, LLM service unavailable');
        return;
      }

      this.openai = new OpenAI({
        apiKey: Config.OPENAI_API_KEY,
      });

      this.logger.info('LLM service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize LLM service', error);
    }
  }

  /**
   * Check if LLM service is available
   */
  isAvailable() {
    return this.openai !== null;
  }

  /**
   * Generate response using OpenAI API
   * @param {string} prompt - The prompt to send to LLM
   * @param {Object} options - Additional options for the API call
   * @returns {Promise<string>} Generated response
   */
  async generateResponse(prompt, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('LLM service is not available');
    }

    const settings = {
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options.maxTokens || this.config.maxTokens,
      temperature: options.temperature || this.config.temperature,
      ...options
    };

    try {
      this.logger.debug('Generating LLM response', { 
        model: settings.model,
        promptLength: prompt.length,
        maxTokens: settings.max_tokens 
      });

      const response = await this.openai.chat.completions.create(settings);
      
      const generatedText = response.choices[0].message.content;
      
      this.logger.debug('LLM response generated', {
        responseLength: generatedText.length,
        tokensUsed: response.usage?.total_tokens || 'unknown'
      });

      return generatedText;
    } catch (error) {
      this.logger.error('Failed to generate LLM response', error);
      throw error;
    }
  }

  /**
   * Generate multiple responses in parallel
   * @param {Array<string>} prompts - Array of prompts
   * @param {Object} options - Options for each request
   * @returns {Promise<Array<string>>} Array of responses
   */
  async generateBatchResponses(prompts, options = {}) {
    const batchPromises = prompts.map(prompt => 
      this.generateResponse(prompt, options)
    );

    try {
      const responses = await Promise.all(batchPromises);
      this.logger.info(`Generated ${responses.length} batch responses`);
      return responses;
    } catch (error) {
      this.logger.error('Failed to generate batch responses', error);
      throw error;
    }
  }

  /**
   * Create embeddings for text
   * @param {string|Array<string>} input - Text or array of texts to embed
   * @param {string} model - Embedding model to use
   * @returns {Promise<Array<number[]>>} Embedding vectors
   */
  async createEmbeddings(input, model = 'text-embedding-ada-002') {
    if (!this.isAvailable()) {
      throw new Error('LLM service is not available');
    }

    try {
      this.logger.debug('Creating embeddings', { 
        model,
        inputType: Array.isArray(input) ? 'array' : 'string',
        inputLength: Array.isArray(input) ? input.length : input.length
      });

      const response = await this.openai.embeddings.create({
        model,
        input
      });

      const embeddings = response.data.map(item => item.embedding);
      
      this.logger.debug('Embeddings created', {
        count: embeddings.length,
        dimensions: embeddings[0]?.length || 0
      });

      return embeddings;
    } catch (error) {
      this.logger.error('Failed to create embeddings', error);
      throw error;
    }
  }

  /**
   * Moderate content using OpenAI moderation API
   * @param {string} input - Text to moderate
   * @returns {Promise<Object>} Moderation result
   */
  async moderateContent(input) {
    if (!this.isAvailable()) {
      throw new Error('LLM service is not available');
    }

    try {
      const response = await this.openai.moderations.create({
        input
      });

      const result = response.results[0];
      
      this.logger.debug('Content moderated', {
        flagged: result.flagged,
        categories: Object.keys(result.categories).filter(cat => result.categories[cat])
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to moderate content', error);
      throw error;
    }
  }

  /**
   * Estimate token count for text (approximate)
   * @param {string} text - Text to count tokens for
   * @returns {number} Estimated token count
   */
  estimateTokenCount(text) {
    // Rough approximation: 1 token ≈ 0.75 words
    const words = text.split(/\s+/).length;
    return Math.ceil(words / 0.75);
  }

  /**
   * Split text to fit token limits
   * @param {string} text - Text to split
   * @param {number} maxTokens - Maximum tokens per chunk
   * @returns {Array<string>} Array of text chunks
   */
  splitTextByTokens(text, maxTokens = 4000) {
    const chunks = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (this.estimateTokenCount(testChunk) > maxTokens && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk = testChunk;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}
