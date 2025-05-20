@echo off
REM AI Quiz Development Start Script for Windows
echo 🚀 Starting AI Quiz Development Environment...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 14+ before continuing.
    pause
    exit /b 1
)

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python 3 is not installed. Please install Python 3.8+ before continuing.
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed!

REM Check if Qdrant is running
netstat -an | find ":6333" >nul 2>&1
if errorlevel 1 (
    echo Starting Qdrant vector database...
    docker --version >nul 2>&1
    if not errorlevel 1 (
        docker run -d --name ai-quiz-qdrant -p 6333:6333 qdrant/qdrant
        echo ✅ Qdrant started successfully
    ) else (
        echo ⚠️  Docker not found. Please start Qdrant manually or install Docker.
    )
) else (
    echo ⚠️  Port 6333 already in use
)

REM Start backend
echo.
echo Starting backend server...
cd backend

REM Check if .env exists
if not exist ".env" (
    echo Creating .env file from template...
    copy .env.example .env
    echo ⚠️  Please configure your .env file with appropriate API keys.
)

REM Start backend
echo Installing backend dependencies...
npm install
echo Starting backend server...
start "AI Quiz Backend" cmd /c "npm run dev"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend
echo.
echo Starting frontend server...
cd ..\frontend

REM Check if .env exists
if not exist ".env" (
    echo Creating .env file from template...
    copy .env.example .env
)

REM Install and start frontend
echo Installing frontend dependencies...
npm install
echo Starting frontend development server...
start "AI Quiz Frontend" cmd /c "npm start"

REM Wait for services to start
timeout /t 5 /nobreak >nul

echo.
echo 🎉 Development environment started successfully!
echo.
echo Services:
echo   • Frontend: http://localhost:3000
echo   • Backend API: http://localhost:5000
echo   • Qdrant: http://localhost:6333
echo.
echo To stop all services, run: stop-dev.bat
echo.
echo Happy coding! 🚀
pause
