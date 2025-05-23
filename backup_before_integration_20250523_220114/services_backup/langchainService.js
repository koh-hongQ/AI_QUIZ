import OpenAI from 'openai';

/**
 * LangChainService handles interactions with LLMs for various tasks
 * Using OpenAI v4 API
 */
export class LangChainService {
  constructor() {
    // Initialize with default settings
    this.available = false;
    
    try {
      // Check if necessary environment variables are set
      if (process.env.OPENAI_API_KEY) {
        this.available = true;
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('LangChain service initialized successfully with OpenAI v4');
      } else {
        console.log('LangChain service not available (missing API key)');
      }
    } catch (error) {
      console.error('Error initializing LangChain service:', error);
      this.available = false;
    }
  }

  /**
   * Check if the LangChain service is available
   * @returns {boolean} Whether the service is available
   */
  isAvailable() {
    return this.available;
  }

  /**
   * Clean and correct text using LLM
   * @param {string} text - Raw text to clean
   * @returns {Promise<string>} Cleaned text
   */
  async cleanText(text) {
    if (!this.available) {
      throw new Error('LangChain service is not available');
    }

    try {
      const prompt = `
      You are a helpful text cleaning assistant. Clean the following text extracted from a PDF:
      1. Fix obvious OCR errors
      2. Correct broken sentences
      3. Remove headers, footers, and page numbers
      4. Preserve the original information and meaning
      5. Maintain paragraph breaks

      Text to clean:
      ${text.substring(0, 4000)}...

      Cleaned text:
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that cleans and corrects text extracted from PDFs.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4000
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error cleaning text with LLM:', error);
      throw error;
    }
  }

  /**
   * Validate and improve text chunks using LLM
   * @param {Array} chunks - Array of text chunks with content
   * @returns {Promise<Array>} Validated and improved chunks
   */
  async validateChunks(chunks) {
    if (!this.available) {
      throw new Error('LangChain service is not available');
    }

    try {
      const chunksToValidate = chunks.map(chunk => chunk.content);
      
      const prompt = `
      You are a helpful assistant that validates text chunks from educational materials.
      Evaluate each chunk and determine if it's a complete, coherent semantic unit.
      For each chunk:
      1. Check if it contains a complete thought or topic
      2. Fix minor issues but preserve the original content
      3. Return the improved chunk

      Chunks to validate:
      ${JSON.stringify(chunksToValidate)}

      Return a JSON array of validated chunks:
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that validates text chunks.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4000
      });

      const validatedContent = JSON.parse(response.choices[0].message.content.trim());
      
      // Combine original metadata with validated content
      return chunks.map((chunk, index) => ({
        ...chunk,
        content: validatedContent[index] || chunk.content
      }));
    } catch (error) {
      console.error('Error validating chunks with LLM:', error);
      throw error;
    }
  }

  /**
   * Generate a quiz using LLM
   * @param {Array} chunks - Source material chunks
   * @param {string} quizType - Type of quiz to generate (mcq, truefalse, essay, mixed)
   * @param {number} questionCount - Number of questions to generate
   * @param {string} customQuery - Optional custom query to focus the quiz
   * @returns {Promise<Object>} Generated quiz
   */
  async generateQuiz(chunks, quizType, questionCount, customQuery = '') {
    if (!this.available) {
      throw new Error('LangChain service is not available');
    }

    try {
      // Extract the content from chunks
      const content = chunks.map(chunk => chunk.content).join('\n\n');
      
      // Build a prompt based on the quiz type
      let systemPrompt = 'You are an expert educational quiz creator.';
      
      let userPrompt = `
      Create a quiz based on the following educational content. 
      Quiz type: ${quizType}
      Number of questions: ${questionCount}
      ${customQuery ? `Focus on: ${customQuery}` : ''}

      Content:
      ${content.substring(0, 6000)}

      Generate ${questionCount} questions in JSON format following these guidelines:
      `;

      // Add specific instructions based on quiz type
      if (quizType === 'mcq') {
        userPrompt += `
        - Each question should have 4 options with exactly one correct answer
        - Include an explanation for the correct answer
        - Format: { "questions": [ { "type": "mcq", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswer": 0-3, "explanation": "..." } ] }
        `;
      } else if (quizType === 'truefalse') {
        userPrompt += `
        - Create true/false statements based on the content
        - Include an explanation for each answer
        - Format: { "questions": [ { "type": "truefalse", "question": "...", "correctAnswer": true/false, "explanation": "..." } ] }
        `;
      } else if (quizType === 'essay') {
        userPrompt += `
        - Create open-ended questions that require short essay responses
        - Include a sample answer for each question
        - Format: { "questions": [ { "type": "essay", "question": "...", "sampleAnswer": "..." } ] }
        `;
      } else if (quizType === 'mixed') {
        userPrompt += `
        - Create a mix of multiple choice, true/false, and essay questions
        - Distribution: 40% MCQ, 40% true/false, 20% essay
        - Include explanations/sample answers for each question
        - Format: { "questions": [ 
            { "type": "mcq", "question": "...", "options": ["...", "...", "...", "..."], "correctAnswer": 0-3, "explanation": "..." },
            { "type": "truefalse", "question": "...", "correctAnswer": true/false, "explanation": "..." },
            { "type": "essay", "question": "...", "sampleAnswer": "..." }
          ] }
        `;
      }

      userPrompt += `
      Ensure questions are diverse and test different concepts from the content.
      The JSON should be valid and parseable.
      `;

      // Call LLM to generate the quiz
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });

      // Parse the response
      const content_str = response.choices[0].message.content.trim();
      
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content_str.match(/```json\n([\s\S]*?)\n```/) || 
                        content_str.match(/```\n([\s\S]*?)\n```/) ||
                        [null, content_str];
      
      const jsonString = jsonMatch[1] || content_str;
      
      try {
        const quizData = JSON.parse(jsonString);
        
        // Add unique IDs to questions
        if (quizData.questions) {
          quizData.questions = quizData.questions.map((q, i) => ({
            ...q,
            id: `q${i + 1}`
          }));
        }
        
        // Create a title based on the content
        quizData.title = this.generateQuizTitle(content, customQuery);
        
        return quizData;
      } catch (parseError) {
        console.error('Error parsing quiz JSON:', parseError);
        throw new Error('Failed to parse quiz data from LLM response');
      }
    } catch (error) {
      console.error('Error generating quiz with LLM:', error);
      throw error;
    }
  }

  /**
   * Generate a title for the quiz based on the content
   * @param {string} content - Source material content
   * @param {string} customQuery - Optional custom query
   * @returns {string} Generated quiz title
   */
  generateQuizTitle(content, customQuery = '') {
    // Extract first 100 characters to identify the topic
    const topicHint = content.substring(0, 100);
    
    // Create a quiz title
    if (customQuery) {
      return `Quiz on ${customQuery}`;
    } else {
      // Extract potential keywords from the beginning of the content
      const words = topicHint.split(/\s+/).filter(w => w.length > 3);
      const potentialTopics = words.slice(0, 3).join(' ');
      
      return `Quiz on ${potentialTopics}`;
    }
  }
}