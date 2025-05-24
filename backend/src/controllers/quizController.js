import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import Quiz from '../models/Quiz.js';
import quizGenerationService from '../services/quizGenerationService.js';

// Generate a quiz
export const generateQuizController = async (req, res) => {
  try {
    const { documentId, quizType, questionCount = 5, customQuery } = req.body;

    if (!documentId) {
      return res.status(400).json({ 
        error: true,
        message: 'Document ID is required' 
      });
    }

    if (!quizType) {
      return res.status(400).json({ 
        error: true,
        message: 'Quiz type is required' 
      });
    }

    // Validate quiz type
    const validQuizTypes = ['mcq', 'truefalse', 'essay', 'mixed'];
    if (!validQuizTypes.includes(quizType)) {
      return res.status(400).json({ 
        error: true,
        message: 'Invalid quiz type', 
        validTypes: validQuizTypes 
      });
    }

    // Validate question count
    const numQuestions = parseInt(questionCount);
    if (isNaN(numQuestions) || numQuestions < 1 || numQuestions > 20) {
      return res.status(400).json({
        error: true,
        message: 'Question count must be between 1 and 20'
      });
    }

    // In a real implementation, verify document exists and is processed
    // const document = await Document.findOne({ documentId });
    // if (!document) {
    //   return res.status(404).json({ 
    //     error: true,
    //     message: 'Document not found' 
    //   });
    // }
    // if (document.processingStatus !== 'completed') {
    //   return res.status(400).json({ 
    //     error: true,
    //     message: 'Document processing is not completed' 
    //   });
    // }
    
    try {
      console.log(`Generating ${quizType} quiz with ${numQuestions} questions for document ${documentId}`);
      
      // Generate quiz using the enhanced service
      const quizData = await quizGenerationService.generateQuiz(
        documentId,
        'sample-lecture.pdf', // In real implementation, use document.originalFilename
        quizType,
        numQuestions,
        customQuery || ''
      );
      
      // Save the quiz to database (simplified for demo)
      // In real implementation:
      // const newQuiz = new Quiz({
      //   title: quizData.title,
      //   documentId: document._id,
      //   quizType,
      //   questions: quizData.questions,
      //   createdByQuery: customQuery || null,
      //   createdAt: new Date()
      // });
      // const savedQuiz = await newQuiz.save();
      
      // For demo, generate a mock quiz ID
      const quizId = 'quiz_' + Date.now();
      
      res.status(201).json({
        success: true,
        message: 'Quiz generated successfully',
        quizId,
        quiz: {
          id: quizId,
          title: quizData.title,
          questionCount: quizData.questions.length,
          quizType,
          documentId,
          createdAt: new Date().toISOString()
        }
      });
    } catch (genError) {
      console.error('Error generating quiz:', genError);
      return res.status(500).json({ 
        error: true,
        message: 'Error generating quiz', 
        details: genError.message 
      });
    }
  } catch (error) {
    console.error('Error in generateQuiz:', error);
    res.status(500).json({ 
      error: true,
      message: 'Internal server error', 
      details: error.message 
    });
  }
};

// Get a specific quiz
export const getQuiz = async (req, res) => {
  try {
    const quizId = req.params.id;
    
    // In a real implementation, fetch the quiz from the database
    // const quiz = await Quiz.findById(quizId);
    // if (!quiz) {
    //   return res.status(404).json({ 
    //     error: true,
    //     message: 'Quiz not found' 
    //   });
    // }
    // const document = await Document.findById(quiz.documentId);
    
    // For demo, return enhanced mock data
    const mockQuiz = {
      id: quizId,
      title: 'AI and Machine Learning Fundamentals Quiz',
      quizType: 'mixed',
      questions: generateMockQuestions('mixed', 5),
      documentName: 'ai-ml-fundamentals.pdf',
      documentId: 'doc_123456',
      createdAt: new Date().toISOString(),
      metadata: {
        totalQuestions: 5,
        estimatedDuration: '15 minutes',
        difficulty: 'Intermediate'
      }
    };

    res.status(200).json({
      success: true,
      quiz: mockQuiz
    });
  } catch (error) {
    console.error('Error in getQuiz:', error);
    res.status(500).json({ 
      error: true,
      message: 'Error fetching quiz', 
      details: error.message 
    });
  }
};

// Submit a quiz and get results
export const submitQuiz = async (req, res) => {
  try {
    const { answers } = req.body;
    const quizId = req.params.id;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ 
        error: true,
        message: 'Answers are required and must be an object' 
      });
    }

    // In a real implementation, fetch the quiz and calculate the score
    // const quiz = await Quiz.findById(quizId);
    // if (!quiz) {
    //   return res.status(404).json({ 
    //     error: true,
    //     message: 'Quiz not found' 
    //   });
    // }
    
    // For demo, calculate a mock score
    const mockQuestions = generateMockQuestions('mixed', 5);
    let correctAnswers = 0;
    let totalGradableQuestions = 0;
    const questionResults = [];

    mockQuestions.forEach((question, index) => {
      if (question.type !== 'essay') {
        totalGradableQuestions++;
        
        const questionId = `q${index + 1}`;
        const userAnswer = answers[questionId];
        
        if (userAnswer !== undefined) {
          const isCorrect = (
            (question.type === 'mcq' && userAnswer === question.correctAnswer) ||
            (question.type === 'truefalse' && userAnswer === question.correctAnswer)
          );
          
          if (isCorrect) {
            correctAnswers++;
          }
          
          questionResults.push({
            questionId,
            type: question.type,
            correct: isCorrect,
            userAnswer,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation
          });
        } else {
          questionResults.push({
            questionId,
            type: question.type,
            correct: false,
            userAnswer: null,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            note: 'No answer provided'
          });
        }
      } else {
        // Essay questions - not auto-graded
        questionResults.push({
          questionId: `q${index + 1}`,
          type: 'essay',
          correct: null,
          userAnswer: answers[`q${index + 1}`] || '',
          note: 'Essay question - manual grading required',
          sampleAnswer: question.sampleAnswer
        });
      }
    });

    // Calculate score percentage
    const scorePercentage = totalGradableQuestions > 0 
      ? Math.round((correctAnswers / totalGradableQuestions) * 100) 
      : 0;

    // Save submission (in real implementation)
    // const submission = new QuizSubmission({
    //   quizId: quiz._id,
    //   answers,
    //   score: scorePercentage,
    //   submittedAt: new Date()
    // });
    // await submission.save();

    res.status(200).json({
      success: true,
      message: 'Quiz submitted successfully',
      quizId,
      results: {
        score: {
          correct: correctAnswers,
          total: totalGradableQuestions,
          percentage: scorePercentage
        },
        questionResults,
        submittedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in submitQuiz:', error);
    res.status(500).json({ 
      error: true,
      message: 'Error submitting quiz', 
      details: error.message 
    });
  }
};

// Get all saved quizzes with filtering and pagination
export const getSavedQuizzes = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      quizType, 
      documentId 
    } = req.query;

    // In a real implementation, fetch quizzes from the database with filters
    // const query = {};
    // if (quizType) query.quizType = quizType;
    // if (documentId) query.documentId = documentId;
    
    // const quizzes = await Quiz.find(query)
    //   .sort({ createdAt: -1 })
    //   .limit(parseInt(limit))
    //   .skip((parseInt(page) - 1) * parseInt(limit));
    
    // For demo, return enhanced mock data with pagination
    const mockQuizzes = [
      {
        id: 'quiz_1',
        title: 'Machine Learning Algorithms Quiz',
        quizType: 'mcq',
        questionCount: 10,
        documentName: 'ml-algorithms.pdf',
        documentId: 'doc_ml_001',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        submissionCount: 3,
        lastAttempt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        averageScore: 85.5
      },
      {
        id: 'quiz_2',
        title: 'Deep Learning Fundamentals Assessment',
        quizType: 'mixed',
        questionCount: 8,
        documentName: 'deep-learning-basics.pdf',
        documentId: 'doc_dl_001',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        submissionCount: 1,
        lastAttempt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        averageScore: 78.0
      },
      {
        id: 'quiz_3',
        title: 'Neural Network Architecture Quiz',
        quizType: 'essay',
        questionCount: 5,
        documentName: 'neural-networks.pdf',
        documentId: 'doc_nn_001',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        submissionCount: 0,
        lastAttempt: null,
        averageScore: null
      }
    ];

    // Apply filters
    let filteredQuizzes = mockQuizzes;
    if (quizType) {
      filteredQuizzes = filteredQuizzes.filter(quiz => quiz.quizType === quizType);
    }
    if (documentId) {
      filteredQuizzes = filteredQuizzes.filter(quiz => quiz.documentId === documentId);
    }

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedQuizzes = filteredQuizzes.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      quizzes: paginatedQuizzes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredQuizzes.length / parseInt(limit)),
        totalQuizzes: filteredQuizzes.length,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error in getSavedQuizzes:', error);
    res.status(500).json({ 
      error: true,
      message: 'Error fetching saved quizzes', 
      details: error.message 
    });
  }
};

// Delete a quiz
export const deleteQuiz = async (req, res) => {
  try {
    const quizId = req.params.id;
    
    // In a real implementation, delete the quiz from the database
    // const quiz = await Quiz.findByIdAndDelete(quizId);
    // if (!quiz) {
    //   return res.status(404).json({ 
    //     error: true,
    //     message: 'Quiz not found' 
    //   });
    // }
    
    res.status(200).json({ 
      success: true,
      message: 'Quiz deleted successfully',
      quizId
    });
  } catch (error) {
    console.error('Error in deleteQuiz:', error);
    res.status(500).json({ 
      error: true,
      message: 'Error deleting quiz', 
      details: error.message 
    });
  }
};

// Helper function to generate enhanced mock questions
function generateMockQuestions(quizType, count) {
  const questions = [];
  
  // Define question pools for better variety
  const mcqPool = [
    {
      question: "What is the primary goal of supervised learning?",
      options: ["To find patterns in unlabeled data", "To learn from labeled examples", "To reduce dimensionality", "To cluster similar data points"],
      correctAnswer: 1,
      explanation: "Supervised learning uses labeled training data to learn a mapping from inputs to outputs."
    },
    {
      question: "Which algorithm is commonly used for classification problems?",
      options: ["K-Means", "Random Forest", "K-Nearest Neighbors", "Both B and C"],
      correctAnswer: 3,
      explanation: "Both Random Forest and K-Nearest Neighbors are classification algorithms."
    }
  ];
  
  const tfPool = [
    {
      question: "Deep learning models always require large amounts of training data.",
      correctAnswer: false,
      explanation: "While deep learning often benefits from large datasets, techniques like transfer learning and data augmentation can work with smaller datasets."
    },
    {
      question: "Gradient descent is an optimization algorithm used to minimize the loss function.",
      correctAnswer: true,
      explanation: "Gradient descent iteratively adjusts parameters to find the minimum of the loss function."
    }
  ];
  
  const essayPool = [
    {
      question: "Explain the concept of overfitting in machine learning and describe three methods to prevent it.",
      sampleAnswer: "Overfitting occurs when a model learns the training data too well, including noise and outliers, resulting in poor generalization. Prevention methods include: 1) Regularization (L1/L2), 2) Cross-validation for model selection, 3) Early stopping during training."
    },
    {
      question: "Describe the bias-variance tradeoff and its importance in machine learning model selection.",
      sampleAnswer: "The bias-variance tradeoff describes the balance between a model's ability to capture true relationships (low bias) and its sensitivity to training data variations (low variance). High bias leads to underfitting, high variance to overfitting. Finding the optimal balance is crucial for good generalization."
    }
  ];
  
  // Determine question types based on quiz type
  let questionTypes = [];
  if (quizType === 'mixed') {
    // Distribute questions across types
    for (let i = 0; i < count; i++) {
      if (i % 3 === 0) questionTypes.push('mcq');
      else if (i % 3 === 1) questionTypes.push('truefalse');
      else questionTypes.push('essay');
    }
  } else {
    questionTypes = new Array(count).fill(quizType);
  }
  
  // Generate questions
  for (let i = 0; i < count; i++) {
    const type = questionTypes[i];
    const questionId = `q${i + 1}`;
    
    if (type === 'mcq') {
      const template = mcqPool[i % mcqPool.length];
      questions.push({
        id: questionId,
        type: 'mcq',
        ...template
      });
    } else if (type === 'truefalse') {
      const template = tfPool[i % tfPool.length];
      questions.push({
        id: questionId,
        type: 'truefalse',
        ...template
      });
    } else {
      const template = essayPool[i % essayPool.length];
      questions.push({
        id: questionId,
        type: 'essay',
        ...template
      });
    }
  }
  
  return questions;
}

// Export all controllers
export default {
  generateQuiz: generateQuizController,
  getQuiz,
  submitQuiz,
  getSavedQuizzes,
  deleteQuiz
};