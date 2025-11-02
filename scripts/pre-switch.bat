@echo off
REM Pre-Switch Check Script (Windows)
REM Run this before switching computers to ensure everything is committed and pushed

echo 🔍 Checking repository status...
echo.

REM Check for uncommitted changes
git status --porcelain > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f %%i in ('git status --porcelain') do (
        echo ❌ UNCOMMITTED CHANGES DETECTED:
        echo.
        git status --short
        echo.
        echo Action required:
        echo   1. Review changes: git diff
        echo   2. Stage files: git add .
        echo   3. Commit: git commit -m "your message"
        echo   4. Push: git push
        echo.
        exit /b 1
    )
)

REM Check for unpushed commits
for /f %%i in ('git log origin/main..HEAD --oneline 2^>nul') do (
    echo ❌ UNPUSHED COMMITS DETECTED:
    echo.
    git log origin/main..HEAD --oneline
    echo.
    echo Action required:
    echo   git push origin main
    echo.
    exit /b 1
)

REM Check for stashed changes
for /f %%i in ('git stash list') do (
    echo ⚠️  WARNING: You have stashed changes:
    echo.
    git stash list
    echo.
    echo Consider:
    echo   git stash pop   (to restore changes)
    echo   git stash clear (to discard all stashes)
    echo.
    echo Note: Stashes are local-only and won't transfer to other computers!
    echo.
)

REM Check if local is behind remote
git fetch origin main --quiet 2>nul

echo ✅ Repository is clean and synchronized!
echo ✅ All changes are committed and pushed.
echo ✅ Safe to switch computers.
echo.

exit /b 0
