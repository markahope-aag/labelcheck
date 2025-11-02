# LabelCheck - Quick Reference Guide

**Fast commands for multi-computer workflow**

---

## 🚀 Before Switching Computers

```bash
npm run pre-switch
```

This checks:
- ✅ All changes committed
- ✅ All commits pushed
- ✅ No stashed changes (warning only)
- ✅ In sync with remote

**If any issues are found, the script will tell you exactly what to fix!**

---

## 🔄 Starting Work on Another Computer

```bash
npm run post-pull
```

This automatically:
- 📥 Pulls latest code
- 📦 Installs new dependencies (if needed)
- 🧹 Clears Next.js cache
- 🔐 Checks for .env.local
- 📊 Shows current status

---

## 📊 Check Current Status

```bash
npm run status
```

Shows:
- Current branch and last commit
- Uncommitted changes
- Unpushed commits
- Stashed changes
- Sync status with remote
- Environment and dependencies status

---

## 🔧 Common Tasks

### Start Development Server
```bash
npm run dev
```

### Check TypeScript Errors
```bash
npm run typecheck
```

### View Git Status
```bash
git status
```

### Commit Changes
```bash
git add .
git commit -m "Your descriptive message"
git push
```

### Pull Latest Changes
```bash
git pull origin main
npm install  # If dependencies changed
```

---

## 🚨 Quick Troubleshooting

### "Your branch is behind"
```bash
git pull origin main
```

### "Uncommitted changes"
```bash
git add .
git commit -m "Description of changes"
git push
```

### "Merge conflict"
1. Open conflicted files in editor
2. Resolve conflicts manually
3. Run:
```bash
git add .
git commit -m "Resolve merge conflicts"
git push
```

### "Node modules missing"
```bash
npm install
```

### "Next.js cache issues"
```bash
rm -rf .next
npm run dev
```

---

## 📝 Daily Workflow

### Morning (starting work)
```bash
cd C:\users\markh\projects\labelcheck
npm run post-pull
npm run dev
```

### During work
- Make changes
- Test locally
- Commit frequently:
  ```bash
  git add .
  git commit -m "Descriptive message"
  git push
  ```

### Evening (switching computers/ending session)
```bash
npm run pre-switch
# If clean, you're done!
# If not, follow the instructions to fix
```

---

## 🎯 Best Practices

1. **Commit often** - Small commits are better than big ones
2. **Push immediately** - Don't accumulate local commits
3. **Pull first** - Always pull before starting new work
4. **Use npm run pre-switch** - Before closing your session
5. **Never commit .env.local** - It's in .gitignore for a reason
6. **Test before committing** - Run `npm run typecheck` if unsure

---

## 📚 More Information

- **Full workflow guide:** `MULTI_COMPUTER_WORKFLOW.md`
- **Project setup:** `SETUP_GUIDE.md`
- **Session notes:** `SESSION_NOTES.md`
- **Deployment:** `DEPLOYMENT_GUIDE.md`

---

## 🔗 Useful Links

- **Production:** https://labelcheck.io
- **GitHub:** https://github.com/markahope-aag/labelcheck
- **Vercel Dashboard:** https://vercel.com/asymmetric1/labelcheck
- **Supabase:** https://supabase.com/dashboard/project/xhmfycuwjknkovtojhdh

---

## 💡 Pro Tips

### Quickly check if you can switch
```bash
npm run pre-switch && echo "✅ Safe to close!" || echo "❌ Fix issues first"
```

### View recent commits
```bash
git log --oneline -10
```

### See what changed in last commit
```bash
git show --stat
```

### Undo last commit (keep changes)
```bash
git reset --soft HEAD~1
```

### View all branches
```bash
git branch -a
```

### Check remote URL
```bash
git remote -v
```

---

**Remember:** When in doubt, run `npm run status` to see the current state!
