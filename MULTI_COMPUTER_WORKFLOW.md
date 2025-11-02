# Multi-Computer Workflow Guide

**Best Practices for Working Across Multiple Development Machines**

This guide ensures seamless development across multiple computers by maintaining proper Git hygiene and automated checks.

---

## 🎯 Core Principle

**"Commit and Push Everything Before Switching"**

Always leave the repository in a clean, pushable state when finishing work. This ensures:
- No lost work
- No merge conflicts
- Consistent state across all machines
- Clean production deployments

---

## 📋 Pre-Switch Checklist

Before closing your session on any computer, run:

```bash
# Quick check script (run this every time)
npm run pre-switch
```

Or manually verify:

1. **Check for uncommitted changes**
   ```bash
   git status
   ```

2. **Check for untracked files that should be committed**
   ```bash
   git ls-files --others --exclude-standard
   ```

3. **Verify all changes are pushed**
   ```bash
   git log origin/main..HEAD
   ```

4. **Check stash (should be empty before switching)**
   ```bash
   git stash list
   ```

---

## 🔧 Files That Should NEVER Be Committed

These are already in `.gitignore`:

### Environment & Secrets
- `.env` - Never commit secrets
- `.env*.local` - Local environment overrides
- `*.pem` - Private keys

### Build Artifacts
- `node_modules/` - Dependencies (managed by package.json)
- `.next/` - Next.js build output
- `out/` - Static export output
- `build/` - Production builds
- `*.tsbuildinfo` - TypeScript incremental builds

### Local Configuration
- `.vercel/` - Vercel CLI local config
- `.clerk/` - Clerk local config (may contain secrets)
- `.DS_Store` - macOS file system metadata

### Development Files
- `sample-labels/` - Test images (too large for Git)
- `npm-debug.log*` - Debug logs
- `yarn-debug.log*` - Debug logs

---

## ✅ Files That SHOULD Be Committed

These files ensure consistency across machines:

### Project Configuration
- `package.json` - Dependencies and scripts
- `package-lock.json` - Exact dependency versions
- `tsconfig.json` - TypeScript configuration
- `next.config.js` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `vercel.json` - Deployment configuration

### Environment Templates
- `.env.example` - Template for required environment variables

### Claude Configuration
- `.claude/settings.local.json` - Approved command permissions
  - **Note:** This IS committed to sync Claude permissions across machines
  - Contains no secrets, only command allowlist

### Code & Documentation
- All source files (`app/`, `components/`, `lib/`)
- Documentation (`*.md` files)
- Database migrations (`supabase/migrations/`)
- Test scripts (`*.js` test files)

---

## 🚀 Automated Workflow Scripts

### 1. Pre-Switch Check (`scripts/pre-switch.sh`)

Automatically checks if you're ready to switch computers:

```bash
#!/bin/bash
# Run this before switching computers

echo "🔍 Checking repository status..."

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Uncommitted changes detected:"
  git status --short
  echo ""
  echo "Run: git add . && git commit -m 'your message' && git push"
  exit 1
fi

# Check for unpushed commits
if [[ -n $(git log origin/main..HEAD) ]]; then
  echo "❌ Unpushed commits detected:"
  git log origin/main..HEAD --oneline
  echo ""
  echo "Run: git push"
  exit 1
fi

# Check for stashed changes
if [[ -n $(git stash list) ]]; then
  echo "⚠️  Warning: You have stashed changes:"
  git stash list
  echo ""
  echo "Consider: git stash pop (to restore) or git stash clear (to discard)"
fi

echo "✅ Repository is clean and pushed!"
echo "✅ Safe to switch computers."
exit 0
```

### 2. Post-Pull Setup (`scripts/post-pull.sh`)

Run this when starting work on a new computer:

```bash
#!/bin/bash
# Run this after pulling on a new computer

echo "🔄 Setting up workspace..."

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Install any new dependencies
if ! diff package-lock.json <(git show HEAD:package-lock.json) > /dev/null 2>&1; then
  echo "📦 Installing updated dependencies..."
  npm install
fi

# Clear Next.js cache
if [ -d ".next" ]; then
  echo "🧹 Clearing Next.js cache..."
  rm -rf .next
fi

# Check environment variables
echo "🔐 Checking environment variables..."
if [ ! -f ".env.local" ]; then
  echo "⚠️  Warning: .env.local not found!"
  echo "   Copy .env.example to .env.local and fill in your secrets."
fi

echo "✅ Workspace ready!"
```

### 3. Quick Status (`scripts/status.sh`)

Shows comprehensive repository status:

```bash
#!/bin/bash
# Quick status check

echo "📊 Repository Status"
echo "==================="
echo ""

echo "Branch:"
git branch --show-current
echo ""

echo "Last Commit:"
git log -1 --oneline
echo ""

echo "Uncommitted Changes:"
git status --short || echo "  (none)"
echo ""

echo "Unpushed Commits:"
git log origin/main..HEAD --oneline || echo "  (none)"
echo ""

echo "Stashed Changes:"
git stash list || echo "  (none)"
```

---

## 🔄 Typical Workflow

### Ending Work Session (Computer A)

1. **Save all files** in your editor
2. **Run automated check:**
   ```bash
   npm run pre-switch
   ```
3. **If issues found, fix them:**
   ```bash
   git add .
   git commit -m "Descriptive message about changes"
   git push origin main
   ```
4. **Verify clean state:**
   ```bash
   npm run pre-switch
   ```
5. **Close editor and terminal**

### Starting Work Session (Computer B)

1. **Pull latest changes:**
   ```bash
   npm run post-pull
   ```
2. **Verify environment:**
   ```bash
   npm run status
   ```
3. **Start development server:**
   ```bash
   npm run dev
   ```

---

## 🛡️ Git Pre-Commit Hook

Automatically checks before each commit to prevent common mistakes:

**File:** `.git/hooks/pre-commit`

```bash
#!/bin/bash
# Pre-commit hook to check for common issues

echo "Running pre-commit checks..."

# Check for secrets in staged files
if git diff --cached --name-only | xargs grep -E "(sk-ant-api|sk-proj-|pk_live_|sk_live_|whsec_)" 2>/dev/null; then
  echo "❌ ERROR: Potential API key/secret detected!"
  echo "   Please remove secrets from staged files."
  exit 1
fi

# Check for console.log in production code
if git diff --cached --name-only | grep -E "^app/|^components/|^lib/" | xargs grep -n "console\.log" 2>/dev/null; then
  echo "⚠️  WARNING: console.log found in production code"
  echo "   Consider removing or using proper logging."
  # Don't block commit, just warn
fi

# Check TypeScript errors
npm run typecheck --silent
if [ $? -ne 0 ]; then
  echo "❌ ERROR: TypeScript errors detected!"
  echo "   Fix type errors before committing."
  exit 1
fi

echo "✅ Pre-commit checks passed!"
exit 0
```

---

## 🚨 Common Pitfalls to Avoid

### 1. **Forgetting to Push**
**Problem:** Commit locally but forget to push
**Solution:** Use `pre-switch` script before closing

### 2. **Stashing Instead of Committing**
**Problem:** Stash changes to "save for later", then switch computers
**Solution:** Commit instead of stashing. If work is incomplete, use WIP commits:
```bash
git commit -m "WIP: implementing feature X"
```

### 3. **Local-Only Configuration Changes**
**Problem:** Make config changes only on one computer
**Solution:** Keep configuration in Git. Use `.env.local` for machine-specific values.

### 4. **Uncommitted `.claude/settings.local.json`**
**Problem:** Different Claude permissions on different computers
**Solution:** Commit this file - it contains no secrets, just command allowlist

### 5. **Node Modules Out of Sync**
**Problem:** Different dependency versions across computers
**Solution:** Always run `npm install` after pulling if `package-lock.json` changed

---

## 📦 NPM Scripts for Workflow

Add these to `package.json`:

```json
{
  "scripts": {
    "pre-switch": "bash scripts/pre-switch.sh",
    "post-pull": "bash scripts/post-pull.sh",
    "status": "bash scripts/status.sh",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf .next node_modules"
  }
}
```

---

## 🔍 Troubleshooting

### "Your branch is behind origin/main"
```bash
git pull origin main
```

### "Your branch has diverged"
```bash
# Check what's different
git log HEAD..origin/main --oneline
git log origin/main..HEAD --oneline

# If safe, rebase
git pull --rebase origin main
```

### "Merge conflict"
```bash
# Resolve conflicts in editor, then:
git add .
git commit -m "Resolve merge conflicts"
git push
```

### "Forgot to commit on previous computer"
**Don't panic!** Just commit and push from the other computer when you return to it.

---

## 📊 Visual Workflow Diagram

```
Computer A                  GitHub                Computer B
─────────────────────────────────────────────────────────────

[Work + Commit]  ──────────>  [Push]
                              [origin/main]
                                   │
                                   │
                                   └──────────> [Pull]
                                                [Work + Commit]
                                                      │
                              [Push]  <───────────────┘
                              [origin/main]
       │                           │
       │                           │
[Pull] <────────────────────────────
[Continue Work]
```

---

## ✅ Quick Reference Card

**Before Switching Computers:**
```bash
npm run pre-switch    # Check status
git push              # Push if needed
```

**After Pulling on New Computer:**
```bash
npm run post-pull     # Pull + install
npm run status        # Verify state
npm run dev           # Start working
```

**During Development:**
```bash
git status            # Check changes
git add .             # Stage all
git commit -m "msg"   # Commit
git push              # Push immediately
```

---

## 🎓 Best Practices Summary

1. ✅ **Commit often** - Small, focused commits are better than large ones
2. ✅ **Push immediately** - Don't accumulate local commits
3. ✅ **Pull first** - Always pull before starting new work
4. ✅ **Use descriptive commit messages** - Future you will thank you
5. ✅ **Never commit secrets** - Use `.env.local` for local secrets
6. ✅ **Keep dependencies synced** - Run `npm install` after pulling
7. ✅ **Use the scripts** - Automate checks with `pre-switch` and `post-pull`
8. ✅ **Check before closing** - Run `pre-switch` before shutting down
9. ✅ **Document assumptions** - If something is machine-specific, document it
10. ✅ **Test on production** - Vercel deploys from GitHub, so keep GitHub clean

---

## 🔗 Related Documentation

- `.env.example` - Environment variable template
- `DEPLOYMENT_GUIDE.md` - Production deployment process
- `SESSION_NOTES.md` - Development session history
- `.gitignore` - Files excluded from Git
