# Session Startup Prompt

**Copy and paste this at the beginning of each session:**

---

## 🚀 Session Startup

Load context and prepare for work:

1. **Check repository status**
   - Run status check
   - Review recent commits (last 5)
   - Check for uncommitted changes
   - Verify sync with remote

2. **Review last session**
   - Read last 100 lines of SESSION_NOTES.md
   - Identify what was completed
   - Check for open issues or next steps

3. **Environment check**
   - Verify .env.local exists
   - Check if dependencies need updating
   - Confirm development server can start

4. **Present session summary** with:
   - Current branch and latest commit
   - Last session's accomplishments (2-3 bullet points)
   - Pending items or priorities from notes
   - Any issues that need attention
   - Recommendation for what to work on next

5. **Create TodoWrite** if we're starting a multi-step task

---

## 📋 Quick Copy-Paste Version

```
🚀 SESSION STARTUP

Please help me start this development session:

1. Check repository status (npm run status, git log -5)
2. Review last session (head -100 SESSION_NOTES.md)
3. Verify environment (.env.local, dependencies)
4. Summarize current state:
   - Where we left off
   - What's completed
   - What's next
5. Recommend priority for this session
6. Create todos if needed

After loading context, ask me: "What would you like to work on today?"
```

---

## 💡 Pro Tip

Save this in a text file you can quickly copy from, or create a keyboard shortcut/snippet for it.

**Even shorter version:**
```
Load session context: status, recent work, last session notes, and recommend next priority.
```

---

## 🎯 What You'll Get Back

After running this, I'll provide:

```
📊 Session Startup Report
═══════════════════════════════════════

Current Status:
  Branch: main
  Latest: 77cbfb7 - Add collaboration recommendations (2 min ago)
  Uncommitted: None
  Sync: ✅ In sync with origin/main

Last Session Recap (Session X):
  ✅ Completed multi-computer workflow automation
  ✅ Added pre-switch/post-pull/status scripts
  ✅ Created comprehensive documentation

Pending/Next Steps:
  - Fix marketing claims consistency (from Session 3)
  - Apply database migrations (4 pending)
  - Test production deployment

Environment:
  ✅ .env.local exists
  ✅ Dependencies installed
  ✅ Ready to develop

Recommendation:
  Priority 1: Test production features after recent deployment
  Priority 2: Fix marketing claims detection in AI prompt

What would you like to work on today?
```

---

## 🔧 Customization

**Add to the prompt if you want:**
- "Focus on production issues first"
- "Prioritize new features over bugs"
- "Check for any breaking changes in dependencies"
- "Review open GitHub issues"

**Example customized prompt:**
```
Load session context and check production for any issues first.
If production is healthy, recommend next feature to build.
```
