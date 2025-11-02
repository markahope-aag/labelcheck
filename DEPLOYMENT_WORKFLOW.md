# Quick Deployment Workflow Guide

## 🚀 Daily Workflow

### Starting New Feature

```powershell
# Option 1: Use helper function (recommended)
. .\scripts\deploy-helpers.ps1
New-FeatureBranch "add-pdf-export"

# Option 2: Manual commands
git checkout main
git pull origin main
git checkout -b feature/add-pdf-export
```

---

### Making Changes & Testing Locally

```powershell
# 1. Make your code changes
# 2. Test locally
npm run dev

# 3. Run checks before committing
npm run pre-deploy
```

---

### Deploying Preview (Feature Branch)

```powershell
# Option 1: Use helper function
Push-FeatureBranch

# Option 2: Manual
git add .
git commit -m "feat: add PDF export functionality"
git push origin feature/add-pdf-export
```

**Result:** Vercel automatically creates preview deployment at:
- `https://labelcheck-git-feature-add-pdf-export-[team].vercel.app`
- Check Vercel dashboard for exact URL

---

### Deploying to Production

```powershell
# Option 1: Use helper function (recommended)
Deploy-Production "feature/add-pdf-export"

# Option 2: Manual
git checkout main
git pull origin main
git merge feature/add-pdf-export --no-ff
git push origin main
```

**Result:** Production deployment to https://labelcheck.io

---

## 🔍 Before Every Production Deploy

**Always run pre-deploy checks:**

```powershell
npm run pre-deploy
```

This checks:
- ✅ TypeScript compiles
- ✅ ESLint passes
- ✅ Code is formatted
- ✅ Build succeeds
- ✅ Branch status

---

## 📋 Common Scenarios

### Scenario 1: Quick Fix

```powershell
# 1. Create branch
git checkout -b fix/allergen-bug

# 2. Fix code
# ... make changes ...

# 3. Test locally
npm run dev

# 4. Commit and push
git add .
git commit -m "fix: resolve allergen detection bug"
git push origin fix/allergen-bug

# 5. Test preview, then merge
git checkout main
git merge fix/allergen-bug
git push origin main
```

### Scenario 2: Feature with Multiple Commits

```powershell
# 1. Create branch
git checkout -b feature/multi-step-feature

# 2. Make changes, commit frequently
git add .
git commit -m "feat: add step 1"
git push origin feature/multi-step-feature

# ... work continues ...

git add .
git commit -m "feat: add step 2"
git push origin feature/multi-step-feature

# 3. When ready, merge to main
git checkout main
git merge feature/multi-step-feature
git push origin main
```

### Scenario 3: Hotfix (Urgent Production Fix)

```powershell
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. Fix urgently
# ... make minimal fix ...

# 3. Test quickly
npm run typecheck  # At minimum

# 4. Deploy immediately
git add .
git commit -m "hotfix: critical bug fix"
git checkout main
git merge hotfix/critical-bug
git push origin main

# 5. Clean up later
git branch -d hotfix/critical-bug
```

---

## ⚠️ Important Rules

1. **Never skip pre-deploy checks** before production
2. **Always test preview** before merging to main
3. **Use descriptive branch names**: `feature/`, `fix/`, `hotfix/`
4. **Write clear commit messages**: Use conventional commits
5. **Monitor deployments** in Vercel dashboard

---

## 🆘 Troubleshooting

### Build Fails in Vercel

1. Check Vercel logs: Dashboard → Deployment → Logs
2. Run locally: `npm run build`
3. Check environment variables in Vercel dashboard
4. Verify Node version matches Vercel

### Preview Not Created

1. Ensure branch is pushed: `git push origin <branch>`
2. Check Vercel project settings → Git
3. Verify "Automatic Preview Deployments" is enabled

### Production Deployment Fails

1. Check Vercel logs
2. Rollback: Vercel Dashboard → Deployments → Previous → Promote
3. Fix on feature branch
4. Re-deploy when fixed

---

## 📞 Quick Reference

```powershell
# Setup helpers (one time)
. .\scripts\deploy-helpers.ps1

# Daily workflow
New-FeatureBranch "my-feature"     # Create branch
# ... make changes ...
Push-FeatureBranch                  # Deploy preview
# ... test preview ...
Deploy-Production "my-feature"    # Deploy to production

# Status checks
Show-DeploymentStatus               # Check current state
npm run pre-deploy                  # Run all checks
```

---

**Remember:** Preview first, then production! 🎯

