# Session Shutdown Prompt

**Copy and paste this at the end of each session:**

---

## 🏁 Session Shutdown

Ensure clean state and document progress:

1. **Verify clean repository state**
   - Run pre-switch check
   - Commit any uncommitted changes
   - Push all commits to GitHub
   - Clear or document any stashes

2. **Test key functionality** (if changes made)
   - Run typecheck (npm run typecheck)
   - Test in dev server if UI changes
   - Verify no obvious errors

3. **Update SESSION_NOTES.md** with:
   - Session number and date
   - Summary of what was completed
   - Files modified (with line counts)
   - Key decisions made
   - Next session priorities
   - Any open issues or blockers

4. **Create session summary** including:
   - ✅ Completed tasks
   - 📊 Metrics (commits, files, lines)
   - 🎯 Production ready? (YES/NO)
   - 🔄 Next priorities (top 3)
   - ⚠️ Open issues or concerns

5. **Commit and push all changes** including:
   - Code changes
   - Updated SESSION_NOTES.md
   - Any new documentation

6. **Final verification**
   - Run npm run pre-switch
   - Confirm ✅ "Safe to switch computers"

---

## 📋 Quick Copy-Paste Version

```
🏁 SESSION SHUTDOWN

Please help me close this development session properly:

1. Run pre-switch check and fix any issues
2. Test changes made (typecheck, dev server test)
3. Update SESSION_NOTES.md with session summary
4. Create comprehensive session summary with:
   - Completed work
   - Metrics (commits, files, lines changed)
   - Production readiness
   - Next priorities
   - Open issues
5. Commit and push everything (including session notes)
6. Final pre-switch verification
7. Confirm "✅ Safe to switch computers"
```

---

## 💡 Pro Tip

**Ultra-short version:**
```
Close session: verify clean state, update notes, comprehensive summary, commit all, confirm ready to switch.
```

---

## 🎯 What You'll Get Back

After running this, I'll provide:

```
🏁 Session Shutdown Report
═══════════════════════════════════════

Pre-Switch Check:
  ✅ No uncommitted changes
  ✅ All commits pushed
  ✅ No stashes
  ✅ In sync with remote

Testing:
  ✅ TypeScript: No errors
  ✅ Dev server: Starts successfully
  ✅ Key features: Tested manually

Session Summary:
═══════════════════════════════════════

Session X - [Date] - [Duration: ~2 hours]

✅ Completed:
  - Multi-computer workflow automation
  - Created 3 cross-platform scripts (pre-switch, post-pull, status)
  - Comprehensive documentation (2 guides)
  - Updated package.json with workflow commands

📊 Metrics:
  Commits: 3
  Files changed: 13 (+1,124 / -2)
  New files: 10
  Documentation: 3 markdown files

🎯 Production Ready: YES
  All changes tested locally
  Scripts validated
  Documentation complete

🔄 Next Session Priorities:
  1. Test multi-computer workflow on second machine
  2. Fix marketing claims consistency (Session 3 carryover)
  3. Apply pending database migrations (4 pending)

⚠️ Open Issues:
  - None blocking
  - Note: 3 old git stashes cleared

Changes Committed:
  ✅ 77471fa - Add multi-computer workflow automation
  ✅ 9decfb8 - Update Claude settings with permissions
  ✅ 46001f6 - Add quick reference guide
  ✅ 77cbfb7 - Add collaboration recommendations
  ✅ All pushed to origin/main

Final Verification:
  ✅ Running npm run pre-switch...
  ✅ Repository is clean and synchronized!
  ✅ Safe to switch computers.

═══════════════════════════════════════

Session closed successfully! 🎉
You can safely close your terminal and switch computers.
```

---

## 🔧 Customization

**Add to the prompt if you want:**
- "Deploy to production if tests pass"
- "Create a pull request instead of pushing to main"
- "Tag this commit as a release"
- "Run full test suite before closing"

**Example customized prompt:**
```
Close session and deploy to production if all checks pass.
Send me the production URL to verify.
```

---

## ⚡ Power User Shortcuts

### Minimal Shutdown (if no changes)
```
Quick shutdown: just verify clean state and summarize what we discussed.
```

### Emergency Shutdown (need to leave quickly)
```
Emergency shutdown: commit and push everything immediately with WIP message.
```

### Extended Shutdown (major milestone)
```
Full shutdown with deployment: close session, deploy to production, verify live, send summary.
```
