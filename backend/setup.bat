@echo off
REM AI Quiz Backend Setup Script for Windows
echo Setting up AI Quiz Backend with Python Services...

REM Check if Python 3 is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Python 3 is required but not installed. Please install Python 3.8 or higher.
    pause
    exit /b 1
)

echo Python detected ✓

REM Create Python virtual environment
echo Creating Python virtual environment...
cd python_services
python -m venv venv

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install Python dependencies
echo Installing Python dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

REM Check if Tesseract is installed
tesseract --version >nul 2>&1
if errorlevel 1 (
    echo Warning: Tesseract OCR is not installed. Some PDF processing features may not work.
    echo Please install Tesseract OCR from: https://github.com/UB-Mannheim/tesseract/wiki
)

REM Return to backend directory
cd ..

REM Install Node.js dependencies
echo Installing Node.js dependencies...
if not exist "package.json" (
    echo Error: package.json not found. Please run this script from the backend directory.
    pause
    exit /b 1
)

npm install

REM Check if .env file exists, if not create from example
if not exist ".env" (
    echo Creating .env file from .env.example...
    copy .env.example .env
    echo Please edit .env file with your configuration before running the server.
)

REM Create necessary directories
echo Creating necessary directories...
if not exist "uploads" mkdir uploads
if not exist "logs" mkdir logs

REM Check environment
echo Checking Python environment...
cd python_services
call venv\Scripts\activate.bat
python check_environment.py
cd ..

echo.
echo Setup completed! 🎉
echo.
echo Next steps:
echo 1. Edit the .env file with your configuration (OpenAI API key, database connection, etc.)
echo 2. If using Qdrant, make sure it's running:
echo    - Local: docker run -p 6333:6333 qdrant/qdrant
echo    - Or use Qdrant Cloud
echo 3. Start the development server: npm run dev
echo.
echo Important notes:
echo - Python virtual environment is created in python_services\venv
echo - To manually activate it: cd python_services ^&^& venv\Scripts\activate.bat
echo - Make sure all required dependencies are installed before running
pause
