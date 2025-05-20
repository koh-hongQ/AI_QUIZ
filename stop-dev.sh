#!/bin/bash

# AI Quiz Development Stop Script
echo "🛑 Stopping AI Quiz Development Environment..."

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

# Stop frontend
if [ -f "frontend.pid" ]; then
    FRONTEND_PID=$(cat frontend.pid)
    echo -e "${BLUE}Stopping frontend server (PID: $FRONTEND_PID)...${NC}"
    kill $FRONTEND_PID 2>/dev/null
    rm frontend.pid
    echo -e "${GREEN}✅ Frontend server stopped${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend PID file not found. Attempting to kill by process name...${NC}"
    pkill -f "react-scripts" 2>/dev/null
fi

# Stop backend
if [ -f "backend.pid" ]; then
    BACKEND_PID=$(cat backend.pid)
    echo -e "${BLUE}Stopping backend server (PID: $BACKEND_PID)...${NC}"
    kill $BACKEND_PID 2>/dev/null
    rm backend.pid
    echo -e "${GREEN}✅ Backend server stopped${NC}"
else
    echo -e "${YELLOW}⚠️  Backend PID file not found. Attempting to kill by process name...${NC}"
    pkill -f "server.js" 2>/dev/null
fi

# Stop Qdrant Docker container
if command_exists docker; then
    echo -e "${BLUE}Stopping Qdrant container...${NC}"
    docker stop ai-quiz-qdrant 2>/dev/null
    docker rm ai-quiz-qdrant 2>/dev/null
    echo -e "${GREEN}✅ Qdrant container stopped${NC}"
fi

# Clean up log files (optional)
read -p "$(echo -e ${YELLOW}Delete log files? [y/N]:${NC} )" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f backend.log frontend.log
    echo -e "${GREEN}✅ Log files deleted${NC}"
fi

echo -e "\n${GREEN}🎉 All services stopped successfully!${NC}"
echo -e "\n${BLUE}To start again, run:${NC}"
echo -e "  ${YELLOW}./start-dev.sh${NC}"
