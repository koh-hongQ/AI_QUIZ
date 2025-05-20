# Quick Start Guide for AI Quiz Backend

This guide will get you up and running with the AI Quiz backend in just a few minutes.

## Prerequisites

- Node.js 14+ installed
- Python 3.8+ installed
- Docker (for Qdrant) or Qdrant Cloud account

## Step 1: Installation

### Option A: Automatic Setup (Recommended)

```bash
# Clone the repository (if not already done)
cd backend

# Run the setup script
# Linux/macOS:
chmod +x setup.sh
./setup.sh

# Or Windows:
setup.bat
```

### Option B: Manual Setup

```bash
# Install Node.js dependencies
npm install

# Setup Python environment
npm run setup:python

# Create configuration file
cp .env.example .env
```

## Step 2: Configure Environment

Edit the `.env` file with your settings:

```env
# Essential configurations
OPENAI_API_KEY=your_openai_api_key_here
PYTHON_PATH=python3

# Qdrant (choose one)
# Option 1: Local Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Option 2: Qdrant Cloud
QDRANT_HOST=your-cluster-url.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key

# PDF Processing (optional)
USE_LLM_CLEANING=false      # Set to true for better text cleaning
VALIDATE_CHUNKS=false       # Set to true for chunk validation
```

## Step 3: Start Required Services

### Start Qdrant (if using local installation)

```bash
docker run -d -p 6333:6333 qdrant/qdrant
```

### Check Python Environment

```bash
npm run check:env
```

## Step 4: Start the Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## Step 5: Test the API

### Health Check

```bash
curl http://localhost:5000/api/health
```

### Upload and Process a PDF

```bash
curl -X POST -F "file=@your-document.pdf" http://localhost:5000/api/pdf/upload
```

Response:
```json
{
  "success": true,
  "documentId": "doc_1234567890_abcd1234",
  "message": "PDF uploaded successfully and is being processed"
}
```

### Check Processing Status

```bash
curl http://localhost:5000/api/pdf/doc_1234567890_abcd1234/status
```

### Generate a Quiz

```bash
curl -X POST http://localhost:5000/api/quiz/generate \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "doc_1234567890_abcd1234",
    "quizType": "mcq",
    "questionCount": 5
  }'
```

## Common Issues and Solutions

### 1. Python Scripts Not Working

```bash
# Check if Python environment is properly activated
npm run start:python
# Then test a Python script manually
```

### 2. Tesseract Not Found

Install Tesseract OCR:
```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr

# macOS
brew install tesseract

# Then restart the server
```

### 3. Qdrant Connection Issues

```bash
# Check if Qdrant is running
curl http://localhost:6333/health

# If not running, start Qdrant
docker run -d -p 6333:6333 qdrant/qdrant
```

### 4. OpenAI API Errors

- Verify your API key is valid
- Check your OpenAI account has sufficient credits
- Ensure the key has the necessary permissions

## Next Steps

1. **Frontend Integration**: Connect your React frontend to these API endpoints
2. **Database Setup**: Configure MongoDB for persistent storage (optional - the system works with in-memory storage for demo)
3. **Advanced Configuration**: 
   - Enable LLM cleaning: `USE_LLM_CLEANING=true`
   - Enable chunk validation: `VALIDATE_CHUNKS=true`
   - Configure embedding model: `EMBEDDING_MODEL=intfloat/e5-small-v2`

## API Documentation

The backend provides these main endpoints:

- **PDF Processing**: `/api/pdf/*`
- **Quiz Management**: `/api/quiz/*`

For detailed API documentation, see the main [README.md](README.md) file.

## Support

If you encounter issues:

1. Check the logs in the terminal where you started the server
2. Verify environment variables in `.env`
3. Test Python components individually using the scripts in `python_services/`
4. Create an issue in the repository with detailed error messages

Happy quizzing! 🎓✨
