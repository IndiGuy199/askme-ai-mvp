@echo off
REM AskMe AI Test Runner (Windows Batch)
REM Simple test launcher for Windows users

echo 🤖 AskMe AI Test Runner
echo ========================

if "%1"=="" (
    set SCENARIO=basic
) else (
    set SCENARIO=%1
)

echo 📋 Running scenario: %SCENARIO%
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js first.
    echo 💡 Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if test-runner.js exists
if not exist "test-runner.js" (
    echo ❌ test-runner.js not found in current directory.
    echo 💡 Make sure you're running this from the c:\opt\mvp directory
    pause
    exit /b 1
)

REM Install node-fetch if needed
if not exist "node_modules\node-fetch" (
    echo 📦 Installing required dependencies...
    npm install node-fetch
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Run the test
echo 🚀 Starting tests...
echo.
node test-runner.js %SCENARIO% %2 %3 %4 %5

if errorlevel 1 (
    echo.
    echo ❌ Tests completed with errors
) else (
    echo.
    echo ✅ Tests completed successfully
)

echo.
echo 💡 Available scenarios:
echo   basic     - Run basic functionality tests
echo   full      - Run complete test suite
echo   chunking  - Test response chunking
echo   memory    - Test memory functionality
echo   tokens    - Test token management
echo   edge      - Test edge cases
echo   scenario-1, scenario-2, etc. - Run specific scenarios
echo.
echo 💡 Options:
echo   --verbose - Show detailed output
echo   --delay=ms - Set delay between requests
echo.
echo 💡 Examples:
echo   run-tests.bat basic
echo   run-tests.bat full --verbose
echo   run-tests.bat chunking --delay=2000

pause
