import express from 'express';
const router = express.Router();

// Import route modules
import pdfRoutes from './pdf.routes.js';
import quizRoutes from './quiz.routes.js';

// Register routes
router.use('/pdf', pdfRoutes);
router.use('/quiz', quizRoutes);

export default router;