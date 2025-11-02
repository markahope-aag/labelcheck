# 🚀 Quick Start: Improved Workflow Setup

Follow these steps to improve your deployment workflow for https://labelcheck.io

## ⚡ 5-Minute Setup

### Step 1: Test Pre-Deploy Script

```powershell
npm run pre-deploy
```

This will check TypeScript, linting, formatting, and build. Fix any errors that appear.

---

### Step 2: Load PowerShell Helpers (Optional but Recommended)

Add to your PowerShell profile for easy access:

```powershell
# Edit your profile
notepad $PROFILE

# Add this line:
. C:\Users\markh\projects\labelcheck\scripts\deploy-helpers.ps1
```

Or load manually each session:
```powershell
. .\scripts\deploy-helpers.ps1
```

---

### Step 3: Set Up Feature Branch Workflow

**Instead of pushing directly to main:**

```powershell
# OLD WAY (risky):
git add .
git commit -m "fix bug"
git push origin main  # ❌ Goes straight to production!

# NEW WAY (safe):
git checkout -b feature/bug-fix
git add .
git commit -m "fix: resolve bug"
git push origin feature/bug-fix  # ✅ Creates preview first
# Test preview, then merge to main
```

---

### Step 4: Configure Vercel Preview Deployments

1. Go to https://vercel.com → Your Project → Settings → Git
2. Ensure "Production Branch" is set to `main`
3. Verify "Automatic Preview Deployments" is **enabled**
4. All branches except `main` will get preview URLs automatically

---

## ✅ Test Your New Workflow

Try this once to verify everything works:

```powershell
# 1. Create test branch
git checkout -b test/preview-deployment

# 2. Make a small change (add a comment, update README, etc.)
# ... make change ...

# 3. Commit
git add .
git commit -m "test: verify preview deployment workflow"

# 4. Push for preview
git push origin test/preview-deployment

# 5. Check Vercel dashboard
# You should see a new preview deployment!

# 6. Test it works, then merge
git checkout main
git merge test/preview-deployment
git push origin main

# 7. Clean up
git branch -d test/preview-deployment
```

---

## 📋 Daily Checklist

Before every production deploy:

- [ ] Run `npm run pre-deploy` (all checks pass)
- [ ] Test on preview deployment
- [ ] Verify changes work as expected
- [ ] Check Vercel dashboard for any warnings
- [ ] Then merge to main

---

## 🎯 Key Improvements Summary

1. ✅ **Preview Deployments**: Test before production
2. ✅ **Pre-Deploy Checks**: Catch errors early
3. ✅ **PowerShell Helpers**: Faster workflow
4. ✅ **Better Git Flow**: Feature branches → Preview → Production

---

## 💡 Quick Tips

### View Deployment Status
```powershell
Show-DeploymentStatus
```

### Create and Push Feature Branch Quickly
```powershell
New-FeatureBranch "my-feature"
# ... make changes ...
Push-FeatureBranch
```

### Deploy to Production Safely
```powershell
Deploy-Production "feature/my-feature"
```

---

## 🆘 Need Help?

- See `WORKFLOW_IMPROVEMENTS.md` for detailed explanations
- See `DEPLOYMENT_WORKFLOW.md` for step-by-step guides
- Check Vercel dashboard for deployment logs

---

**You're all set!** Start using feature branches for all changes. 🚀

