@echo off
REM Quick Status Script (Windows)
REM Shows comprehensive repository status

echo 📊 Repository Status
echo ═══════════════════════════════════════════════════════
echo.

REM Branch info
echo 📍 Current Branch:
for /f "delims=" %%i in ('git branch --show-current') do echo    %%i
echo.

REM Last commit
echo 🕐 Last Commit:
git log -1 --format="   %%h - %%s (%%ar)"
echo.

REM Uncommitted changes
echo 📝 Uncommitted Changes:
git status --porcelain > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    git status --short | findstr /r "^" > nul
    if %ERRORLEVEL% EQU 0 (
        git status --short
    ) else (
        echo    (none^)
    )
) else (
    echo    (none^)
)
echo.

REM Unpushed commits
echo ⬆️  Unpushed Commits:
git log origin/main..HEAD --oneline 2>nul | findstr /r "^" > nul
if %ERRORLEVEL% EQU 0 (
    git log origin/main..HEAD --oneline
) else (
    echo    (none^)
)
echo.

REM Stashed changes
echo 💾 Stashed Changes:
git stash list | findstr /r "^" > nul
if %ERRORLEVEL% EQU 0 (
    git stash list
) else (
    echo    (none^)
)
echo.

REM Sync status
echo 🔄 Sync Status:
git fetch origin main --quiet 2>nul
echo    ✅ Checking sync with origin/main...
echo.

REM Environment check
echo 🔐 Environment:
if exist ".env.local" (
    echo    ✅ .env.local exists
) else (
    echo    ❌ .env.local missing
)
echo.

REM Node modules check
if exist "node_modules" (
    echo 📦 Dependencies: Installed
) else (
    echo 📦 Dependencies: Not installed (run: npm install^)
)
echo.

echo ═══════════════════════════════════════════════════════

exit /b 0
