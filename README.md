# AI Quiz Generator

An AI-powered quiz generation system that creates quizzes from PDF lecture materials using LLM and RAG (Retrieval-Augmented Generation) technology.

## 🔧 System Overview

This application takes PDF lecture materials as input and automatically generates quizzes (OX/multiple choice/short answer) using LLM + RAG. The system processes uploaded documents, extracts text, chunks content, creates embeddings, and generates contextually relevant quiz questions.

## 🚀 Features

- PDF upload and processing with text extraction
- Text cleaning and chunking for semantic content analysis
- Vector embeddings for similarity search
- Multiple quiz types: multiple choice, true/false, and short answer
- Custom query support to focus quizzes on specific topics
- Quiz taking interface with automatic grading
- Saving and managing multiple quizzes

## 🧱 Technology Stack

### Frontend
- React
- Chakra UI for responsive design
- React Router for navigation
- Axios for API communication

### Backend
- Node.js with Express
- PDF processing with pdf-parse
- Vector search (mock implementation, would use Qdrant in production)
- OpenAI API integration (optional, requires API key)
- MongoDB for data storage (optional)

## 📋 Project Structure

```
AI_QUIZ/
├── backend/
│   ├── controllers/     # Request handlers
│   ├── models/          # Database schemas
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── uploads/         # PDF storage
│   ├── .env             # Environment variables
│   ├── package.json     # Backend dependencies
│   └── server.js        # Entry point
├── frontend/
│   ├── public/          # Static files
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   └── App.js       # Main component
│   └── package.json     # Frontend dependencies
└── README.md            # Project documentation
```

## 🛠️ Setup and Installation

### Prerequisites
- Node.js (v14+)
- npm or yarn
- MongoDB (optional)

### Installation Steps

1. Clone the repository
   ```
   git clone <repository-url>
   cd AI_QUIZ
   ```

2. Install backend dependencies
   ```
   cd backend
   npm install
   ```

3. Set up environment variables
   - Copy `.env.example` to `.env` and configure:
     - MongoDB connection string (optional)
     - OpenAI API key (optional for LLM features)
     - Port settings

4. Install frontend dependencies
   ```
   cd ../frontend
   npm install
   ```

5. Start the development servers

   Backend:
   ```
   cd ../backend
   npm run dev
   ```

   Frontend:
   ```
   cd ../frontend
   npm start
   ```

6. Access the application at `http://localhost:3000`

## 📝 Usage

1. **Upload PDF**: Navigate to the upload page and select your lecture material PDF
2. **Wait for Processing**: The system will extract text, create chunks, and prepare for quiz generation
3. **Generate Quiz**: Select quiz type, number of questions, and optional custom query focus
4. **Take Quiz**: Answer the generated questions
5. **View Results**: Check your score and review explanations for each question
6. **Save and Share**: Save your quizzes for future reference

## ⚙️ Project Configuration

### Backend Configuration (.env)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ai-quiz-db
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=development
```

### Frontend Configuration
The frontend proxy is configured to connect to the backend at `http://localhost:5000`

## 🧠 LLM Integration

The system can operate in two modes:
1. **With OpenAI API**: Provides enhanced text cleaning, chunk validation, and higher quality quiz generation
2. **Without API key**: Falls back to rule-based methods for quiz generation

To enable LLM features, add your OpenAI API key to the backend `.env` file.

## 📊 Vector Search

The current implementation uses a simplified in-memory vector store. In a production environment, it's recommended to use a dedicated vector database like Qdrant for better performance and scalability.

## 🔨 Future Improvements

- Integration with additional LLM providers
- Support for more document formats (DOCX, PPTX, etc.)
- User authentication and quiz sharing
- Enhanced quiz analytics and reporting
- OCR improvements for scanned documents
- Integration with learning management systems

## 📄 License

This project is licensed under the MIT License.# AI_QUIZ
