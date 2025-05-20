import VectorSearchService from './python_bridge/vectorSearchService.js';
import EmbeddingService from './python_bridge/embeddingService.js';
import config from '../config/pythonServiceConfig.js';

/**
 * Enhanced Vector Search Service using Python Qdrant integration
 */
class VectorSearchServiceWrapper {
  constructor() {
    this.vectorSearch = new VectorSearchService();
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Store chunk embeddings in Qdrant
   * @param {string} documentId - Document identifier
   * @param {Array} chunks - Chunks with embeddings
   * @returns {Promise<boolean>} - Success status
   */
  async storeChunkEmbeddings(documentId, chunks) {
    return await this.vectorSearch.storeChunkEmbeddings(documentId, chunks);
  }

  /**
   * Search for similar chunks using a text query
   * @param {string} query - Search query text
   * @param {string} [documentId] - Optional document ID filter
   * @param {number} [topK] - Number of results to return
   * @returns {Promise<Array>} - Similar chunks
   */
  async searchWithQuery(query, documentId = null, topK = config.vectorSearch.defaultTopK) {
    try {
      // Generate embedding for the query
      console.log('Generating query embedding...');
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);
      
      // Search for similar chunks
      console.log('Searching for similar chunks...');
      const results = await this.vectorSearch.searchSimilarChunks(
        queryEmbedding, 
        documentId, 
        topK, 
        config.vectorSearch.defaultScoreThreshold
      );
      
      return results;
    } catch (error) {
      console.error('Query search failed:', error);
      throw error;
    }
  }

  /**
   * Search using embedding vector directly
   * @param {Array} queryEmbedding - Query embedding vector
   * @param {string} [documentId] - Optional document ID filter
   * @param {number} [topK] - Number of results to return
   * @param {number} [scoreThreshold] - Minimum similarity score
   * @returns {Promise<Array>} - Similar chunks
   */
  async searchSimilarChunks(queryEmbedding, documentId = null, topK = config.vectorSearch.defaultTopK, scoreThreshold = config.vectorSearch.defaultScoreThreshold) {
    return await this.vectorSearch.searchSimilarChunks(queryEmbedding, documentId, topK, scoreThreshold);
  }

  /**
   * Delete all chunks for a document
   * @param {string} documentId - Document identifier
   * @returns {Promise<boolean>} - Success status
   */
  async deleteDocumentChunks(documentId) {
    return await this.vectorSearch.deleteDocumentChunks(documentId);
  }

  /**
   * Get collection information and statistics
   * @returns {Promise<Object>} - Collection info
   */
  async getCollectionInfo() {
    return await this.vectorSearch.getCollectionInfo();
  }

  /**
   * Advanced search with multiple filters and options
   * @param {Object} searchOptions - Search configuration
   * @returns {Promise<Array>} - Search results
   */
  async advancedSearch(searchOptions) {
    const {
      query,
      documentId,
      topK = config.vectorSearch.defaultTopK,
      scoreThreshold = config.vectorSearch.defaultScoreThreshold,
      includeContent = true,
      includeMetadata = true
    } = searchOptions;

    try {
      let results;
      
      if (typeof query === 'string') {
        // Text query - need to generate embedding
        results = await this.searchWithQuery(query, documentId, topK);
      } else if (Array.isArray(query)) {
        // Already an embedding vector
        results = await this.searchSimilarChunks(query, documentId, topK, scoreThreshold);
      } else {
        throw new Error('Invalid query type. Must be string or embedding vector.');
      }

      // Filter results based on score threshold
      results = results.filter(result => result.score >= scoreThreshold);

      // Format results based on options
      if (!includeContent || !includeMetadata) {
        results = results.map(result => {
          const formatted = { id: result.id, score: result.score };
          if (includeContent) formatted.content = result.content;
          if (includeMetadata) {
            formatted.page_number = result.page_number;
            formatted.document_id = result.document_id;
            formatted.index = result.index;
          }
          return formatted;
        });
      }

      return results;
    } catch (error) {
      console.error('Advanced search failed:', error);
      throw error;
    }
  }
}

export default new VectorSearchServiceWrapper();