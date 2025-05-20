#!/bin/bash

# AI Quiz Development Start Script
echo "🚀 Starting AI Quiz Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    if command_exists lsof; then
        lsof -i:$1 >/dev/null 2>&1
    elif command_exists netstat; then
        netstat -tlnp 2>/dev/null | grep -q ":$1 "
    else
        return 1
    fi
}

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 14+ before continuing.${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed. Please install npm before continuing.${NC}"
    exit 1
fi

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3.8+ before continuing.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed!${NC}"

# Check if any required ports are already in use
echo -e "\n${BLUE}Checking required ports...${NC}"

if port_in_use 3000; then
    echo -e "${YELLOW}⚠️  Port 3000 is already in use. Please stop the service using this port or run 'pkill -f react-scripts'${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

if port_in_use 5000; then
    echo -e "${YELLOW}⚠️  Port 5000 is already in use. Please stop the service using this port or run 'pkill -f server.js'${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

if port_in_use 6333; then
    echo -e "${YELLOW}⚠️  Port 6333 (Qdrant) is already in use.${NC}"
else
    echo -e "${BLUE}Starting Qdrant vector database...${NC}"
    if command_exists docker; then
        docker run -d --name ai-quiz-qdrant -p 6333:6333 qdrant/qdrant
        echo -e "${GREEN}✅ Qdrant started successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Docker not found. Please start Qdrant manually or install Docker.${NC}"
    fi
fi

# Start backend
echo -e "\n${BLUE}Starting backend server...${NC}"
cd backend

# Check if Python virtual environment exists
if [ ! -d "python_services/venv" ]; then
    echo -e "${YELLOW}Python virtual environment not found. Running setup...${NC}"
    chmod +x setup.sh
    ./setup.sh
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Backend .env file not found. Creating from template...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please configure your .env file with appropriate API keys before running.${NC}"
fi

# Start backend in background
echo -e "${BLUE}Installing backend dependencies...${NC}"
npm install --silent

echo -e "${BLUE}Starting backend server...${NC}"
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid

# Wait for backend to start
sleep 3

# Check if backend started successfully
if ! port_in_use 5000; then
    echo -e "${RED}❌ Backend failed to start. Check ../backend.log for errors.${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ Backend server started on http://localhost:5000${NC}"

# Start frontend
echo -e "\n${BLUE}Starting frontend server...${NC}"
cd ../frontend

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Frontend .env file not found. Creating from template...${NC}"
    cp .env.example .env
fi

# Install frontend dependencies
echo -e "${BLUE}Installing frontend dependencies...${NC}"
npm install --silent

# Start frontend in background
echo -e "${BLUE}Starting frontend development server...${NC}"
npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid

# Wait for frontend to start
sleep 5

# Check if frontend started successfully
if ! port_in_use 3000; then
    echo -e "${RED}❌ Frontend failed to start. Check ../frontend.log for errors.${NC}"
    kill $FRONTEND_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ Frontend server started on http://localhost:3000${NC}"

# Summary
echo -e "\n${GREEN}🎉 Development environment started successfully!${NC}"
echo -e "\n${BLUE}Services:${NC}"
echo -e "  • Frontend: ${GREEN}http://localhost:3000${NC}"
echo -e "  • Backend API: ${GREEN}http://localhost:5000${NC}"
echo -e "  • Qdrant: ${GREEN}http://localhost:6333${NC}"
echo -e "\n${BLUE}Logs:${NC}"
echo -e "  • Backend: ${YELLOW}$(pwd)/backend.log${NC}"
echo -e "  • Frontend: ${YELLOW}$(pwd)/frontend.log${NC}"
echo -e "\n${BLUE}To stop all services:${NC}"
echo -e "  ${YELLOW}./stop-dev.sh${NC}"
echo -e "\n${BLUE}To monitor logs:${NC}"
echo -e "  ${YELLOW}tail -f backend.log${NC}"
echo -e "  ${YELLOW}tail -f frontend.log${NC}"

echo -e "\n${GREEN}Happy coding! 🚀${NC}"
