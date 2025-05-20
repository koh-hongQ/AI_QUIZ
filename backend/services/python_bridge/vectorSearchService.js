import PythonBridge from './pythonBridge.js';

/**
 * Vector Search Service - Bridge to Python Qdrant operations
 */
class VectorSearchService extends PythonBridge {
  /**
   * Store chunks with embeddings in Qdrant
   * @param {string} documentId - Document identifier
   * @param {Array} chunks - Chunks with embeddings
   * @returns {Promise<boolean>} - Success status
   */
  async storeChunkEmbeddings(documentId, chunks) {
    try {
      // Validate that chunks have embeddings
      const chunksWithEmbeddings = chunks.filter(chunk => chunk.embedding);
      
      if (chunksWithEmbeddings.length === 0) {
        throw new Error('No chunks with embeddings to store');
      }

      // Store chunks using Python script
      const result = await this.executePythonScript(
        'vector_search/store_chunks.py',
        [documentId, JSON.stringify(chunksWithEmbeddings)]
      );

      if (result.error) {
        throw new Error(result.error);
      }

      console.log(`Stored ${chunksWithEmbeddings.length} chunks for document ${documentId}`);
      return result.success || true;
    } catch (error) {
      throw new Error(`Failed to store chunk embeddings: ${error.message}`);
    }
  }

  /**
   * Search for similar chunks
   * @param {Array} queryEmbedding - Query embedding vector
   * @param {string} [documentId] - Optional document ID filter
   * @param {number} [topK=5] - Number of results to return
   * @param {number} [scoreThreshold=0.0] - Minimum similarity score
   * @returns {Promise<Array>} - Similar chunks
   */
  async searchSimilarChunks(queryEmbedding, documentId = null, topK = 5, scoreThreshold = 0.0) {
    try {
      const args = [JSON.stringify(queryEmbedding)];
      
      if (documentId) {
        args.push('--doc-id', documentId);
      }
      
      args.push('--top-k', topK.toString());
      args.push('--score-threshold', scoreThreshold.toString());

      const result = await this.executePythonScript(
        'vector_search/qdrant_client.py',
        ['search', ...args]
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return result.results || [];
    } catch (error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }
  }

  /**
   * Delete all chunks for a document
   * @param {string} documentId - Document identifier
   * @returns {Promise<boolean>} - Success status
   */
  async deleteDocumentChunks(documentId) {
    try {
      const result = await this.executePythonScript(
        'vector_search/qdrant_client.py',
        ['delete', documentId]
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return result.success || true;
    } catch (error) {
      throw new Error(`Failed to delete document chunks: ${error.message}`);
    }
  }

  /**
   * Get collection information
   * @returns {Promise<Object>} - Collection statistics
   */
  async getCollectionInfo() {
    try {
      const result = await this.executePythonScript(
        'vector_search/qdrant_client.py',
        ['info']
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to get collection info: ${error.message}`);
    }
  }

  /**
   * Complete search pipeline with query preprocessing
   * @param {string} query - Search query text
   * @param {string} [documentId] - Optional document ID filter
   * @param {number} [topK=5] - Number of results to return
   * @returns {Promise<Array>} - Search results
   */
  async searchWithQuery(query, documentId = null, topK = 5) {
    try {
      // First, generate embedding for the query
      const EmbeddingService = (await import('./embeddingService.js')).default;
      const embeddingService = new EmbeddingService();
      
      console.log('Generating query embedding...');
      const queryEmbedding = await embeddingService.generateQueryEmbedding(query);
      
      // Then search for similar chunks
      console.log('Searching for similar chunks...');
      const results = await this.searchSimilarChunks(queryEmbedding, documentId, topK);
      
      return results;
    } catch (error) {
      throw new Error(`Search pipeline failed: ${error.message}`);
    }
  }
}

export default VectorSearchService;
