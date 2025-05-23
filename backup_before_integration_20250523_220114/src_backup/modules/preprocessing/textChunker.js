/**
 * Text Chunking Module
 * Handles intelligent text segmentation and chunk validation
 */
import { Logger } from '../../utils/logger.js';
import { Config } from '../../core/config.js';
import { LLMService } from '../quiz/llmService.js';

export class TextChunker {
  constructor() {
    this.logger = new Logger('TextChunker');
    this.llmService = new LLMService();
    this.chunkConfig = Config.CHUNK_CONFIG;
  }

  /**
   * Create chunks from processed text
   * @param {string} text - Cleaned text to chunk
   * @param {number} pageCount - Number of pages in the document
   * @returns {Promise<Array>} Array of text chunks with metadata
   */
  async createChunks(text, pageCount) {
    try {
      this.logger.info('Creating text chunks');
      
      // Split by semantic boundaries (paragraphs, sections)
      const initialChunks = this.semanticChunking(text);
      
      // Optimize chunk sizes
      const optimizedChunks = this.optimizeChunkSizes(initialChunks);
      
      // Add metadata to chunks
      const chunksWithMetadata = this.addMetadata(optimizedChunks, pageCount);
      
      // Validate chunks with LLM if available
      if (this.llmService.isAvailable()) {
        return await this.validateChunks(chunksWithMetadata);
      }
      
      return chunksWithMetadata;
    } catch (error) {
      this.logger.error(`Error creating chunks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Split text by semantic boundaries
   * @private
   */
  semanticChunking(text) {
    // Split by double newlines (paragraphs) first
    let paragraphs = text.split(/\n\s*\n/);
    
    // Further split by section headers if present
    const chunks = [];
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;
      
      // Check if paragraph contains section headers
      const headerMatch = paragraph.match(/^(#{1,6}.*|[A-Z][^.]*:|\d+\.\s*[A-Z].*)/);
      
      if (headerMatch && chunks.length > 0) {
        // Start a new chunk at section headers
        chunks.push(paragraph.trim());
      } else if (chunks.length > 0) {
        // Add to existing chunk
        chunks[chunks.length - 1] += '\n\n' + paragraph.trim();
      } else {
        // First chunk
        chunks.push(paragraph.trim());
      }
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Optimize chunk sizes based on token limits
   * @private
   */
  optimizeChunkSizes(chunks) {
    const optimized = [];
    const maxTokens = this.chunkConfig.maxTokens;
    const minTokens = this.chunkConfig.minTokens;
    const overlap = this.chunkConfig.overlap;
    
    for (const chunk of chunks) {
      const tokenCount = this.estimateTokenCount(chunk);
      
      if (tokenCount <= maxTokens && tokenCount >= minTokens) {
        // Chunk is already optimal size
        optimized.push(chunk);
      } else if (tokenCount > maxTokens) {
        // Split large chunks
        const splitChunks = this.splitLargeChunk(chunk, maxTokens, overlap);
        optimized.push(...splitChunks);
      } else if (tokenCount < minTokens && optimized.length > 0) {
        // Merge small chunks with previous chunk
        const lastChunk = optimized[optimized.length - 1];
        const mergedTokenCount = this.estimateTokenCount(lastChunk + '\n\n' + chunk);
        
        if (mergedTokenCount <= maxTokens) {
          optimized[optimized.length - 1] = lastChunk + '\n\n' + chunk;
        } else {
          optimized.push(chunk);
        }
      } else {
        // Keep small chunks if they're the first chunk
        optimized.push(chunk);
      }
    }
    
    return optimized;
  }

  /**
   * Split a large chunk into smaller pieces
   * @private
   */
  splitLargeChunk(chunk, maxTokens, overlap) {
    const sentences = chunk.split(/(?<=[.!?])\s+/);
    const chunks = [];
    let currentChunk = '';
    let overlapBuffer = '';
    
    for (const sentence of sentences) {
      const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (this.estimateTokenCount(testChunk) > maxTokens && currentChunk) {
        // Add overlap from previous chunk
        if (overlapBuffer) {
          chunks.push(overlapBuffer + ' ' + currentChunk);
        } else {
          chunks.push(currentChunk);
        }
        
        // Create overlap for next chunk
        const overlapSentences = currentChunk.split(/(?<=[.!?])\s+/).slice(-Math.ceil(overlap / 10));
        overlapBuffer = overlapSentences.join(' ');
        
        currentChunk = sentence;
      } else {
        currentChunk = testChunk;
      }
    }
    
    if (currentChunk) {
      if (overlapBuffer) {
        chunks.push(overlapBuffer + ' ' + currentChunk);
      } else {
        chunks.push(currentChunk);
      }
    }
    
    return chunks;
  }

  /**
   * Add metadata to chunks
   * @private
   */
  addMetadata(chunks, pageCount) {
    const estimatedTokensPerPage = chunks.reduce((total, chunk) => {
      return total + this.estimateTokenCount(chunk);
    }, 0) / pageCount;
    
    return chunks.map((chunk, index) => {
      const tokenCount = this.estimateTokenCount(chunk);
      const estimatedPage = Math.ceil((index * tokenCount) / estimatedTokensPerPage);
      
      return {
        content: chunk,
        index,
        tokenCount,
        pageNumber: Math.min(estimatedPage || 1, pageCount),
        chunkId: `chunk_${index}_${Date.now()}`
      };
    });
  }

  /**
   * Validate chunks with LLM
   * @private
   */
  async validateChunks(chunks) {
    this.logger.info('Validating chunks with LLM');
    
    try {
      // Process chunks in batches to avoid overwhelming the LLM
      const batchSize = 5;
      const validatedChunks = [];
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const validatedBatch = await this.validateChunkBatch(batch);
        validatedChunks.push(...validatedBatch);
      }
      
      return validatedChunks;
    } catch (error) {
      this.logger.error(`Chunk validation failed: ${error.message}`);
      // Return original chunks if validation fails
      return chunks;
    }
  }

  /**
   * Validate a batch of chunks
   * @private
   */
  async validateChunkBatch(chunks) {
    const prompt = this.generateValidationPrompt(chunks);
    
    try {
      const response = await this.llmService.generateResponse(prompt, {
        maxTokens: 2000,
        temperature: 0.3
      });
      
      // Parse LLM response and apply suggestions
      return this.applyValidationResults(chunks, response);
    } catch (error) {
      this.logger.error(`Batch validation error: ${error.message}`);
      return chunks;
    }
  }

  /**
   * Generate validation prompt for chunks
   * @private
   */
  generateValidationPrompt(chunks) {
    const chunkSummaries = chunks.map((chunk, index) => 
      `Chunk ${index + 1}: ${chunk.content.substring(0, 100)}...`
    ).join('\n\n');
    
    return `Please analyze the following text chunks and suggest improvements for semantic coherence. Each chunk should contain complete thoughts or concepts. Suggest if chunks should be merged, split, or content reorganized:

${chunkSummaries}

Please respond with specific suggestions for each chunk in JSON format:
{
  "chunks": [
    {
      "index": 1,
      "action": "keep|merge|split|modify",
      "suggestion": "explanation of the suggestion",
      "mergeWith": null // if merge action
    }
  ]
}`;
  }

  /**
   * Apply validation results to chunks
   * @private
   */
  applyValidationResults(chunks, validationResponse) {
    try {
      // Try to parse LLM response as JSON
      const validation = JSON.parse(validationResponse);
      
      if (!validation.chunks || !Array.isArray(validation.chunks)) {
        return chunks; // Return original if response format is incorrect
      }
      
      // Apply suggestions (simplified implementation)
      // In a full implementation, you would apply merge/split operations
      // For now, we'll just log the suggestions
      validation.chunks.forEach(suggestion => {
        this.logger.info(`Chunk ${suggestion.index}: ${suggestion.action} - ${suggestion.suggestion}`);
      });
      
      return chunks;
    } catch (error) {
      this.logger.error(`Error parsing validation results: ${error.message}`);
      return chunks;
    }
  }

  /**
   * Estimate token count for text (rough approximation)
   * @private
   */
  estimateTokenCount(text) {
    // Rough estimation: 1 token ≈ 0.75 words
    const words = text.split(/\s+/).length;
    return Math.ceil(words / 0.75);
  }
}
