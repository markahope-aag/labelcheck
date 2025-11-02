# Keeping AI Assistants in Sync Across Tools

When working with Claude Code and Cursor (or any AI assistant), these practices ensure continuity.

## 🎯 Core Principle

**Git is the source of truth** - Everything should be committed before switching tools.

## 📋 Best Practices

### 1. Commit Before Switching Tools

```powershell
# Before closing Claude Code to switch to Cursor:
git add .
git commit -m "feat: add comment to landing page"
git push

# Now open Cursor - the AI will see your committed changes
```

**Why:** I can only see what's in Git or currently open files.

---

### 2. Use Descriptive Commit Messages

Bad:
```powershell
git commit -m "fixes"
```

Good:
```powershell
git commit -m "fix: resolve allergen detection false positives in GRAS check"
```

**Why:** Commit messages help me understand what changed and why, even if I can't see the diff directly.

---

### 3. Start Sessions with Context

When opening a file in a new session, mention:

```
"I'm working on fixing the pre-deploy script. 
I just removed ESLint from lint-staged in package.json 
because it was causing issues."
```

**Why:** The `attached_files` section shows me recent changes, but context helps me understand the "why."

---

### 4. Check What I Can See

If you're unsure what I know, ask:

```
"What files have been modified recently?"
```

Or:

```
"I made some changes to the orchestrator. 
Can you read that file and summarize what it does?"
```

**Why:** I'll read the current state and give you accurate information.

---

### 5. Document Major Decisions

For significant changes, update documentation:

```markdown
# CHANGELOG.md or SESSION_NOTES.md

## 2025-01-XX
- Removed ESLint from lint-staged (package.json)
  - Reason: Too slow, causing pre-commit delays
  - Alternative: Run ESLint in pre-deploy check instead
```

**Why:** Documentation persists across sessions and tools.

---

## 🔄 Workflow for Switching Tools

### Closing Claude Code (to switch to Cursor):

```powershell
# 1. Save all files
# 2. Check status
npm run pre-switch

# 3. Commit and push everything
git add .
git commit -m "WIP: describe what you're working on"
git push

# 4. Note what you were doing
# (Write a quick note in a file or remember for next session)
```

### Opening Cursor (new session):

```powershell
# 1. Pull latest
git pull origin main

# 2. Tell the AI assistant:
"I'm continuing work on [feature]. 
The last commit was: [describe it]"
```

---

## 📊 What I Can and Can't See

### ✅ I CAN See:
- ✅ Files you open or reference
- ✅ Files I read with tools
- ✅ Recent changes in `attached_files`
- ✅ Committed Git history
- ✅ Project documentation
- ✅ Current conversation context

### ❌ I CANNOT See:
- ❌ Unsaved file changes
- ❌ Uncommitted changes (unless file is open)
- ❌ Changes made in a different tool (until committed)
- ❌ Your previous conversation sessions
- ❌ Files not in the workspace
- ❌ Changes on other branches (unless I read them)

---

## 💡 Pro Tips

### Tip 1: Use Feature Branches
```powershell
# Working on feature X
git checkout -b feature/x

# Make changes in Claude Code, commit
git commit -m "feat: part 1 of feature X"

# Switch to Cursor, pull branch
git pull origin feature/x
# AI can see your committed work
```

### Tip 2: Commit Frequently
```powershell
# Don't wait until feature is "done"
# Commit logical units of work
git commit -m "feat: add user authentication check"
git commit -m "refactor: simplify error handling"
```

### Tip 3: Use WIP Commits for Unfinished Work
```powershell
# If work is incomplete but you need to switch tools:
git commit -m "WIP: refactoring analysis orchestrator - part 1"
git push

# When resuming:
"I'm continuing the orchestrator refactor. 
Last WIP commit was part 1."
```

### Tip 4: Ask Me to Summarize
```powershell
# At the start of a session:
"Can you read [file] and tell me what it does?
I'm planning to modify it for [purpose]."
```

### Tip 5: Document Intent in Comments
```typescript
// TODO: This will be refactored in next session
// Current approach: [explain]
// Planned change: [explain]

function currentFunction() {
  // Implementation
}
```

---

## 🚨 Common Pitfalls

### Pitfall 1: "I made changes but AI doesn't see them"
**Solution:** They're not committed. Run `git status` and commit.

### Pitfall 2: "I told AI in Cursor but now in Claude Code it doesn't know"
**Solution:** Each session is independent. Document decisions or mention them.

### Pitfall 3: "AI suggested code that conflicts with my other changes"
**Solution:** Always pull latest before asking for help:
```powershell
git pull origin main
# Then ask AI to help
```

---

## 📝 Quick Reference

### Before Switching Tools:
```powershell
git status                    # See what's changed
git add .                     # Stage changes
git commit -m "description"    # Commit
git push                      # Push to remote
```

### Starting New Session:
```powershell
git pull                      # Get latest
# Tell AI: "I'm working on [X]. Last thing I did was [Y]."
```

### Need AI Context:
```
"Can you read app/api/analyze/route.ts? 
I need to modify it for [purpose]."
```

---

## 🎯 Bottom Line

1. **Commit often** - Git is our shared memory
2. **Use clear messages** - Help me understand intent
3. **Document decisions** - Especially if switching tools mid-feature
4. **Ask me to read** - I'll get current state
5. **Mention context** - Tell me what you're working on

**Git + Documentation + Clear Communication = Successful Multi-Tool Workflow**

