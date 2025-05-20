/**
 * Main Application Entry Point - Updated with Python Integration
 * Initializes and starts the AI Quiz Backend server
 */
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// Core imports
import { Config } from './core/config.js';
import { Database } from './core/database.js';
import { Logger } from './utils/logger.js';

// Module imports
import { PDFExtractor } from './modules/preprocessing/pdfExtractor.js';
import { PythonPDFProcessor } from './modules/preprocessing/pythonPDFProcessor.js';
import { TextProcessor } from './modules/preprocessing/textProcessor.js';
import { TextChunker } from './modules/preprocessing/textChunker.js';
import { EmbeddingService } from './modules/embedding/embeddingService.js';
import { VectorDatabaseService } from './modules/embedding/vectorDatabaseService.js';
import { QuizGenerator } from './modules/quiz/quizGenerator.js';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AIQuizApp {
  constructor() {
    this.logger = new Logger('AIQuizApp');
    this.app = express();
    this.port = Config.PORT;
    
    // Initialize services
    this.pdfExtractor = new PDFExtractor();
    this.pythonPDFProcessor = new PythonPDFProcessor();
    this.textProcessor = new TextProcessor();
    this.textChunker = new TextChunker();
    this.embeddingService = new EmbeddingService();
    this.vectorService = new VectorDatabaseService();
    this.quizGenerator = new QuizGenerator();
    
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * Initialize middleware
   * @private
   */
  initializeMiddleware() {
    // CORS configuration
    this.app.use(cors({
      origin: Config.CORS_ORIGINS,
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // File upload configuration
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, Config.UPLOAD_DIR);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    });

    this.upload = multer({ 
      storage,
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only PDF files are allowed'));
        }
      }
    });

    // Logging middleware
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  /**
   * Initialize API routes
   * @private
   */
  initializeRoutes() {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      const pythonAvailable = await this.pythonPDFProcessor.isServiceAvailable();
      
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          database: Database.getConnectionStatus(),
          vectorDB: 'checking...', // Would need async check
          pythonPDFService: pythonAvailable
        }
      });
    });

    // Document processing endpoints
    this.app.post('/api/documents/upload', this.upload.single('pdf'), this.handleDocumentUpload.bind(this));
    this.app.get('/api/documents/:id', this.handleGetDocument.bind(this));
    this.app.get('/api/documents/:id/chunks', this.handleGetDocumentChunks.bind(this));
    this.app.delete('/api/documents/:id', this.handleDeleteDocument.bind(this));

    // Quiz generation endpoints
    this.app.post('/api/quiz/generate', this.handleGenerateQuiz.bind(this));
    this.app.post('/api/quiz/generate-from-query', this.handleGenerateQuizFromQuery.bind(this));
    this.app.get('/api/quiz/:id', this.handleGetQuiz.bind(this));

    // Search endpoints
    this.app.post('/api/search/semantic', this.handleSemanticSearch.bind(this));
    this.app.get('/api/search/similar/:chunkId', this.handleFindSimilar.bind(this));

    // Stats endpoint
    this.app.get('/api/stats', this.handleGetStats.bind(this));
  }

  /**
   * Handle document upload and processing
   */
  async handleDocumentUpload(req, res) {
    try {
      const { file } = req;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.logger.info('Processing uploaded document', {
        documentId,
        filename: file.originalname,
        size: file.size
      });

      // Choose PDF processor based on configuration
      const usePython = process.env.USE_PYTHON_PDF === 'true';
      let extractionResult;

      if (usePython && await this.pythonPDFProcessor.isServiceAvailable()) {
        this.logger.info('Using Python PDF processor');
        extractionResult = await this.pythonPDFProcessor.extractText(file.path);
        
        // If Python processor returns chunks, skip Node.js text processing
        if (extractionResult.chunks) {
          const embeddedChunks = await this.embeddingService.generateEmbeddings(extractionResult.chunks);
          await this.vectorService.storeChunks(embeddedChunks, documentId);
          
          return res.json({
            success: true,
            documentId,
            metadata: {
              filename: file.originalname,
              pageCount: extractionResult.pageCount,
              chunkCount: embeddedChunks.length,
              extractionMethod: extractionResult.method,
              processor: 'python'
            }
          });
        }
      } else {
        this.logger.info('Using Node.js PDF processor');
        extractionResult = await this.pdfExtractor.extractText(file.path);
      }
      
      // Continue with Node.js text processing if needed
      const processedText = await this.textProcessor.processText(extractionResult.text);
      const chunks = await this.textChunker.createChunks(processedText, extractionResult.pageCount);
      const embeddedChunks = await this.embeddingService.generateEmbeddings(chunks);
      await this.vectorService.storeChunks(embeddedChunks, documentId);

      res.json({
        success: true,
        documentId,
        metadata: {
          filename: file.originalname,
          pageCount: extractionResult.pageCount,
          chunkCount: embeddedChunks.length,
          extractionMethod: extractionResult.method,
          processor: usePython ? 'python' : 'nodejs'
        }
      });

      // Clean up uploaded file
      // fs.unlinkSync(file.path);
      
    } catch (error) {
      this.logger.error('Document upload failed', error);
      res.status(500).json({ error: 'Failed to process document', message: error.message });
    }
  }

  /**
   * Generate quiz from document chunks
   */
  async handleGenerateQuiz(req, res) {
    try {
      const { documentId, quizType, difficulty, questionCount, topicFocus } = req.body;
      
      if (!documentId) {
        return res.status(400).json({ error: 'Document ID is required' });
      }

      // Get document chunks from vector database
      const chunks = await this.vectorService.getChunksByDocument(documentId);
      
      if (chunks.length === 0) {
        return res.status(404).json({ error: 'Document not found or has no chunks' });
      }

      // Generate quiz
      const quiz = await this.quizGenerator.generateQuiz(chunks, {
        quizType,
        difficulty,
        questionCount,
        topicFocus
      });

      res.json({
        success: true,
        quiz,
        metadata: {
          documentId,
          questionCount: quiz.length,
          stats: this.quizGenerator.getQuizStats(quiz)
        }
      });
      
    } catch (error) {
      this.logger.error('Quiz generation failed', error);
      res.status(500).json({ error: 'Failed to generate quiz', message: error.message });
    }
  }

  /**
   * Generate quiz from search query
   */
  async handleGenerateQuizFromQuery(req, res) {
    try {
      const { query, documentId, quizType, difficulty, questionCount } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      // Get available chunks
      let chunks;
      if (documentId) {
        chunks = await this.vectorService.getChunksByDocument(documentId);
      } else {
        // Get all chunks if no specific document
        chunks = await this.vectorService.getChunksByDocument('*'); // TODO: Implement get all chunks
      }

      // Generate quiz from query
      const quiz = await this.quizGenerator.generateQuizFromQuery(query, chunks, {
        quizType,
        difficulty,
        questionCount
      });

      res.json({
        success: true,
        quiz,
        metadata: {
          query,
          documentId,
          questionCount: quiz.length,
          stats: this.quizGenerator.getQuizStats(quiz)
        }
      });
      
    } catch (error) {
      this.logger.error('Query-based quiz generation failed', error);
      res.status(500).json({ error: 'Failed to generate quiz from query', message: error.message });
    }
  }

  /**
   * Handle semantic search
   */
  async handleSemanticSearch(req, res) {
    try {
      const { query, documentId, limit = 10, scoreThreshold = 0.7 } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);
      
      // Search similar chunks
      const results = await this.vectorService.searchWithFilters(queryEmbedding, 
        { documentId, minScore: scoreThreshold },
        { limit }
      );

      res.json({
        success: true,
        results,
        metadata: {
          query,
          resultCount: results.length,
          documentId
        }
      });
      
    } catch (error) {
      this.logger.error('Semantic search failed', error);
      res.status(500).json({ error: 'Failed to perform semantic search', message: error.message });
    }
  }

  /**
   * Get application statistics
   */
  async handleGetStats(req, res) {
    try {
      const vectorStats = await this.vectorService.getCollectionStats();
      const pythonAvailable = await this.pythonPDFProcessor.isServiceAvailable();
      
      res.json({
        success: true,
        stats: {
          vectorDatabase: vectorStats,
          services: {
            llm: this.quizGenerator.llmService.isAvailable(),
            embedding: true, // Always available with OpenAI fallback
            vectorDB: await this.vectorService.isAvailable(),
            pythonPDF: pythonAvailable
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to get stats', error);
      res.status(500).json({ error: 'Failed to get statistics', message: error.message });
    }
  }

  // Placeholder handlers for other endpoints
  async handleGetDocument(req, res) {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  async handleGetDocumentChunks(req, res) {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  async handleDeleteDocument(req, res) {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  async handleGetQuiz(req, res) {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  async handleFindSimilar(req, res) {
    res.status(501).json({ error: 'Not implemented yet' });
  }

  /**
   * Initialize error handling
   * @private
   */
  initializeErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      this.logger.error('Unhandled error', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: Config.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  /**
   * Start the application
   */
  async start() {
    try {
      // Validate configuration
      Config.validate();
      
      // Connect to database
      await Database.connect();
      
      // Ensure upload directory exists
      const fs = await import('fs');
      if (!fs.existsSync(Config.UPLOAD_DIR)) {
        fs.mkdirSync(Config.UPLOAD_DIR, { recursive: true });
      }

      // Start server
      this.app.listen(this.port, () => {
        this.logger.success(`AI Quiz Backend started on port ${this.port}`);
        this.logger.info('Available endpoints:', {
          health: '/health',
          upload: 'POST /api/documents/upload',
          generateQuiz: 'POST /api/quiz/generate',
          search: 'POST /api/search/semantic'
        });
      });
      
    } catch (error) {
      this.logger.error('Failed to start application', error);
      process.exit(1);
    }
  }
}

// Start the application
const app = new AIQuizApp();
app.start().catch(error => {
  console.error('Application startup failed:', error);
  process.exit(1);
});

export default AIQuizApp;
