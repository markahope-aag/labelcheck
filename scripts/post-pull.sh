#!/bin/bash
# Post-Pull Setup Script
# Run this when starting work on a new computer

set -e

echo "🔄 Setting up workspace..."
echo ""

# Pull latest changes
echo "📥 Pulling latest code from GitHub..."
git pull origin main
echo ""

# Check if package-lock.json changed
if ! git diff HEAD@{1} HEAD --quiet -- package-lock.json 2>/dev/null; then
  echo "📦 Dependencies updated - installing..."
  npm install
  echo ""
else
  echo "📦 Dependencies unchanged - skipping install"
  echo ""
fi

# Clear Next.js cache to prevent stale builds
if [ -d ".next" ]; then
  echo "🧹 Clearing Next.js build cache..."
  rm -rf .next
  echo ""
fi

# Check for environment file
if [ ! -f ".env.local" ]; then
  echo "⚠️  WARNING: .env.local not found!"
  echo ""
  echo "Action required:"
  echo "  1. Copy .env.example to .env.local"
  echo "  2. Fill in your environment-specific values"
  echo "  3. Never commit .env.local (it's in .gitignore)"
  echo ""
fi

# Show current branch and latest commit
echo "📊 Current Status:"
echo "  Branch: $(git branch --show-current)"
echo "  Latest: $(git log -1 --oneline)"
echo ""

echo "✅ Workspace ready!"
echo ""
echo "Next steps:"
echo "  npm run dev       # Start development server"
echo "  npm run typecheck # Check TypeScript types"
echo ""

exit 0
