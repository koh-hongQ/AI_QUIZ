@echo off
REM AI Quiz Development Stop Script for Windows
echo 🛑 Stopping AI Quiz Development Environment...

REM Stop frontend processes
echo Stopping frontend server...
taskkill /f /im node.exe /fi "WINDOWTITLE eq AI Quiz Frontend*" >nul 2>&1
if not errorlevel 1 (
    echo ✅ Frontend server stopped
) else (
    echo ❌ Could not stop frontend server
)

REM Stop backend processes
echo Stopping backend server...
taskkill /f /im node.exe /fi "WINDOWTITLE eq AI Quiz Backend*" >nul 2>&1
if not errorlevel 1 (
    echo ✅ Backend server stopped
) else (
    echo ❌ Could not stop backend server
)

REM Stop Qdrant container
echo Stopping Qdrant container...
docker stop ai-quiz-qdrant >nul 2>&1
docker rm ai-quiz-qdrant >nul 2>&1
if not errorlevel 1 (
    echo ✅ Qdrant container stopped
) else (
    echo ❌ Could not stop Qdrant container
)

echo.
echo 🎉 All services stopped successfully!
echo.
echo To start again, run: start-dev.bat
pause
