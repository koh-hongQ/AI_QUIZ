// Configuration for Python services integration
export default {
  python: {
    // Python executable path
    pythonPath: process.env.PYTHON_PATH || 'python3',
    
    // Python services directory
    servicesPath: './python_services',
    
    // Execution timeout (milliseconds)
    timeout: 30000,
    
    // Environment variables to pass to Python scripts
    env: {
      PYTHONPATH: './python_services',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      QDRANT_HOST: process.env.QDRANT_HOST || 'localhost',
      QDRANT_PORT: process.env.QDRANT_PORT || '6333',
      QDRANT_API_KEY: process.env.QDRANT_API_KEY,
    }
  },
  
  // PDF processing configuration
  pdfProcessing: {
    // Whether to use LLM for text cleaning
    useLLMCleaning: process.env.USE_LLM_CLEANING === 'true',
    
    // Whether to validate chunks with LLM
    validateChunks: process.env.VALIDATE_CHUNKS === 'true',
    
    // Target chunk size in tokens
    targetChunkSize: parseInt(process.env.TARGET_CHUNK_SIZE) || 500,
    
    // OCR confidence threshold
    ocrThreshold: parseFloat(process.env.OCR_THRESHOLD) || 0.7
  },
  
  // Embedding configuration
  embedding: {
    // Model name for embeddings
    modelName: process.env.EMBEDDING_MODEL || 'intfloat/e5-small-v2',
    
    // Batch size for processing multiple texts
    batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE) || 10,
    
    // Whether to use GPU if available
    useGPU: process.env.USE_GPU !== 'false'
  },
  
  // Vector search configuration
  vectorSearch: {
    // Qdrant collection name
    collectionName: process.env.QDRANT_COLLECTION || 'quiz_embeddings',
    
    // Default top-k for similarity search
    defaultTopK: parseInt(process.env.DEFAULT_TOP_K) || 5,
    
    // Default similarity score threshold
    defaultScoreThreshold: parseFloat(process.env.DEFAULT_SCORE_THRESHOLD) || 0.0
  },
  
  // Quiz generation configuration
  quizGeneration: {
    // OpenAI model for quiz generation
    openaiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    
    // Temperature for quiz generation
    temperature: parseFloat(process.env.QUIZ_TEMPERATURE) || 0.7,
    
    // Maximum tokens for quiz generation
    maxTokens: parseInt(process.env.QUIZ_MAX_TOKENS) || 1500
  }
};