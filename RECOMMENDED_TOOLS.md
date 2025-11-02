# Recommended Development Tools

**Curated list of tools to boost productivity for Next.js/TypeScript/SaaS development**

Based on your tech stack (Next.js, TypeScript, Supabase, Vercel, Clerk, Stripe) and workflow patterns.

---

## 🚀 **Tier 1: High-Impact Tools** (Install These First)

### 1. **Cursor IDE** (AI-Powered IDE)
**What:** VS Code fork with deeply integrated AI assistance
**Why:** Better than Claude Code for certain tasks
- **Multi-file editing** with AI understanding context across files
- **Inline completions** as you type (like Copilot but smarter)
- **Chat with codebase** - ask questions about your code
- **Cmd+K to generate code** in any file instantly
- **Apply AI changes** with diff preview before accepting

**Best for:**
- Refactoring across multiple files
- Implementing features where you know what you want
- Quick fixes and boilerplate generation
- "Code while you think" flow

**Cost:** $20/month (Pro), Free tier available
**Download:** https://cursor.sh

**When to use Cursor vs Claude Code:**
- Cursor: Quick edits, refactoring, implementation
- Claude Code: Planning, research, complex debugging, learning

---

### 2. **GitHub Copilot** (AI Code Completion)
**What:** AI pair programmer that suggests code as you type
**Why:** Massive time savings for boilerplate and patterns
- Autocompletes entire functions from comments
- Suggests imports automatically
- Learns your coding patterns
- Works in any editor (VS Code, Cursor, etc.)

**Examples:**
```typescript
// Type this comment:
// function to check if user has premium subscription

// Copilot suggests:
export async function hasPremiumSubscription(userId: string): Promise<boolean> {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_tier')
    .eq('user_id', userId)
    .single();

  return subscription?.plan_tier === 'professional' || subscription?.plan_tier === 'business';
}
```

**Best for:** Repetitive code, API integrations, test writing
**Cost:** $10/month (individual), $19/month (business)
**Website:** https://github.com/features/copilot

---

### 3. **Warp Terminal** (Better Terminal)
**What:** Modern terminal with AI, blocks, and workflows
**Why:** Much better than standard terminal for development
- **AI command search** - describe what you want, get command
- **Command blocks** - each command is a collapsible block
- **Workflows** - save common command sequences
- **Split panes** with shared history
- **Fast** - GPU-accelerated, instant search

**Examples:**
- Type: "find all TypeScript files modified in last 2 days"
- Warp AI suggests: `find . -name "*.ts" -mtime -2`

**Best for:** Git operations, running multiple dev servers, debugging
**Cost:** Free (with AI features), $15/month (Teams)
**Download:** https://www.warp.dev (macOS, Linux, Windows beta)

**Alternative for Windows:** **Windows Terminal** (free, built-in)

---

### 4. **Raycast** (macOS) / **PowerToys** (Windows)
**What:** Productivity launcher and utilities
**Why:** Lightning-fast access to everything

**Raycast (macOS):**
- **Quick launcher** (like Spotlight but better)
- **Clipboard history** - never lose copied text
- **Snippets** - paste session startup prompt instantly
- **Extensions** - GitHub, Vercel, npm, Supabase
- **Window management** - snap windows with keyboard
- **Scripts** - run custom scripts from anywhere

**PowerToys (Windows):**
- **PowerToys Run** - quick launcher (Alt+Space)
- **FancyZones** - window snapping
- **Text Extractor** - OCR from screen
- **Keyboard Manager** - remap keys
- **Color Picker** - grab colors with Win+Shift+C

**Best for:** Fast navigation, clipboard management, window control
**Cost:** Free (both)
**Raycast:** https://www.raycast.com
**PowerToys:** https://github.com/microsoft/PowerToys

---

### 5. **Rectangle** (macOS) / **FancyZones** (Windows)
**What:** Window management with keyboard shortcuts
**Why:** Organize windows faster than mouse dragging
- Snap windows to halves, thirds, quarters
- Move windows between monitors
- Restore window positions
- All with keyboard shortcuts

**Examples:**
- `Ctrl+Opt+Left` - Snap to left half
- `Ctrl+Opt+F` - Fullscreen
- `Ctrl+Opt+C` - Center window

**Best for:** Multi-monitor setups, quick window organization
**Cost:** Free
**Rectangle:** https://rectangleapp.com
**FancyZones:** Included in PowerToys (Windows)

---

## 🛠️ **Tier 2: Workflow Enhancers**

### 6. **TablePlus** (Database GUI)
**What:** Beautiful, fast database client
**Why:** Much better than Supabase web interface for dev work
- **Fast queries** - instant results, smart caching
- **Multiple databases** - manage Supabase + local PostgreSQL
- **Export data** easily to CSV, JSON, SQL
- **Query history** - never lose a query
- **SSH tunneling** built-in
- **Beautiful UI** - syntax highlighting, autocomplete

**Best for:** Writing complex queries, data exploration, migrations
**Cost:** $89 one-time (trial available)
**Download:** https://tableplus.com

**Free Alternative:** **DBeaver** (heavier but full-featured)

---

### 7. **Insomnia** or **Bruno** (API Testing)
**What:** REST/GraphQL API client
**Why:** Better than Postman, cleaner than curl

**Insomnia:**
- Beautiful UI, fast
- Environment variables
- GraphQL support
- Free, no account required

**Bruno (Better for Git workflows):**
- **Stores requests in Git** (markdown files)
- Version control your API tests
- Offline-first
- Open source

**Best for:** Testing API endpoints, webhooks, debugging integrations
**Cost:** Free
**Insomnia:** https://insomnia.rest
**Bruno:** https://www.usebruno.com

---

### 8. **Fig** (Terminal Autocomplete)
**What:** Visual autocomplete for terminal commands
**Why:** Never forget command flags again
- **Autocomplete** for 500+ CLI tools (git, npm, vercel, etc.)
- **Visual previews** of what each flag does
- **Script management** - save common commands
- **Shared teams** - team members get same commands

**Example:** Type `git commit -` and see all flags with descriptions

**Best for:** Learning new tools, reducing errors, speed
**Cost:** Free (individuals)
**Download:** https://fig.io

**Note:** Now owned by Amazon, integrating into AWS

---

### 9. **Sizzy** (Browser Testing)
**What:** Browser with built-in device preview
**Why:** Test responsive design instantly
- **All devices** side-by-side (iPhone, iPad, Android, Desktop)
- **Synchronized scrolling** across all devices
- **Screenshot** all devices at once
- **Inspect** any device
- **Hot reload** works across all previews

**Best for:** Testing mobile responsiveness, cross-device debugging
**Cost:** $15/month ($120/year)
**Download:** https://sizzy.co

**Free Alternative:** Browser DevTools device emulation (built-in)

---

### 10. **Excalidraw** (Diagramming)
**What:** Simple, beautiful diagramming tool
**Why:** Quick architecture diagrams without complexity
- **Hand-drawn style** - looks professional but approachable
- **Fast** - keyboard shortcuts for everything
- **Collaborative** - real-time multiplayer
- **Open source** - self-host or use cloud
- **Export** to PNG, SVG, or JSON

**Best for:** Architecture diagrams, flow charts, system design
**Cost:** Free
**Website:** https://excalidraw.com

---

## 🔧 **Tier 3: Specialized Tools**

### 11. **Polypane** (Advanced Browser for Devs)
**What:** Browser built specifically for web developers
**Why:** Most advanced testing tool available
- **Multiple viewports** simultaneously
- **Accessibility testing** built-in
- **Performance metrics** live
- **Debug tools** more powerful than Chrome
- **Screenshot automation**

**Best for:** Professional web dev, accessibility compliance
**Cost:** $13/month ($108/year)
**Download:** https://polypane.app

**Alternative:** Stick with Chrome DevTools (free, very capable)

---

### 12. **DevUtils** (Developer Utilities)
**What:** All-in-one developer utility app (macOS)
**Why:** Stop googling for converters and formatters
- JSON formatter/validator
- Base64 encoder/decoder
- JWT decoder
- Hash generators (MD5, SHA)
- Timestamp converter
- UUID generator
- Color converter
- And 40+ more tools

**Best for:** Quick data transformations
**Cost:** Free
**Download:** https://devutils.com

**Windows Alternative:** **DevToys** (similar tool)
**Online Alternative:** Use websites (slower but works)

---

### 13. **Postman Flows** (Visual API Workflows)
**What:** Visual API workflow builder
**Why:** Test complex multi-step API flows
- **Chain requests** visually
- **Extract data** between steps
- **Conditionals** - branch based on responses
- **Visualize** entire flow

**Example:** Test Stripe webhook → Update database → Send email

**Best for:** Integration testing, workflow debugging
**Cost:** Free tier available
**Website:** https://www.postman.com/product/flows

---

### 14. **Responsively** (Free Sizzy Alternative)
**What:** Open-source responsive testing tool
**Why:** Like Sizzy but free
- Multiple device previews
- Synchronized interactions
- Screenshot all devices
- Hot reload support

**Best for:** Testing responsive design (if budget-conscious)
**Cost:** Free and open source
**Download:** https://responsively.app

---

## 📊 **Tier 4: Monitoring & Analytics**

### 15. **Sentry** (Error Tracking)
**What:** Real-time error monitoring
**Why:** Know about production errors before users complain
- **Stack traces** with context
- **User impact** - how many affected
- **Source maps** - see original TypeScript
- **Performance monitoring** included
- **Release tracking** - which deploy broke it

**Integration:** 5 minutes to add to Next.js
**Best for:** Production debugging, monitoring health
**Cost:** Free tier (5k errors/month), then $26/month
**Website:** https://sentry.io

---

### 16. **LogRocket** (Session Replay)
**What:** Records user sessions like a DVR
**Why:** See exactly what users did before error
- **Video replay** of user sessions
- **Console logs** captured
- **Network requests** logged
- **Redux/state** tracking
- **Links with Sentry** for full context

**Best for:** Debugging complex user-reported issues
**Cost:** $99/month (1k sessions), free trial
**Website:** https://logrocket.com

**Alternative:** **Replay by Sentry** (included in Sentry paid plans)

---

### 17. **Checkly** (Monitoring & Synthetic Testing)
**What:** Monitor your production site constantly
**Why:** Know when things break, before users do
- **API monitoring** - ping endpoints every minute
- **Browser checks** - simulate user flows
- **Global locations** - test from multiple regions
- **Alerts** - Slack, email, SMS
- **Status pages** - public uptime page

**Best for:** Production monitoring, uptime tracking
**Cost:** Free tier (5 checks), then $7/month
**Website:** https://www.checklyhq.com

---

## 🎨 **Tier 5: Design & Collaboration**

### 18. **Figma** (Design Tool)
**What:** Collaborative design and prototyping
**Why:** Work with designers seamlessly
- **Inspect designs** - get exact CSS
- **Export assets** automatically
- **Dev mode** - specs for implementation
- **Prototypes** - see interactions

**Best for:** Implementing designs, working with designers
**Cost:** Free (viewers), $12/month (editors)
**Website:** https://figma.com

---

### 19. **Linear** (Issue Tracking)
**What:** Modern project management for developers
**Why:** Better than Jira, faster than GitHub Issues
- **Keyboard-first** - do everything without mouse
- **Beautiful** - actually pleasant to use
- **Fast** - instant search and loading
- **Git integration** - auto-link commits to issues
- **Roadmap** - plan features visually

**Best for:** Solo dev or small teams, planning work
**Cost:** Free (solo), $8/user/month (team)
**Website:** https://linear.app

**Alternative:** GitHub Projects (free, integrated with GitHub)

---

### 20. **Notion** (Documentation & Planning)
**What:** All-in-one workspace
**Why:** Better than scattered markdown files
- **Databases** - track features, bugs, ideas
- **Wikis** - team knowledge base
- **Docs** - technical documentation
- **Roadmap** - plan quarters visually
- **API** - automate with integrations

**Best for:** Documentation, planning, knowledge management
**Cost:** Free (personal), $8/user/month (team)
**Website:** https://notion.so

**Alternative:** GitHub Wiki or markdown files in repo (simpler, free)

---

## 🔐 **Tier 6: Security & Secrets**

### 21. **1Password for Developers**
**What:** Password manager with developer features
**Why:** Manage API keys, secrets securely
- **SSH key management** - store and use SSH keys
- **API key storage** - never hardcode secrets
- **CLI integration** - inject secrets into commands
- **Team sharing** - share credentials securely
- **2FA support** - built-in authenticator

**Best for:** Managing secrets, team credential sharing
**Cost:** $3/month (individual), $7/user/month (team)
**Website:** https://1password.com

**Alternative:** **Bitwarden** (free, open source)

---

### 22. **Doppler** (Secrets Management)
**What:** Centralized secrets manager for teams
**Why:** Stop using .env files everywhere
- **Sync secrets** across team automatically
- **Environment branches** - dev, staging, prod
- **CLI integration** - `doppler run npm start`
- **Version history** - rollback secrets
- **Audit logs** - who accessed what

**Best for:** Team collaboration, multiple environments
**Cost:** Free (3 users), $9/user/month
**Website:** https://doppler.com

---

## 🚀 **Tier 7: Deployment & DevOps**

### 23. **Railway** (Alternative to Vercel)
**What:** Deploy anything with zero config
**Why:** When Vercel isn't enough (need databases, cron, etc.)
- **Databases included** - PostgreSQL, Redis, MySQL
- **Cron jobs** - scheduled tasks
- **Background workers** - long-running processes
- **Logs** - tail logs live
- **Metrics** - CPU, memory, network

**Best for:** Full-stack apps, services beyond static sites
**Cost:** Pay as you go ($5/month minimum)
**Website:** https://railway.app

---

### 24. **Vercel CLI** (You already have this!)
**What:** Deploy and manage Vercel from terminal
**Why:** Faster than web dashboard
- `vercel` - deploy preview
- `vercel --prod` - deploy to production
- `vercel logs` - tail production logs
- `vercel env` - manage environment variables

**You already installed this earlier!** Just use it more.

---

## 📦 **Recommended Setup by Priority**

### **Week 1: Essential Foundations**
1. ✅ **Cursor** - Better coding experience ($20/month or free)
2. ✅ **Warp Terminal** - Better terminal (free)
3. ✅ **Raycast/PowerToys** - Productivity boost (free)
4. ✅ **Rectangle** - Window management (free)

**Total cost:** $20/month (or $0 with free tier)

### **Week 2: Development Workflow**
5. **GitHub Copilot** - Code completion ($10/month)
6. **TablePlus** - Database management ($89 one-time)
7. **Bruno** - API testing (free)

**Total additional:** $10/month + $89 one-time

### **Week 3: Quality & Monitoring**
8. **Sentry** - Error tracking (free tier)
9. **Responsively** - Responsive testing (free)

**Total additional:** Free

### **Month 2: Advanced Tools**
10. **Doppler** - Secrets management (free tier)
11. **Linear** - Issue tracking (free solo)
12. **1Password** - Security ($3/month)

**Total additional:** $3/month

---

## 💰 **Budget-Conscious Setup** (Free or One-Time)

**$0/month recurring:**
1. VS Code + Copilot (use free trial)
2. Warp Terminal (free tier)
3. PowerToys/Rectangle (free)
4. DBeaver (free)
5. Bruno (free)
6. Responsively (free)
7. Sentry free tier
8. GitHub Projects (free)

**Total recurring cost:** $0/month
**One-time investment:** $0

---

## 🏆 **Power User Setup** (Max Productivity)

**Monthly subscriptions:**
- Cursor Pro: $20
- GitHub Copilot: $10
- Sizzy: $15
- 1Password: $3
- Linear: $8
- Doppler: $9

**One-time purchases:**
- TablePlus: $89

**Total recurring:** $65/month
**Total one-time:** $89

**ROI:** If it saves 2 hours/month, you break even at $32.50/hour rate

---

## 🎯 **My Recommendations for You**

Based on your workflow (multi-computer, SaaS dev, working with Claude):

### **Must Have (Start This Week):**
1. **Cursor** - Will 2x your implementation speed
2. **Warp Terminal** - Better terminal experience
3. **Raycast or PowerToys** - Daily time savings

### **Should Have (Within Month):**
4. **GitHub Copilot** - Massive boilerplate reduction
5. **TablePlus** - Better database work
6. **Sentry** - Know about prod errors

### **Nice to Have (As Needed):**
7. **Sizzy** - If doing lots of responsive work
8. **Linear** - If solo work gets complex
9. **1Password** - If managing many secrets

---

## 🔄 **How These Complement Claude Code**

**Claude Code is best for:**
- Planning and architecture
- Complex debugging across files
- Learning new concepts
- Analyzing existing code
- Documentation creation

**Other tools excel at:**
- **Cursor:** Quick edits, refactoring
- **Copilot:** Autocomplete as you type
- **Sentry:** Production monitoring
- **TablePlus:** Database queries
- **Warp:** Terminal operations

**Use them together:** Claude Code for strategy, other tools for tactics.

---

## 📊 **Expected Time Savings**

**Conservative estimates:**

| Tool | Time Saved | Monthly Value (@ $50/hr) |
|------|------------|-------------------------|
| Cursor | 5 hrs/month | $250 |
| Copilot | 3 hrs/month | $150 |
| Warp Terminal | 2 hrs/month | $100 |
| Raycast | 2 hrs/month | $100 |
| TablePlus | 2 hrs/month | $100 |
| Sentry | 1 hr/month | $50 |
| **Total** | **15 hrs/month** | **$750** |

**Cost:** ~$65/month + $89 one-time
**ROI:** 11.5x in first month, infinite thereafter

---

## 🚀 **Quick Start Action Plan**

**Today (15 minutes):**
1. Download Cursor or Warp Terminal
2. Try one tool this session

**This Week:**
3. Set up your top 3 tools
4. Configure keyboard shortcuts

**This Month:**
5. Add monitoring (Sentry)
6. Evaluate what's working

---

## 📚 **Learning Resources**

**Cursor:**
- Docs: https://cursor.sh/docs
- YouTube: Search "Cursor IDE tutorial"

**Warp:**
- Docs: https://docs.warp.dev
- Tips: Built-in workflows library

**Raycast:**
- Store: Built-in extension store
- Community: https://raycast.com/community

---

## ❓ **Questions to Help You Choose**

1. **Budget:** What's your monthly tool budget?
2. **Operating System:** macOS or Windows? (Affects choices)
3. **Team size:** Solo or collaborating?
4. **Pain points:** What slows you down most today?
5. **Learning curve:** Prefer simple or powerful?

Answer these and I can give personalized recommendations!

---

**Remember:** Don't install everything at once. Start with 2-3 tools, master them, then add more.

The best tool is the one you actually use. 🎯
