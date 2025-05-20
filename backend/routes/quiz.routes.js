import express from 'express';
import quizController from '../controllers/quizController.js';

const router = express.Router();

// Quiz generation and retrieval
router.post('/generate', quizController.generateQuiz);
router.get('/:id', quizController.getQuiz);
router.post('/:id/submit', quizController.submitQuiz);

// Saved quizzes
router.get('/saved', quizController.getSavedQuizzes);
router.delete('/:id', quizController.deleteQuiz);

export default router;