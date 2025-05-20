/**
 * Quiz Generator Service
 * Generates various types of quiz questions from text chunks using LLM
 */
import { Logger } from '../../utils/logger.js';
import { LLMService } from './llmService.js';
import { EmbeddingService } from '../embedding/embeddingService.js';

export class QuizGenerator {
  constructor() {
    this.logger = new Logger('QuizGenerator');
    this.llmService = new LLMService();
    this.embeddingService = new EmbeddingService();
    this.quizTypes = {
      MULTIPLE_CHOICE: 'multiple_choice',
      TRUE_FALSE: 'true_false',
      SHORT_ANSWER: 'short_answer',
      ESSAY: 'essay',
      FILL_IN_BLANK: 'fill_in_blank'
    };
    this.difficulties = {
      EASY: 'easy',
      MEDIUM: 'medium',
      HARD: 'hard'
    };
  }

  /**
   * Generate quiz questions from text chunks
   * @param {Array<Object>} chunks - Text chunks with embeddings
   * @param {Object} options - Quiz generation options
   * @returns {Promise<Array<Object>>} Generated quiz questions
   */
  async generateQuiz(chunks, options = {}) {
    try {
      const {
        quizType = this.quizTypes.MULTIPLE_CHOICE,
        difficulty = this.difficulties.MEDIUM,
        questionCount = 5,
        topicFocus = null,
        customInstructions = ''
      } = options;

      this.logger.info('Generating quiz', {
        chunkCount: chunks.length,
        quizType,
        difficulty,
        questionCount
      });

      // Select relevant chunks
      const selectedChunks = await this.selectRelevantChunks(chunks, questionCount, topicFocus);
      
      // Generate questions from selected chunks
      const questions = [];
      for (const chunk of selectedChunks) {
        const question = await this.generateQuestionFromChunk(chunk, {
          quizType,
          difficulty,
          customInstructions
        });
        if (question) {
          questions.push(question);
        }
      }

      // Validate and post-process questions
      const validatedQuestions = await this.validateQuestions(questions);
      
      this.logger.success(`Generated ${validatedQuestions.length} valid questions`);
      return validatedQuestions;
    } catch (error) {
      this.logger.error('Failed to generate quiz', error);
      throw error;
    }
  }

  /**
   * Select most relevant chunks for quiz generation
   * @private
   * @param {Array<Object>} chunks - Available chunks
   * @param {number} count - Number of chunks to select
   * @param {string} topicFocus - Optional topic to focus on
   * @returns {Promise<Array<Object>>} Selected chunks
   */
  async selectRelevantChunks(chunks, count, topicFocus = null) {
    if (!topicFocus) {
      // If no topic focus, select chunks with good distribution
      return this.selectChunksWithDistribution(chunks, count);
    }

    // Use semantic similarity to find topic-relevant chunks
    const topicEmbedding = await this.embeddingService.generateQueryEmbedding(topicFocus);
    const similarChunks = this.embeddingService.findSimilarChunks(topicEmbedding, chunks, count);
    
    this.logger.debug(`Selected ${similarChunks.length} chunks focused on: ${topicFocus}`);
    return similarChunks;
  }

  /**
   * Select chunks with good distribution across the document
   * @private
   * @param {Array<Object>} chunks - Available chunks
   * @param {number} count - Number of chunks to select
   * @returns {Array<Object>} Selected chunks
   */
  selectChunksWithDistribution(chunks, count) {
    if (chunks.length <= count) {
      return chunks;
    }

    const selected = [];
    const interval = Math.floor(chunks.length / count);
    
    for (let i = 0; i < count; i++) {
      const index = Math.min(i * interval, chunks.length - 1);
      selected.push(chunks[index]);
    }
    
    return selected;
  }

  /**
   * Generate a question from a single chunk
   * @private
   * @param {Object} chunk - Text chunk
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated question
   */
  async generateQuestionFromChunk(chunk, options) {
    try {
      const prompt = this.buildQuestionPrompt(chunk.content, options);
      const response = await this.llmService.generateResponse(prompt, {
        maxTokens: 800,
        temperature: 0.7
      });

      const question = this.parseQuestionResponse(response, options);
      question.sourceChunk = chunk.chunkId;
      question.pageNumber = chunk.pageNumber;
      question.id = this.generateQuestionId();

      return question;
    } catch (error) {
      this.logger.error('Failed to generate question from chunk', error, {
        chunkId: chunk.chunkId
      });
      return null;
    }
  }

  /**
   * Build prompt for question generation
   * @private
   * @param {string} content - Chunk content
   * @param {Object} options - Generation options
   * @returns {string} Generated prompt
   */
  buildQuestionPrompt(content, options) {
    const { quizType, difficulty, customInstructions } = options;
    
    let prompt = `Based on the following text, generate a ${difficulty} difficulty ${quizType.replace('_', ' ')} question.\n\n`;
    prompt += `Text:\n${content}\n\n`;

    switch (quizType) {
      case this.quizTypes.MULTIPLE_CHOICE:
        prompt += `Create a multiple choice question with 4 options (A, B, C, D). `;
        prompt += `Ensure only one option is clearly correct and the others are plausible but wrong.\n\n`;
        prompt += `Format your response as JSON:\n`;
        prompt += `{\n`;
        prompt += `  "question": "Your question here",\n`;
        prompt += `  "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],\n`;
        prompt += `  "correctAnswer": "B",\n`;
        prompt += `  "explanation": "Brief explanation of why the answer is correct"\n`;
        prompt += `}`;
        break;

      case this.quizTypes.TRUE_FALSE:
        prompt += `Create a true/false question based on factual information from the text.\n\n`;
        prompt += `Format your response as JSON:\n`;
        prompt += `{\n`;
        prompt += `  "question": "Your statement here",\n`;
        prompt += `  "correctAnswer": true,\n`;
        prompt += `  "explanation": "Brief explanation"\n`;
        prompt += `}`;
        break;

      case this.quizTypes.SHORT_ANSWER:
        prompt += `Create a short answer question that requires 1-3 sentences to answer.\n\n`;
        prompt += `Format your response as JSON:\n`;
        prompt += `{\n`;
        prompt += `  "question": "Your question here",\n`;
        prompt += `  "correctAnswer": "Expected answer",\n`;
        prompt += `  "explanation": "Sample answer explanation"\n`;
        prompt += `}`;
        break;

      case this.quizTypes.FILL_IN_BLANK:
        prompt += `Create a fill-in-the-blank question by removing a key term from a sentence.\n\n`;
        prompt += `Format your response as JSON:\n`;
        prompt += `{\n`;
        prompt += `  "question": "Sentence with _____ for the blank",\n`;
        prompt += `  "correctAnswer": "Missing word/phrase",\n`;
        prompt += `  "explanation": "Why this term is important"\n`;
        prompt += `}`;
        break;

      default:
        prompt += `Create an appropriate question based on the content.`;
    }

    if (customInstructions) {
      prompt += `\n\nAdditional instructions: ${customInstructions}`;
    }

    return prompt;
  }

  /**
   * Parse LLM response into question object
   * @private
   * @param {string} response - LLM response
   * @param {Object} options - Question options
   * @returns {Object} Parsed question
   */
  parseQuestionResponse(response, options) {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response);
      
      return {
        type: options.quizType,
        difficulty: options.difficulty,
        question: parsed.question,
        correctAnswer: parsed.correctAnswer,
        options: parsed.options || null,
        explanation: parsed.explanation,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      // If JSON parsing fails, try to extract information manually
      this.logger.warn('Failed to parse question as JSON, attempting manual extraction');
      return this.extractQuestionManually(response, options);
    }
  }

  /**
   * Extract question information manually from response
   * @private
   * @param {string} response - LLM response
   * @param {Object} options - Question options
   * @returns {Object} Extracted question
   */
  extractQuestionManually(response, options) {
    // Simple extraction for fallback
    const lines = response.split('\n').filter(line => line.trim());
    
    return {
      type: options.quizType,
      difficulty: options.difficulty,
      question: lines[0] || 'Question extraction failed',
      correctAnswer: 'Manual verification required',
      options: null,
      explanation: 'Please verify this question manually',
      createdAt: new Date().toISOString(),
      requiresManualReview: true
    };
  }

  /**
   * Validate generated questions
   * @private
   * @param {Array<Object>} questions - Generated questions
   * @returns {Promise<Array<Object>>} Validated questions
   */
  async validateQuestions(questions) {
    const validQuestions = [];
    
    for (const question of questions) {
      if (this.isValidQuestion(question)) {
        // Optional: Use LLM to validate question quality
        const validated = await this.validateQuestionWithLLM(question);
        if (validated) {
          validQuestions.push(question);
        }
      } else {
        this.logger.warn('Invalid question detected', { questionId: question.id });
      }
    }
    
    return validQuestions;
  }

  /**
   * Check if question meets basic validation criteria
   * @private
   * @param {Object} question - Question to validate
   * @returns {boolean} Whether question is valid
   */
  isValidQuestion(question) {
    if (!question.question || question.question.length < 10) {
      return false;
    }
    
    if (!question.correctAnswer) {
      return false;
    }
    
    if (question.type === this.quizTypes.MULTIPLE_CHOICE) {
      if (!question.options || question.options.length !== 4) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validate question quality using LLM
   * @private
   * @param {Object} question - Question to validate
   * @returns {Promise<boolean>} Whether question passes LLM validation
   */
  async validateQuestionWithLLM(question) {
    // Skip LLM validation for now to avoid excessive API calls
    // In production, this could validate question clarity, correctness, etc.
    return true;
  }

  /**
   * Generate unique question ID
   * @private
   * @returns {string} Unique ID
   */
  generateQuestionId() {
    return `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate quiz from a search query
   * @param {string} query - Search query
   * @param {Array<Object>} chunks - Available chunks
   * @param {Object} options - Quiz options
   * @returns {Promise<Array<Object>>} Generated quiz questions
   */
  async generateQuizFromQuery(query, chunks, options = {}) {
    try {
      this.logger.info('Generating quiz from query', { query });
      
      // Find relevant chunks using semantic search
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);
      const relevantChunks = this.embeddingService.findSimilarChunks(
        queryEmbedding, 
        chunks, 
        options.questionCount || 5
      );
      
      // Generate quiz from relevant chunks
      return await this.generateQuiz(relevantChunks, {
        ...options,
        topicFocus: query
      });
    } catch (error) {
      this.logger.error('Failed to generate quiz from query', error);
      throw error;
    }
  }

  /**
   * Get quiz statistics
   * @param {Array<Object>} questions - Quiz questions
   * @returns {Object} Quiz statistics
   */
  getQuizStats(questions) {
    const stats = {
      totalQuestions: questions.length,
      byType: {},
      byDifficulty: {},
      averageQuestionLength: 0,
      questionsWithIssues: 0
    };
    
    questions.forEach(question => {
      // Count by type
      stats.byType[question.type] = (stats.byType[question.type] || 0) + 1;
      
      // Count by difficulty
      stats.byDifficulty[question.difficulty] = (stats.byDifficulty[question.difficulty] || 0) + 1;
      
      // Count questions needing review
      if (question.requiresManualReview) {
        stats.questionsWithIssues++;
      }
      
      // Add to average length
      stats.averageQuestionLength += question.question.length;
    });
    
    stats.averageQuestionLength = Math.round(stats.averageQuestionLength / questions.length);
    
    return stats;
  }
}
