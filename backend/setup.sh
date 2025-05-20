#!/bin/bash

# AI Quiz Backend Setup Script

echo "🚀 Setting up AI Quiz Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo "✅ Node.js version: $NODE_VERSION"

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Check if external dependencies are available
echo "🔍 Checking external dependencies..."

# Check for pdftoppm (poppler-utils)
if command -v pdftoppm &> /dev/null; then
    echo "✅ pdftoppm is available"
else
    echo "⚠️  pdftoppm not found. Install poppler-utils for better PDF processing:"
    echo "   Ubuntu/Debian: sudo apt-get install poppler-utils"
    echo "   macOS: brew install poppler"
    echo "   CentOS/RHEL: sudo yum install poppler-utils"
fi

# Check for tesseract
if command -v tesseract &> /dev/null; then
    echo "✅ Tesseract OCR is available"
    tesseract --version | head -1
else
    echo "⚠️  Tesseract not found. Install for OCR functionality:"
    echo "   Ubuntu/Debian: sudo apt-get install tesseract-ocr"
    echo "   macOS: brew install tesseract"
    echo "   CentOS/RHEL: sudo yum install tesseract"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p uploads
mkdir -p logs
mkdir -p temp

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating environment file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your actual configuration values"
else
    echo "✅ Environment file already exists"
fi

# Check Docker and Docker Compose
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "✅ Docker and Docker Compose are available"
    echo "   Run 'docker-compose up -d' to start with Docker"
else
    echo "⚠️  Docker not found. Install Docker for containerized deployment"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your OpenAI API key and other configurations"
echo "2. Start MongoDB and Qdrant (via Docker Compose or locally)"
echo "3. Run 'npm run dev' to start the development server"
echo ""
echo "Useful commands:"
echo "  npm run dev      - Start development server with hot reload"
echo "  npm start        - Start production server"
echo "  docker-compose up -d  - Start all services with Docker"
echo "  npm run clean    - Clean upload and log directories"
