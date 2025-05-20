# Frontend-Backend Integration Guide

This guide explains how to connect and run the AI Quiz frontend with the hybrid Node.js/Python backend.

## Architecture Overview

```
┌─────────────────────────────────────┐
│         React Frontend              │
│         (Port 3000)                 │
│                                     │
│  ┌─────────────────────────────┐   │
│  │     Components              │   │
│  │  • FileUpload              │   │
│  │  • ProcessingStatus        │   │  
│  │  • QuizGenerator           │   │
│  │  • QuizDisplay             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │     API Service             │   │
│  │  • HTTP Client (Axios)     │   │
│  │  • Error Handling          │   │
│  │  • Progress Tracking       │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
               │ HTTP Requests
               │ (Proxy: :3000 → :5000)
┌─────────────────────────────────────┐
│       Node.js Backend               │
│       (Port 5000)                   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │     Express API             │   │
│  │  • PDF Routes              │   │
│  │  • Quiz Routes             │   │
│  │  • Middleware              │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │     Python Services         │   │
│  │  • PyMuPDF Processing      │   │
│  │  • e5-small Embeddings     │   │
│  │  • Qdrant Integration      │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Setup Instructions

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Run setup script
./setup.sh  # Linux/macOS
# or
setup.bat   # Windows

# Start Qdrant (if using local)
docker run -d -p 6333:6333 qdrant/qdrant

# Configure environment
cp .env.example .env
# Edit .env with your API keys and settings

# Start backend server
npm run dev
```

The backend will run on http://localhost:5000

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env if needed (optional in development)

# Start frontend development server
npm start
```

The frontend will run on http://localhost:3000

## Development Workflow

### Starting Both Services

1. **Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

2. **Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

3. **Terminal 3 - Qdrant (if local):**
```bash
docker run -p 6333:6333 qdrant/qdrant
```

### Basic Test Flow

1. **Health Check:**
   - Open http://localhost:3000
   - Click "Check Backend Status" on upload page
   - Should show success message

2. **PDF Upload:**
   - Click "Browse Files" or drag-and-drop a PDF
   - Click "Upload and Process with AI"
   - Watch the processing stages complete

3. **Quiz Generation:**
   - After processing completes, get redirected to quiz generation
   - Select quiz type and options
   - Click "Generate Quiz"
   - Get redirected to the quiz

## API Endpoints

The frontend makes requests to these backend endpoints:

### PDF Processing
- `POST /api/pdf/upload` - Upload and process PDF
- `GET /api/pdf/:documentId/status` - Check processing status
- `GET /api/pdf/:documentId` - Get document information

### Quiz Management
- `POST /api/quiz/generate` - Generate quiz from document
- `GET /api/quiz/:quizId` - Get quiz questions
- `POST /api/quiz/:quizId/submit` - Submit quiz answers
- `GET /api/quiz/saved` - Get saved quizzes

### System
- `GET /api/health` - Backend health check

## Configuration

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_DEBUG=true
```

### Backend (.env)
```env
PORT=5000
OPENAI_API_KEY=your_api_key_here
QDRANT_HOST=localhost
QDRANT_PORT=6333
USE_LLM_CLEANING=false
VALIDATE_CHUNKS=false
```

## Error Handling

The frontend handles various error scenarios:

1. **Network Errors:**
   - Shows toast notifications for failed requests
   - Automatic retry for processing status checks
   - Fallback error messages

2. **Validation Errors:**
   - Client-side validation for file types and sizes
   - Form validation for quiz generation
   - User-friendly error messages

3. **Processing Errors:**
   - Real-time status updates during PDF processing
   - Error states in processing status component
   - Retry mechanisms for failed operations

## Debugging

### Frontend Debugging
```bash
# Enable debug mode
export REACT_APP_DEBUG=true

# Check browser console for:
# - API requests and responses
# - State changes
# - Error messages
```

### Backend Debugging
```bash
# Check backend logs for:
# - Python script execution
# - API request handling
# - Processing status updates
```

### Common Issues

1. **CORS Errors:**
   - Check proxy configuration in frontend package.json
   - Ensure backend CORS is properly configured

2. **Python Script Errors:**
   - Verify Python virtual environment is activated
   - Check Python dependencies installation
   - Run Python scripts manually to debug

3. **Qdrant Connection Issues:**
   - Verify Qdrant is running on correct port
   - Check firewall settings
   - Test Qdrant health endpoint: http://localhost:6333/health

## Production Deployment

### Frontend Build
```bash
cd frontend
npm run build
```

### Environment Variables
```env
# Frontend
REACT_APP_API_URL=https://your-backend-domain.com/api

# Backend
NODE_ENV=production
OPENAI_API_KEY=your_production_api_key
QDRANT_HOST=your_qdrant_host
```

### Docker Deployment
```bash
# Start all services
docker-compose up -d

# Or build and start
docker-compose up --build
```

## Testing the Integration

### Manual Testing Steps

1. **Upload Test:**
   ```bash
   # Upload a PDF file
   curl -X POST -F "file=@test.pdf" http://localhost:5000/api/pdf/upload
   ```

2. **Processing Check:**
   ```bash
   # Check processing status
   curl http://localhost:5000/api/pdf/<documentId>/status
   ```

3. **Quiz Generation:**
   ```bash
   # Generate quiz
   curl -X POST http://localhost:5000/api/quiz/generate \
     -H "Content-Type: application/json" \
     -d '{"documentId": "doc_123", "quizType": "mcq", "questionCount": 5}'
   ```

### Automated Testing

Create a simple test script:

```javascript
// test-integration.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testIntegration() {
  // Health check
  const health = await axios.get('http://localhost:5000/api/health');
  console.log('Health check:', health.data);
  
  // Add more tests here...
}

testIntegration().catch(console.error);
```

## Performance Optimization

### Frontend Optimizations
- Code splitting with React.lazy()
- Image optimization for file uploads
- Debouncing for search inputs
- Caching API responses

### Backend Optimizations
- Request rate limiting
- Response compression
- Connection pooling for database
- Async processing for heavy operations

## Security Considerations

1. **File Upload Security:**
   - File type validation
   - File size limits
   - Virus scanning (recommended)

2. **API Security:**
   - Input validation
   - Rate limiting
   - CORS configuration
   - API key management

3. **Environment Variables:**
   - Never commit .env files
   - Use different keys for development/production
   - Rotate API keys regularly

## Monitoring

### Frontend Monitoring
- Console logs for debugging
- Error boundary for React errors
- Performance monitoring with Web Vitals

### Backend Monitoring
- Request logging
- Python script execution logs
- Health check endpoints
- Performance metrics

## Next Steps

1. **Enhanced Features:**
   - Real-time WebSocket updates
   - Progress bars for generation
   - Quiz analytics and insights

2. **Testing:**
   - Unit tests for components
   - Integration tests for API
   - End-to-end testing with Cypress

3. **Deployment:**
   - CI/CD pipeline setup
   - Production monitoring
   - Backup strategies

---

For more detailed information, see the individual README files in the backend and frontend directories.