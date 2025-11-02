@echo off
REM Post-Pull Setup Script (Windows)
REM Run this when starting work on a new computer

echo 🔄 Setting up workspace...
echo.

REM Pull latest changes
echo 📥 Pulling latest code from GitHub...
git pull origin main
echo.

REM Install dependencies
echo 📦 Installing/updating dependencies...
call npm install
echo.

REM Clear Next.js cache
if exist ".next" (
    echo 🧹 Clearing Next.js build cache...
    rmdir /s /q .next
    echo.
)

REM Check for environment file
if not exist ".env.local" (
    echo ⚠️  WARNING: .env.local not found!
    echo.
    echo Action required:
    echo   1. Copy .env.example to .env.local
    echo   2. Fill in your environment-specific values
    echo   3. Never commit .env.local (it's in .gitignore^)
    echo.
)

REM Show current status
echo 📊 Current Status:
for /f "delims=" %%i in ('git branch --show-current') do echo   Branch: %%i
for /f "delims=" %%i in ('git log -1 --oneline') do echo   Latest: %%i
echo.

echo ✅ Workspace ready!
echo.
echo Next steps:
echo   npm run dev       # Start development server
echo   npm run typecheck # Check TypeScript types
echo.

exit /b 0
