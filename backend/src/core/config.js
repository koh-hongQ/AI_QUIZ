/**
 * Central configuration management
 */
export class Config {
  static get PORT() {
    return process.env.PORT || 5000;
  }

  static get MONGODB_URI() {
    return process.env.MONGODB_URI;
  }

  static get NODE_ENV() {
    return process.env.NODE_ENV || 'development';
  }

  static get OPENAI_API_KEY() {
    return process.env.OPENAI_API_KEY;
  }

  static get UPLOAD_DIR() {
    return process.env.UPLOAD_DIR || './uploads';
  }

  static get CORS_ORIGINS() {
    return (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',');
  }

  // E5 Embedding Model Configuration
  static get EMBEDDING_MODEL() {
    return {
      name: 'intfloat/e5-small-v2',
      dimensions: 384,
      maxTokens: 512,
      prefix: {
        query: 'query: ',
        passage: 'passage: '
      }
    };
  }

  // Qdrant Configuration
  static get QDRANT_CONFIG() {
    return {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
      collection: process.env.QDRANT_COLLECTION || 'ai_quiz_docs'
    };
  }

  // Chunk Configuration
  static get CHUNK_CONFIG() {
    return {
      maxTokens: parseInt(process.env.CHUNK_MAX_TOKENS) || 500,
      overlap: parseInt(process.env.CHUNK_OVERLAP) || 50,
      minTokens: parseInt(process.env.CHUNK_MIN_TOKENS) || 50
    };
  }

  // LLM Configuration
  static get LLM_CONFIG() {
    return {
      model: process.env.LLM_MODEL || 'gpt-4-turbo-preview',
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 4000,
      temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7
    };
  }

  // Validate required environment variables
  static validate() {
    const required = [];
    
    if (!this.OPENAI_API_KEY) {
      required.push('OPENAI_API_KEY');
    }

    if (required.length > 0) {
      throw new Error(`Missing required environment variables: ${required.join(', ')}`);
    }
  }
}
