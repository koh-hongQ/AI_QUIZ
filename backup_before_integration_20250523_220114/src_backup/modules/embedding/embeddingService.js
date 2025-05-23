/**
 * Embedding Service using E5 model
 * Handles text embedding generation and vector operations
 */
import { Config } from '../../core/config.js';
import { Logger } from '../../utils/logger.js';
import { LLMService } from '../quiz/llmService.js';

export class EmbeddingService {
  constructor() {
    this.logger = new Logger('EmbeddingService');
    this.config = Config.EMBEDDING_MODEL;
    this.llmService = new LLMService();
    
    // For now, using OpenAI embeddings as E5 requires local inference
    // In production, this would use a local E5 model deployment
    this.useOpenAIFallback = true;
  }

  /**
   * Generate embeddings for text chunks
   * @param {Array<Object>} chunks - Array of text chunks with metadata
   * @returns {Promise<Array<Object>>} Chunks with embeddings added
   */
  async generateEmbeddings(chunks) {
    try {
      this.logger.info(`Generating embeddings for ${chunks.length} chunks`);
      
      const embeddedChunks = [];
      
      // Process chunks in batches to avoid API limits
      const batchSize = 100;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchEmbeddings = await this.processBatch(batch);
        embeddedChunks.push(...batchEmbeddings);
        
        this.logger.debug(`Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);
      }
      
      this.logger.success(`Generated embeddings for all ${chunks.length} chunks`);
      return embeddedChunks;
    } catch (error) {
      this.logger.error('Failed to generate embeddings', error);
      throw error;
    }
  }

  /**
   * Process a batch of chunks for embeddings
   * @private
   * @param {Array<Object>} batch - Batch of chunks to process
   * @returns {Promise<Array<Object>>} Processed chunks with embeddings
   */
  async processBatch(batch) {
    try {
      // Prepare texts for embedding
      const texts = batch.map(chunk => this.prepareTextForEmbedding(chunk.content));
      
      // Generate embeddings
      let embeddings;
      if (this.useOpenAIFallback) {
        embeddings = await this.llmService.createEmbeddings(texts);
      } else {
        embeddings = await this.generateE5Embeddings(texts);
      }
      
      // Combine chunks with their embeddings
      return batch.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
        embeddingModel: this.useOpenAIFallback ? 'text-embedding-ada-002' : this.config.name,
        embeddingDimensions: embeddings[index].length
      }));
    } catch (error) {
      this.logger.error('Failed to process batch', error);
      throw error;
    }
  }

  /**
   * Prepare text for embedding according to E5 model requirements
   * @private
   * @param {string} text - Raw text
   * @returns {string} Prepared text with appropriate prefix
   */
  prepareTextForEmbedding(text) {
    // E5 model requires specific prefixes for different types of text
    // For document chunks, we use the 'passage' prefix
    const prefix = this.config.prefix.passage;
    
    // Truncate text if it exceeds model limits
    const maxLength = this.config.maxTokens * 4; // Rough estimate: 1 token ≈ 4 characters
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;
    
    return prefix + truncatedText;
  }

  /**
   * Generate embeddings using E5 model (placeholder for local inference)
   * @private
   * @param {Array<string>} texts - Texts to embed
   * @returns {Promise<Array<Array<number>>>} Embedding vectors
   */
  async generateE5Embeddings(texts) {
    // This is a placeholder for actual E5 model inference
    // In a real implementation, this would:
    // 1. Load the E5 model using transformers.js or similar
    // 2. Process texts through the model
    // 3. Return normalized embeddings
    
    throw new Error('E5 model inference not implemented. Use OpenAI fallback.');
  }

  /**
   * Generate query embedding with appropriate prefix
   * @param {string} query - Search query
   * @returns {Promise<Array<number>>} Query embedding vector
   */
  async generateQueryEmbedding(query) {
    try {
      this.logger.debug('Generating query embedding', { queryLength: query.length });
      
      // Prepare query with appropriate prefix
      const prefix = this.config.prefix.query;
      const preparedQuery = prefix + query;
      
      let embedding;
      if (this.useOpenAIFallback) {
        const embeddings = await this.llmService.createEmbeddings([preparedQuery]);
        embedding = embeddings[0];
      } else {
        const embeddings = await this.generateE5Embeddings([preparedQuery]);
        embedding = embeddings[0];
      }
      
      this.logger.debug('Query embedding generated', { dimensions: embedding.length });
      return embedding;
    } catch (error) {
      this.logger.error('Failed to generate query embedding', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array<number>} vector1 - First vector
   * @param {Array<number>} vector2 - Second vector
   * @returns {number} Cosine similarity score (-1 to 1)
   */
  cosineSimilarity(vector1, vector2) {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (norm1 * norm2);
  }

  /**
   * Find most similar chunks to a query
   * @param {Array<number>} queryEmbedding - Query embedding vector
   * @param {Array<Object>} chunks - Chunks with embeddings
   * @param {number} topK - Number of similar chunks to return
   * @returns {Array<Object>} Most similar chunks with similarity scores
   */
  findSimilarChunks(queryEmbedding, chunks, topK = 5) {
    const similarities = chunks.map(chunk => ({
      ...chunk,
      similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding)
    }));
    
    // Sort by similarity in descending order
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // Return top K results
    return similarities.slice(0, topK);
  }

  /**
   * Get embedding statistics
   * @param {Array<Object>} embeddedChunks - Chunks with embeddings
   * @returns {Object} Statistics about embeddings
   */
  getEmbeddingStats(embeddedChunks) {
    if (embeddedChunks.length === 0) {
      return { count: 0 };
    }
    
    const dimensions = embeddedChunks[0].embeddingDimensions;
    const models = [...new Set(embeddedChunks.map(chunk => chunk.embeddingModel))];
    
    return {
      count: embeddedChunks.length,
      dimensions,
      models,
      avgTokenCount: embeddedChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / embeddedChunks.length
    };
  }
}
