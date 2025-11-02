#!/bin/bash
# Quick Status Script
# Shows comprehensive repository status

echo "📊 Repository Status"
echo "═══════════════════════════════════════════════════════"
echo ""

# Branch info
echo "📍 Current Branch:"
echo "   $(git branch --show-current)"
echo ""

# Last commit
echo "🕐 Last Commit:"
git log -1 --format="   %h - %s (%ar)" --color=always
echo ""

# Uncommitted changes
echo "📝 Uncommitted Changes:"
if [[ -n $(git status --porcelain) ]]; then
  git status --short | sed 's/^/   /'
else
  echo "   (none)"
fi
echo ""

# Unpushed commits
echo "⬆️  Unpushed Commits:"
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null || echo "")
if [[ -n "$UNPUSHED" ]]; then
  echo "$UNPUSHED" | sed 's/^/   /'
else
  echo "   (none)"
fi
echo ""

# Stashed changes
echo "💾 Stashed Changes:"
STASHED=$(git stash list)
if [[ -n "$STASHED" ]]; then
  echo "$STASHED" | sed 's/^/   /'
else
  echo "   (none)"
fi
echo ""

# Check sync status
git fetch origin main --quiet 2>/dev/null || true
LOCAL=$(git rev-parse @ 2>/dev/null || echo "")
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")

echo "🔄 Sync Status:"
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "   ✅ In sync with origin/main"
else
  echo "   ⚠️  Out of sync with origin/main"
  BEHIND=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")
  AHEAD=$(git rev-list origin/main..HEAD --count 2>/dev/null || echo "0")

  if [ "$BEHIND" != "0" ]; then
    echo "   📥 Behind by $BEHIND commits (run: git pull)"
  fi
  if [ "$AHEAD" != "0" ]; then
    echo "   📤 Ahead by $AHEAD commits (run: git push)"
  fi
fi
echo ""

# Environment check
echo "🔐 Environment:"
if [ -f ".env.local" ]; then
  echo "   ✅ .env.local exists"
else
  echo "   ❌ .env.local missing"
fi
echo ""

# Node modules check
if [ -d "node_modules" ]; then
  echo "📦 Dependencies: Installed"
else
  echo "📦 Dependencies: Not installed (run: npm install)"
fi
echo ""

echo "═══════════════════════════════════════════════════════"

exit 0
