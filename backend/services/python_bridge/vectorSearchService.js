import PythonBridge from './pythonBridge.js';

/**
 * Vector Search Service Bridge to Python with Mock support
 */
class VectorSearchService {
  constructor() {
    this.bridge = new PythonBridge();
    this.mockMode = process.env.OPENAI_API_KEY === 'mock';
    
    if (this.mockMode) {
      console.log('🎭 Vector Search Service running in MOCK MODE');
    }
  }

  /**
   * Store chunk embeddings in Qdrant
   */
  async storeChunkEmbeddings(documentId, chunks) {
    if (this.mockMode) {
      console.log(`Mock: Storing ${chunks.length} chunks for document ${documentId}`);
      return true;
    }

    try {
      const result = await this.bridge.executePythonScript('vector_search/store_chunks.py', [
        documentId,
        JSON.stringify(chunks)
      ]);
      
      return result.success || false;
    } catch (error) {
      console.error('Error storing chunk embeddings:', error);
      return false;
    }
  }

  /**
   * Search for similar chunks
   */
  async searchSimilarChunks(queryEmbedding, documentId = null, topK = 5, scoreThreshold = 0.0) {
    if (this.mockMode) {
      return this._getMockSearchResults(documentId, topK);
    }

    try {
      const args = [
        JSON.stringify(queryEmbedding),
        '--top-k', topK.toString()
      ];
      
      if (documentId) {
        args.push('--doc-id', documentId);
      }
      
      if (scoreThreshold > 0) {
        args.push('--threshold', scoreThreshold.toString());
      }
      
      const result = await this.bridge.executePythonScript('vector_search/qdrant_client.py', ['search', ...args]);
      
      return result.results || [];
    } catch (error) {
      console.error('Error searching similar chunks:', error);
      return this._getMockSearchResults(documentId, topK);
    }
  }

  /**
   * Delete all chunks for a document
   */
  async deleteDocumentChunks(documentId) {
    if (this.mockMode) {
      console.log(`Mock: Deleting chunks for document ${documentId}`);
      return true;
    }

    try {
      const result = await this.bridge.executePythonScript('vector_search/qdrant_client.py', ['delete', documentId]);
      return result.success || false;
    } catch (error) {
      console.error('Error deleting document chunks:', error);
      return false;
    }
  }

  /**
   * Get collection information
   */
  async getCollectionInfo() {
    if (this.mockMode) {
      return {
        name: 'mock_collection',
        vector_size: 384,
        distance: 'cosine',
        points_count: 100,
        status: 'ready'
      };
    }

    try {
      const result = await this.bridge.executePythonScript('vector_search/qdrant_client.py', ['info']);
      return result;
    } catch (error) {
      console.error('Error getting collection info:', error);
      return {
        name: 'unknown',
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Generate mock search results for testing
   * @private
   */
  _getMockSearchResults(documentId, topK) {
    const mockContent = [
      "Artificial Intelligence (AI) is the simulation of human intelligence processes by machines, especially computer systems.",
      "Machine Learning is a subset of AI that enables systems to learn and improve from experience without being explicitly programmed.",
      "Deep Learning is a subset of machine learning that uses neural networks with multiple layers.",
      "Natural Language Processing enables computers to understand, interpret, and generate human language.",
      "Computer Vision is a field of AI that enables computers to derive meaningful information from digital images.",
      "Neural Networks are computing systems inspired by the biological neural networks that constitute animal brains.",
      "Reinforcement Learning is an area of machine learning where agents learn to make decisions by taking actions.",
      "Supervised Learning is a type of machine learning where the model is trained on labeled data."
    ];

    const results = [];
    for (let i = 0; i < Math.min(topK, mockContent.length); i++) {
      results.push({
        id: `mock_chunk_${i}`,
        score: 0.95 - (i * 0.05),
        content: mockContent[i],
        page_number: Math.floor(i / 2) + 1,
        document_id: documentId || 'mock_doc',
        index: i
      });
    }

    return results;
  }
}

export default VectorSearchService;