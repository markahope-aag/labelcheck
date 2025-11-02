# Workflow Improvements for LabelCheck Production Deployment

## Current Setup Assessment
- ✅ Vercel automatic deployments on Git push
- ✅ Environment variable validation
- ✅ Helper scripts for workflow management
- ✅ Prettier and Husky configured
- ⚠️ Direct pushes to main trigger production deployments
- ⚠️ No preview deployments for testing
- ⚠️ ESLint disabled during builds

---

## 🚨 Critical Improvements (Do These First)

### 1. Use Branch Protection with Preview Deployments

**Problem:** Direct pushes to main = immediate production deployment (risky!)

**Solution:** Use feature branches → preview deployments → merge to main

#### Recommended Git Workflow:

```powershell
# 1. Create feature branch
git checkout -b feature/new-analysis-feature

# 2. Make changes and commit
git add .
git commit -m "Add new analysis feature"

# 3. Push to create preview deployment
git push origin feature/new-analysis-feature

# 4. Review preview URL (Vercel automatically creates it)
# Preview URL: https://labelcheck-git-feature-new-analysis-feature-vercel.vercel.app

# 5. Test the preview deployment

# 6. Merge to main after testing
git checkout main
git merge feature/new-analysis-feature
git push origin main  # Triggers production deployment
```

#### Setup in Vercel Dashboard:
1. Go to Project Settings → Git
2. Configure "Production Branch" to `main`
3. Enable "Automatic Preview Deployments"
4. All other branches automatically get preview deployments

---

### 2. Add Pre-commit Hooks (Prevent Bad Code)

**Problem:** Bugs can slip through and deploy to production

**Solution:** Run checks before commits

Update your `.husky/pre-commit` file (create if needed):

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Check formatting
npm run format:check
```

Then install husky (if not already done):
```powershell
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run typecheck && npm run lint"
```

**Benefits:**
- Catches TypeScript errors before push
- Ensures code is formatted consistently
- Prevents broken builds from deploying

---

### 3. Re-enable ESLint in Builds (But Fix Errors First)

**Current:** `eslint: { ignoreDuringBuilds: true }` in `next.config.js`

**Problem:** Build errors are being ignored

**Recommended Approach:**
1. First, fix all existing lint errors:
   ```powershell
   npm run lint
   # Fix errors manually or with:
   npm run lint -- --fix
   ```

2. Then re-enable ESLint:
   ```javascript
   // next.config.js
   const nextConfig = {
     // Remove or comment out:
     // eslint: {
     //   ignoreDuringBuilds: true,
     // },
     // ... rest of config
   };
   ```

3. This ensures lint errors fail builds and prevent bad deployments

---

## 🔧 Workflow Improvements

### 4. Use Conventional Commits for Better History

**Benefits:**
- Automatic changelog generation
- Better commit history
- Can trigger different deployment behaviors

**Format:**
```powershell
# Examples:
git commit -m "feat: add PDF export functionality"
git commit -m "fix: resolve allergen detection bug"
git commit -m "docs: update API documentation"
git commit -m "refactor: simplify analysis orchestrator"
git commit -m "perf: optimize image processing"
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `test:` - Tests
- `chore:` - Maintenance tasks

---

### 5. Create a Deployment Checklist Script

Create `scripts/pre-deploy-check.js`:

```javascript
#!/usr/bin/env node
/**
 * Pre-deployment checklist
 * Run this before pushing to main
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const checks = [];

// Check 1: TypeScript compiles
console.log('🔍 Running TypeScript check...');
try {
  execSync('npm run typecheck', { stdio: 'inherit' });
  checks.push({ name: 'TypeScript', status: '✅' });
} catch (error) {
  checks.push({ name: 'TypeScript', status: '❌', error: error.message });
}

// Check 2: Linting passes
console.log('🔍 Running ESLint...');
try {
  execSync('npm run lint', { stdio: 'inherit' });
  checks.push({ name: 'ESLint', status: '✅' });
} catch (error) {
  checks.push({ name: 'ESLint', status: '❌', error: error.message });
}

// Check 3: Build succeeds
console.log('🔍 Running build...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  checks.push({ name: 'Build', status: '✅' });
} catch (error) {
  checks.push({ name: 'Build', status: '❌', error: error.message });
}

// Check 4: Environment variables documented
console.log('🔍 Checking environment variables...');
const envDocPath = path.join(__dirname, '../VERCEL_ENV_CHECKLIST.md');
if (fs.existsSync(envDocPath)) {
  checks.push({ name: 'Env Docs', status: '✅' });
} else {
  checks.push({ name: 'Env Docs', status: '⚠️', error: 'VERCEL_ENV_CHECKLIST.md not found' });
}

// Summary
console.log('\n📋 Pre-deployment Check Summary:');
checks.forEach(check => {
  console.log(`  ${check.status} ${check.name}`);
  if (check.error) {
    console.log(`     ${check.error}`);
  }
});

const failed = checks.filter(c => c.status === '❌');
if (failed.length > 0) {
  console.log('\n❌ Deployment checks failed! Fix errors before deploying.');
  process.exit(1);
} else {
  console.log('\n✅ All checks passed! Ready to deploy.');
  process.exit(0);
}
```

Add to `package.json`:
```json
{
  "scripts": {
    "pre-deploy": "node scripts/pre-deploy-check.js"
  }
}
```

**Usage:**
```powershell
# Before pushing to main, run:
npm run pre-deploy

# Only push if all checks pass
git push origin main
```

---

### 6. Set Up Deployment Notifications

**Get notified when deployments complete:**

1. **Vercel Dashboard → Settings → Notifications**
   - Enable email notifications
   - Add Slack webhook (optional)
   - Get notified of deployment success/failure

2. **Add Deployment Status Badge** (optional)
   - Shows deployment status in README
   - Builds confidence for users/collaborators

---

### 7. Database Migration Safety

**Current Risk:** Database migrations can break production

**Recommendations:**

1. **Always test migrations on preview database first**
   ```powershell
   # Use Supabase CLI to test migrations locally
   supabase db reset  # Reset local DB
   supabase migration up  # Apply migrations
   ```

2. **Create rollback scripts**
   ```sql
   -- migrations/20250101_add_column.up.sql
   ALTER TABLE analyses ADD COLUMN new_field TEXT;

   -- migrations/20250101_add_column.down.sql
   ALTER TABLE analyses DROP COLUMN new_field;
   ```

3. **Document migration process**
   - Create `MIGRATION_PROCESS.md` with step-by-step guide
   - Include rollback procedures
   - Test on preview deployment before production

---

## 📋 Daily Workflow Best Practices

### Before Starting Work:
```powershell
# 1. Pull latest changes
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/your-feature-name
```

### During Development:
```powershell
# 1. Make changes
# 2. Test locally
npm run dev

# 3. Commit frequently with clear messages
git add .
git commit -m "feat: add feature X"

# 4. Push to create preview
git push origin feature/your-feature-name
```

### Before Merging:
```powershell
# 1. Run pre-deployment checks
npm run pre-deploy

# 2. Test preview deployment thoroughly
# 3. Get code review (if working with team)
# 4. Merge to main
git checkout main
git pull origin main
git merge feature/your-feature-name
git push origin main
```

### After Production Deployment:
```powershell
# 1. Monitor Vercel dashboard for build status
# 2. Test production URL: https://labelcheck.io
# 3. Check error logs in Vercel
# 4. Monitor user reports/feedback
```

---

## 🚀 Advanced Workflow Improvements

### 8. GitHub Actions for Additional Checks (Optional)

Create `.github/workflows/pre-deploy.yml`:

```yaml
name: Pre-deployment Checks

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
```

**Benefits:**
- Automated checks before merge
- Fails PR if checks don't pass
- Works even if pre-commit hooks are skipped

---

### 9. Staging Environment (Optional, for Larger Team)

**Setup:**
1. Create `staging` branch
2. Configure Vercel to deploy `staging` → `staging.labelcheck.io`
3. Workflow: `feature` → `staging` → `main`

**Benefits:**
- Additional testing layer
- Can test with production-like data
- Stakeholders can review before production

---

### 10. Version Tagging and Releases

**Tag releases for easy rollback:**

```powershell
# After successful production deployment:
git tag -a v1.0.1 -m "Release v1.0.1: Fixed allergen detection bug"
git push origin v1.0.1
```

**Rollback to previous version:**
1. In Vercel Dashboard → Deployments
2. Find previous deployment
3. Click "..." → "Promote to Production"

---

## 📝 PowerShell-Specific Tips

### Useful PowerShell Aliases

Add to your PowerShell profile (`$PROFILE`):

```powershell
# Git shortcuts
function gco { git checkout $args }
function gcb { git checkout -b $args }
function gcm { git checkout main }
function gaa { git add . }
function gcm { git commit -m $args }
function gp { git push origin $args }
function gpl { git pull origin $args }

# Deployment workflow
function deploy-feature {
  param($branchName)
  git push origin $branchName
  Write-Host "Preview deployment created! Check Vercel dashboard."
}

function deploy-main {
  npm run pre-deploy
  git push origin main
  Write-Host "Production deployment triggered!"
}
```

**Usage:**
```powershell
deploy-feature feature/new-feature
deploy-main
```

---

## 🔍 Monitoring and Debugging

### 1. Vercel Analytics Dashboard
- Monitor build times
- Track deployment frequency
- Watch for failed builds

### 2. Error Tracking (Recommended: Add Sentry)
```powershell
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**Benefits:**
- Track production errors
- Get alerts on crashes
- See error frequency and impact

### 3. Performance Monitoring
- Use Vercel Analytics for Core Web Vitals
- Monitor API route performance
- Track slow database queries in Supabase

---

## ✅ Quick Start Checklist

- [ ] Enable preview deployments in Vercel
- [ ] Set up pre-commit hooks with Husky
- [ ] Re-enable ESLint in builds (after fixing errors)
- [ ] Create `pre-deploy-check.js` script
- [ ] Test feature branch workflow
- [ ] Set up deployment notifications
- [ ] Document database migration process
- [ ] Add PowerShell aliases (optional)
- [ ] Consider error tracking (Sentry)

---

## 🎯 Priority Order

1. **This Week:** Branch protection + preview deployments
2. **This Week:** Pre-commit hooks
3. **Next Week:** Pre-deploy script
4. **Next Week:** Re-enable ESLint
5. **Next Month:** Error tracking (Sentry)
6. **Next Month:** GitHub Actions (if needed)

---

## 💡 Key Takeaways

1. **Never push directly to main** - Use feature branches
2. **Always test preview deployments** before merging
3. **Run checks before deploying** - TypeScript, lint, build
4. **Monitor deployments** - Watch for failures
5. **Have a rollback plan** - Know how to revert quickly

---

**Questions or issues?** Document them in `WORKFLOW_ISSUES.md` for future reference.

