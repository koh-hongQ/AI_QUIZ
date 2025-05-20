import PythonBridge from './pythonBridge.js';

/**
 * Embedding Service - Bridge to Python embedding generation
 */
class EmbeddingService extends PythonBridge {
  /**
   * Generate embedding for a single text
   * @param {string} text - Text to embed
   * @param {string} type - Type of text ('passage' or 'query')
   * @returns {Promise<Array>} - Embedding vector
   */
  async generateEmbedding(text, type = 'passage') {
    try {
      const result = await this.executePythonScript(
        'embedding_service/embedding_generator.py',
        [text, '--type', type]
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return result.embedding;
    } catch (error) {
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple chunks
   * @param {Array} chunks - Array of chunk objects
   * @returns {Promise<Array>} - Chunks with embeddings added
   */
  async generateChunkEmbeddings(chunks) {
    try {
      const chunksWithEmbeddings = [];

      // Process chunks in batches to avoid overwhelming the system
      const batchSize = 10;
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        console.log(`Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
        
        // Generate embeddings for batch
        const batchPromises = batch.map(async (chunk) => {
          const embedding = await this.generateEmbedding(chunk.content, 'passage');
          return {
            ...chunk,
            embedding: embedding
          };
        });

        const processedBatch = await Promise.all(batchPromises);
        chunksWithEmbeddings.push(...processedBatch);
      }

      return chunksWithEmbeddings;
    } catch (error) {
      throw new Error(`Batch embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Generate query embedding for search
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Query embedding vector
   */
  async generateQueryEmbedding(query) {
    try {
      return await this.generateEmbedding(query, 'query');
    } catch (error) {
      throw new Error(`Query embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Get embedding dimension
   * @returns {Promise<number>} - Embedding dimension
   */
  async getEmbeddingDimension() {
    try {
      const result = await this.generateEmbedding('test');
      return result.length;
    } catch (error) {
      // Default dimension for e5-small
      return 384;
    }
  }
}

export default EmbeddingService;
