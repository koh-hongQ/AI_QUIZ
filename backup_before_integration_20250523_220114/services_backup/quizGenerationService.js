import OpenAI from 'openai';
import vectorSearchService from './vectorSearchService.js';
import config from '../config/pythonServiceConfig.js';

/**
 * Quiz Generation Service using LLM
 */
class QuizGenerationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate quiz questions based on document content
   * @param {string} documentId - Document identifier
   * @param {string} documentName - Document name for context
   * @param {string} quizType - Type of quiz (mcq, truefalse, essay, mixed)
   * @param {number} questionCount - Number of questions to generate
   * @param {string} [customQuery] - Optional custom query for focused quiz
   * @returns {Promise<Object>} - Generated quiz
   */
  async generateQuiz(documentId, documentName, quizType, questionCount, customQuery = '') {
    try {
      // 1. Get relevant content from the document
      const relevantChunks = await this._getRelevantContent(documentId, customQuery, questionCount * 2);
      
      if (relevantChunks.length === 0) {
        throw new Error('No relevant content found for quiz generation');
      }

      // 2. Generate quiz based on the content and type
      const quiz = await this._generateQuizFromContent(
        relevantChunks,
        quizType,
        questionCount,
        documentName,
        customQuery
      );

      return quiz;
    } catch (error) {
      console.error('Error generating quiz:', error);
      throw error;
    }
  }

  /**
   * Get relevant content for quiz generation
   * @private
   */
  async _getRelevantContent(documentId, customQuery, topK) {
    try {
      if (customQuery) {
        // Use custom query to find relevant content
        return await vectorSearchService.searchWithQuery(customQuery, documentId, topK);
      } else {
        // Get a representative sample of content from the document
        // Use a general query to get diverse content
        const generalQueries = [
          'important concepts and definitions',
          'key procedures and methods',
          'main principles and theories',
          'essential facts and information'
        ];

        let allChunks = [];
        for (const query of generalQueries) {
          const chunks = await vectorSearchService.searchWithQuery(query, documentId, Math.ceil(topK / generalQueries.length));
          allChunks.push(...chunks);
        }

        // Remove duplicates and sort by score
        const uniqueChunks = this._removeDuplicateChunks(allChunks);
        return uniqueChunks.slice(0, topK);
      }
    } catch (error) {
      console.error('Error getting relevant content:', error);
      throw error;
    }
  }

  /**
   * Generate quiz from content chunks using LLM
   * @private
   */
  async _generateQuizFromContent(chunks, quizType, questionCount, documentName, customQuery) {
    try {
      const content = chunks.map(chunk => chunk.content).join('\n\n');
      
      const prompt = this._buildQuizPrompt(content, quizType, questionCount, documentName, customQuery);
      
      const response = await this.openai.chat.completions.create({
        model: config.quizGeneration.openaiModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert quiz generator. Create high-quality, educational quiz questions based on the provided content. Ensure questions are clear, accurate, and test important concepts.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: config.quizGeneration.temperature,
        max_tokens: config.quizGeneration.maxTokens
      });

      // Parse the response
      const quizContent = response.choices[0].message.content;
      const quiz = this._parseQuizResponse(quizContent, quizType, documentName);
      
      return quiz;
    } catch (error) {
      console.error('Error generating quiz with LLM:', error);
      throw error;
    }
  }

  /**
   * Build quiz generation prompt
   * @private
   */
  _buildQuizPrompt(content, quizType, questionCount, documentName, customQuery) {
    let prompt = `Generate a quiz based on the following content from "${documentName}":\n\n${content}\n\n`;
    
    if (customQuery) {
      prompt += `Focus specifically on: ${customQuery}\n\n`;
    }

    prompt += `Create ${questionCount} questions of type: ${quizType}\n\n`;

    // Add specific instructions based on quiz type
    switch (quizType) {
      case 'mcq':
        prompt += 'Create multiple choice questions with 4 options each. Provide clear explanations for the correct answers.';
        break;
      case 'truefalse':
        prompt += 'Create true/false questions. Provide explanations for why each statement is true or false.';
        break;
      case 'essay':
        prompt += 'Create essay questions that require thoughtful analysis. Provide sample answer points.';
        break;
      case 'mixed':
        prompt += 'Create a mix of question types: multiple choice, true/false, and essay questions.';
        break;
    }

    prompt += `\n\nFormat your response as a JSON object with this structure:
{
  "title": "Quiz Title",
  "questions": [
    {
      "id": "unique_id",
      "type": "mcq|truefalse|essay",
      "question": "Question text",
      "options": ["Option1", "Option2", "Option3", "Option4"], // Only for MCQ
      "correctAnswer": 0, // Index for MCQ, true/false for TF
      "explanation": "Explanation text",
      "sampleAnswer": "Sample answer for essay questions" // Only for essay
    }
  ]
}`;

    return prompt;
  }

  /**
   * Parse quiz response from LLM
   * @private
   */
  _parseQuizResponse(quizContent, quizType, documentName) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = quizContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const quiz = JSON.parse(jsonMatch[0]);
      
      // Validate quiz structure
      if (!quiz.questions || !Array.isArray(quiz.questions)) {
        throw new Error('Invalid quiz structure');
      }

      // Set default title if not provided
      if (!quiz.title) {
        quiz.title = `Quiz on ${documentName}`;
      }

      // Validate each question
      quiz.questions = quiz.questions.map((q, index) => ({
        id: q.id || `q${index + 1}`,
        type: q.type || quizType,
        question: q.question,
        ...(q.options && { options: q.options }),
        ...(q.correctAnswer !== undefined && { correctAnswer: q.correctAnswer }),
        explanation: q.explanation || 'No explanation provided',
        ...(q.sampleAnswer && { sampleAnswer: q.sampleAnswer })
      }));

      return quiz;
    } catch (error) {
      console.error('Error parsing quiz response:', error);
      // Return a fallback quiz
      return this._createFallbackQuiz(quizType, documentName);
    }
  }

  /**
   * Create a fallback quiz if parsing fails
   * @private
   */
  _createFallbackQuiz(quizType, documentName) {
    return {
      title: `Quiz on ${documentName}`,
      questions: [{
        id: 'q1',
        type: quizType === 'mixed' ? 'mcq' : quizType,
        question: 'What is the main topic covered in this document?',
        options: quizType === 'mcq' || quizType === 'mixed' ? [
          'Topic A',
          'Topic B', 
          'Topic C',
          'Topic D'
        ] : undefined,
        correctAnswer: quizType === 'truefalse' ? true : 0,
        explanation: 'Please review the document for the main topics covered.',
        ...(quizType === 'essay' && { 
          sampleAnswer: 'The document covers several important topics related to the subject matter.' 
        })
      }]
    };
  }

  /**
   * Remove duplicate chunks based on ID
   * @private
   */
  _removeDuplicateChunks(chunks) {
    const seen = new Set();
    return chunks.filter(chunk => {
      if (seen.has(chunk.id)) {
        return false;
      }
      seen.add(chunk.id);
      return true;
    });
  }
}

export default new QuizGenerationService();