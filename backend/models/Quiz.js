import mongoose from 'mongoose';

// Schema for questions (embedded in Quiz)
const QuestionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['mcq', 'truefalse', 'essay'],
    required: true
  },
  question: {
    type: String,
    required: true
  },
  // For MCQ questions
  options: {
    type: [String]
  },
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed  // Can be number (for MCQ) or boolean (for T/F)
  },
  // For essay questions
  sampleAnswer: {
    type: String
  },
  explanation: {
    type: String
  },
  sourcePageNumbers: {
    type: [Number],
    default: []
  }
});

// Schema for quiz submissions (embedded in Quiz)
const SubmissionSchema = new mongoose.Schema({
  submittedAt: {
    type: Date,
    default: Date.now
  },
  answers: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  score: {
    correct: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    }
  }
}, { timestamps: true });

// Main Quiz schema
const QuizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  quizType: {
    type: String,
    enum: ['mcq', 'truefalse', 'essay', 'mixed'],
    required: true
  },
  questions: {
    type: [QuestionSchema],
    default: []
  },
  createdByQuery: {
    type: String
  },
  submissions: {
    type: [SubmissionSchema],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Instance method to submit a quiz attempt
QuizSchema.methods.submitQuiz = function(answers) {
  // Calculate score for auto-gradable questions
  let correctAnswers = 0;
  let totalGradableQuestions = 0;
  
  this.questions.forEach(question => {
    if (question.type !== 'essay') {
      totalGradableQuestions++;
      
      const questionId = question.id;
      const userAnswer = answers[questionId];
      
      if (userAnswer !== undefined) {
        if (
          (question.type === 'mcq' && userAnswer === question.correctAnswer) ||
          (question.type === 'truefalse' && userAnswer === question.correctAnswer)
        ) {
          correctAnswers++;
        }
      }
    }
  });
  
  // Calculate score percentage
  const scorePercentage = totalGradableQuestions > 0 
    ? (correctAnswers / totalGradableQuestions) * 100 
    : 0;
  
  // Create submission record
  const submission = {
    submittedAt: new Date(),
    answers,
    score: {
      correct: correctAnswers,
      total: totalGradableQuestions,
      percentage: scorePercentage
    }
  };
  
  // Add submission to quiz
  this.submissions.push(submission);
  
  return {
    submissionId: this.submissions[this.submissions.length - 1]._id,
    score: submission.score
  };
};

const Quiz = mongoose.model('Quiz', QuizSchema);

export default Quiz;