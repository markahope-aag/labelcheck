#!/bin/bash
# Pre-Switch Check Script
# Run this before switching computers to ensure everything is committed and pushed

set -e

echo "🔍 Checking repository status..."
echo ""

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ UNCOMMITTED CHANGES DETECTED:"
  echo ""
  git status --short
  echo ""
  echo "Action required:"
  echo "  1. Review changes: git diff"
  echo "  2. Stage files: git add ."
  echo "  3. Commit: git commit -m 'your message'"
  echo "  4. Push: git push"
  echo ""
  exit 1
fi

# Check for unpushed commits
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null || echo "")
if [[ -n "$UNPUSHED" ]]; then
  echo "❌ UNPUSHED COMMITS DETECTED:"
  echo ""
  echo "$UNPUSHED"
  echo ""
  echo "Action required:"
  echo "  git push origin main"
  echo ""
  exit 1
fi

# Check for stashed changes
STASHED=$(git stash list)
if [[ -n "$STASHED" ]]; then
  echo "⚠️  WARNING: You have stashed changes:"
  echo ""
  echo "$STASHED"
  echo ""
  echo "Consider:"
  echo "  git stash pop   (to restore changes)"
  echo "  git stash clear (to discard all stashes)"
  echo ""
  echo "Note: Stashes are local-only and won't transfer to other computers!"
  echo ""
fi

# Check if local is behind remote
git fetch origin main --quiet
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "⚠️  WARNING: Your local branch differs from remote!"
  echo ""
  echo "Action required:"
  echo "  git pull origin main"
  echo ""
  exit 1
fi

echo "✅ Repository is clean and synchronized!"
echo "✅ All changes are committed and pushed."
echo "✅ Safe to switch computers."
echo ""

exit 0
