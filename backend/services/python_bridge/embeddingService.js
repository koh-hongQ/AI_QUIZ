import PythonBridge from './pythonBridge.js';

/**
 * Embedding Service Bridge to Python with Mock support
 */
class EmbeddingService {
  constructor() {
    this.bridge = new PythonBridge();
    this.mockMode = process.env.OPENAI_API_KEY === 'mock';
    
    if (this.mockMode) {
      console.log('🎭 Embedding Service running in MOCK MODE');
    }
  }

  /**
   * Generate embeddings for chunks
   */
  async generateChunkEmbeddings(chunks) {
    if (this.mockMode) {
      // Generate mock embeddings
      return chunks.map(chunk => ({
        ...chunk,
        embedding: this._generateMockEmbedding()
      }));
    }

    try {
      const result = await this.bridge.executePythonScript('embedding_service/embedding_generator.py', [
        JSON.stringify(chunks),
        '--type', 'passage'
      ]);
      
      return result.embeddings || chunks;
    } catch (error) {
      console.error('Error generating chunk embeddings:', error);
      // Fallback to mock embeddings
      return chunks.map(chunk => ({
        ...chunk,
        embedding: this._generateMockEmbedding()
      }));
    }
  }

  /**
   * Generate embedding for query text
   */
  async generateQueryEmbedding(query) {
    if (this.mockMode) {
      return this._generateMockEmbedding();
    }

    try {
      const result = await this.bridge.executePythonScript('embedding_service/embedding_generator.py', [
        query,
        '--type', 'query'
      ]);
      
      return result.embedding || this._generateMockEmbedding();
    } catch (error) {
      console.error('Error generating query embedding:', error);
      return this._generateMockEmbedding();
    }
  }

  /**
   * Generate mock embedding vector
   * @private
   */
  _generateMockEmbedding() {
    // Generate a random 384-dimensional vector (E5 small size)
    const embedding = [];
    for (let i = 0; i < 384; i++) {
      embedding.push(Math.random() * 2 - 1); // Random values between -1 and 1
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }
}

export default EmbeddingService;