/**
 * Vector Database Service using Qdrant
 * Handles vector storage, retrieval, and similarity search
 */
import { QdrantClient } from '@qdrant/js-client-rest';
import { Config } from '../../core/config.js';
import { Logger } from '../../utils/logger.js';

export class VectorDatabaseService {
  constructor() {
    this.logger = new Logger('VectorDatabaseService');
    this.config = Config.QDRANT_CONFIG;
    this.client = null;
    this.collectionName = this.config.collection;
    this.initializeClient();
  }

  /**
   * Initialize Qdrant client
   * @private
   */
  async initializeClient() {
    try {
      this.client = new QdrantClient({
        url: this.config.url,
        apiKey: this.config.apiKey
      });

      this.logger.info('Vector database client initialized', { url: this.config.url });
      
      // Ensure collection exists
      await this.ensureCollection();
    } catch (error) {
      this.logger.error('Failed to initialize vector database client', error);
    }
  }

  /**
   * Ensure collection exists, create if not
   * @private
   */
  async ensureCollection() {
    try {
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );

      if (!collectionExists) {
        await this.createCollection();
      } else {
        this.logger.info(`Collection '${this.collectionName}' already exists`);
      }
    } catch (error) {
      this.logger.error('Failed to ensure collection exists', error);
    }
  }

  /**
   * Create a new collection
   * @private
   */
  async createCollection() {
    try {
      const embeddingConfig = Config.EMBEDDING_MODEL;
      
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: embeddingConfig.dimensions,
          distance: 'Cosine' // Cosine similarity for semantic search
        }
      });

      this.logger.success(`Created collection '${this.collectionName}'`);
    } catch (error) {
      this.logger.error('Failed to create collection', error);
      throw error;
    }
  }

  /**
   * Store embedded chunks in vector database
   * @param {Array<Object>} embeddedChunks - Chunks with embeddings
   * @param {string} documentId - Source document identifier
   * @returns {Promise<Object>} Operation result
   */
  async storeChunks(embeddedChunks, documentId) {
    try {
      this.logger.info(`Storing ${embeddedChunks.length} chunks for document ${documentId}`);

      const points = embeddedChunks.map((chunk, index) => ({
        id: `${documentId}_${chunk.index}`,
        vector: chunk.embedding,
        payload: {
          chunkId: chunk.chunkId,
          documentId,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          pageNumber: chunk.pageNumber,
          index: chunk.index,
          embeddingModel: chunk.embeddingModel,
          createdAt: new Date().toISOString()
        }
      }));

      // Upload points in batches
      const batchSize = 100;
      const results = [];

      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        const result = await this.client.upsert(this.collectionName, {
          wait: true,
          points: batch
        });
        results.push(result);
        
        this.logger.debug(`Uploaded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(points.length/batchSize)}`);
      }

      this.logger.success(`Stored ${embeddedChunks.length} chunks in vector database`);
      return {
        success: true,
        chunksStored: embeddedChunks.length,
        results
      };
    } catch (error) {
      this.logger.error('Failed to store chunks', error);
      throw error;
    }
  }

  /**
   * Search for similar chunks using vector similarity
   * @param {Array<number>} queryVector - Query embedding vector
   * @param {Object} options - Search options
   * @returns {Promise<Array<Object>>} Similar chunks with scores
   */
  async searchSimilar(queryVector, options = {}) {
    try {
      const {
        limit = 10,
        scoreThreshold = 0.7,
        filter = null,
        withEmbedding = false
      } = options;

      this.logger.debug('Searching for similar chunks', { limit, scoreThreshold });

      const searchResult = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit,
        score_threshold: scoreThreshold,
        filter,
        with_payload: true,
        with_vector: withEmbedding
      });

      const results = searchResult.map(hit => ({
        id: hit.id,
        score: hit.score,
        payload: hit.payload,
        vector: hit.vector
      }));

      this.logger.debug(`Found ${results.length} similar chunks`);
      return results;
    } catch (error) {
      this.logger.error('Failed to search similar chunks', error);
      throw error;
    }
  }

  /**
   * Search chunks by document ID
   * @param {string} documentId - Document identifier
   * @param {Object} options - Search options
   * @returns {Promise<Array<Object>>} Document chunks
   */
  async getChunksByDocument(documentId, options = {}) {
    try {
      const { offset = 0, limit = 100 } = options;

      const filter = {
        must: [
          {
            key: 'documentId',
            match: { value: documentId }
          }
        ]
      };

      const scrollResult = await this.client.scroll(this.collectionName, {
        filter,
        offset,
        limit,
        with_payload: true,
        with_vector: false
      });

      return scrollResult.points.map(point => ({
        id: point.id,
        payload: point.payload
      }));
    } catch (error) {
      this.logger.error('Failed to get chunks by document', error);
      throw error;
    }
  }

  /**
   * Delete all chunks for a document
   * @param {string} documentId - Document identifier
   * @returns {Promise<Object>} Deletion result
   */
  async deleteDocument(documentId) {
    try {
      this.logger.info(`Deleting document ${documentId} from vector database`);

      const filter = {
        must: [
          {
            key: 'documentId',
            match: { value: documentId }
          }
        ]
      };

      const result = await this.client.delete(this.collectionName, {
        filter,
        wait: true
      });

      this.logger.success(`Deleted document ${documentId} from vector database`);
      return result;
    } catch (error) {
      this.logger.error('Failed to delete document', error);
      throw error;
    }
  }

  /**
   * Search chunks with text filtering
   * @param {Array<number>} queryVector - Query vector
   * @param {Object} textFilters - Text-based filters
   * @param {Object} options - Search options
   * @returns {Promise<Array<Object>>} Filtered search results
   */
  async searchWithFilters(queryVector, textFilters = {}, options = {}) {
    try {
      const { documentId, pageNumber, minScore = 0.7 } = textFilters;
      const { limit = 10 } = options;

      const filter = { must: [] };

      if (documentId) {
        filter.must.push({
          key: 'documentId',
          match: { value: documentId }
        });
      }

      if (pageNumber) {
        filter.must.push({
          key: 'pageNumber',
          match: { value: pageNumber }
        });
      }

      return await this.searchSimilar(queryVector, {
        limit,
        scoreThreshold: minScore,
        filter: filter.must.length > 0 ? filter : null
      });
    } catch (error) {
      this.logger.error('Failed to search with filters', error);
      throw error;
    }
  }

  /**
   * Get collection statistics
   * @returns {Promise<Object>} Collection statistics
   */
  async getCollectionStats() {
    try {
      const info = await this.client.getCollection(this.collectionName);
      
      return {
        pointsCount: info.points_count,
        vectorsCount: info.vectors_count,
        indexedVectorsCount: info.indexed_vectors_count,
        config: info.config,
        status: info.status
      };
    } catch (error) {
      this.logger.error('Failed to get collection stats', error);
      throw error;
    }
  }

  /**
   * Check if vector database is available
   * @returns {Promise<boolean>} Whether database is available
   */
  async isAvailable() {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      this.logger.warn('Vector database not available', error.message);
      return false;
    }
  }

  /**
   * Create index for better performance
   * @param {Object} indexConfig - Index configuration
   * @returns {Promise<Object>} Index creation result
   */
  async createIndex(indexConfig = {}) {
    try {
      const defaultConfig = {
        field_name: 'content',
        field_schema: 'text'
      };

      const config = { ...defaultConfig, ...indexConfig };
      
      await this.client.createFieldIndex(this.collectionName, config);
      this.logger.success('Created field index', config);
    } catch (error) {
      this.logger.error('Failed to create index', error);
      throw error;
    }
  }

  /**
   * Batch update vectors
   * @param {Array<Object>} updates - Vector updates
   * @returns {Promise<Object>} Update result
   */
  async batchUpdate(updates) {
    try {
      const result = await this.client.upsert(this.collectionName, {
        wait: true,
        points: updates
      });

      this.logger.info(`Batch updated ${updates.length} vectors`);
      return result;
    } catch (error) {
      this.logger.error('Failed to batch update vectors', error);
      throw error;
    }
  }
}
