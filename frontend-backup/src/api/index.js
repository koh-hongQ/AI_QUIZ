import axios from 'axios';

// Create API instance with base URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout for LLM operations
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      console.error('Unauthorized access');
    } else if (error.response?.status >= 500) {
      console.error('Server error');
    }
    
    return Promise.reject(error);
  }
);

// PDF Processing endpoints
export const uploadPdf = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const config = {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percentCompleted);
      }
    },
  };
  
  try {
    const response = await api.post('/pdf/upload', formData, config);
    return response.data;
  } catch (error) {
    console.error('Error uploading PDF:', error);
    throw error;
  }
};

export const getProcessingStatus = async (documentId) => {
  try {
    const response = await api.get(`/pdf/${documentId}/status`);
    return response.data;
  } catch (error) {
    console.error('Error fetching processing status:', error);
    throw error;
  }
};

export const getDocumentInfo = async (documentId) => {
  try {
    const response = await api.get(`/pdf/${documentId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching document info:', error);
    throw error;
  }
};

// Extract text only without full processing
export const extractTextOnly = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const config = {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  };
  
  try {
    const response = await api.post('/pdf/extract', formData, config);
    return response.data;
  } catch (error) {
    console.error('Error extracting text:', error);
    throw error;
  }
};

// Quiz endpoints
export const generateQuiz = async (quizConfig) => {
  try {
    // Validate quiz configuration
    const { documentId, quizType, questionCount, customQuery } = quizConfig;
    
    if (!documentId) {
      throw new Error('Document ID is required');
    }
    
    if (!quizType) {
      throw new Error('Quiz type is required');
    }
    
    const payload = {
      documentId,
      quizType,
      questionCount: parseInt(questionCount) || 5,
    };
    
    if (customQuery && customQuery.trim()) {
      payload.customQuery = customQuery.trim();
    }
    
    const response = await api.post('/quiz/generate', payload);
    return response.data;
  } catch (error) {
    console.error('Error generating quiz:', error);
    throw error;
  }
};

export const getQuiz = async (quizId) => {
  try {
    const response = await api.get(`/quiz/${quizId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching quiz:', error);
    throw error;
  }
};

export const submitQuiz = async (quizId, answers) => {
  try {
    // Validate answers object
    if (!answers || typeof answers !== 'object') {
      throw new Error('Invalid answers format');
    }
    
    const response = await api.post(`/quiz/${quizId}/submit`, { answers });
    return response.data;
  } catch (error) {
    console.error('Error submitting quiz:', error);
    throw error;
  }
};

export const getSavedQuizzes = async (filters = {}) => {
  try {
    // Support for filtering and pagination
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.quizType) params.append('quizType', filters.quizType);
    if (filters.documentId) params.append('documentId', filters.documentId);
    
    const url = params.toString() ? `/quiz/saved?${params.toString()}` : '/quiz/saved';
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching saved quizzes:', error);
    throw error;
  }
};

export const deleteQuiz = async (quizId) => {
  try {
    const response = await api.delete(`/quiz/${quizId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting quiz:', error);
    throw error;
  }
};

// Health check endpoint
export const checkApiHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('API health check failed:', error);
    throw error;
  }
};

// Utility functions for the frontend
export const apiUtils = {
  // Format error messages for user display
  formatErrorMessage: (error) => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    } else if (error.response?.data?.details) {
      return error.response.data.details;
    } else if (error.message) {
      return error.message;
    } else {
      return 'An unexpected error occurred';
    }
  },
  
  // Check if error is network related
  isNetworkError: (error) => {
    return error.code === 'NETWORK_ERROR' || !error.response;
  },
  
  // Check if error is server error
  isServerError: (error) => {
    return error.response?.status >= 500;
  },
  
  // Create polling function for processing status
  pollProcessingStatus: async (documentId, onStatusUpdate, maxAttempts = 60) => {
    let attempts = 0;
    
    const poll = async () => {
      try {
        const status = await getProcessingStatus(documentId);
        onStatusUpdate(status);
        
        if (status.status === 'completed' || status.status === 'failed') {
          return status;
        }
        
        if (attempts >= maxAttempts) {
          throw new Error('Processing timeout - please check manually');
        }
        
        attempts++;
        // Wait 2 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 2000));
        return poll();
      } catch (error) {
        console.error('Polling error:', error);
        throw error;
      }
    };
    
    return poll();
  }
};

export default api;