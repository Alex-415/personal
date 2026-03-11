# openClaw experience - Local Development Resources

## 📚 Documentation Files Created

### 1. **openclaw-LOCAL-SETUP.md** (Comprehensive Guide)
Complete step-by-step guide for setting up and running locally.

**Covers:**
- Prerequisites and API key setup
- Project structure and file organization
- Local database creation
- Running with Wrangler dev
- Testing with curl
- Troubleshooting common issues
- Development workflow

**Use this when:** You need detailed instructions for initial setup

---

### 2. **openclaw-QUICK-REFERENCE.md** (Cheat Sheet)
Quick reference card with all commands and common tasks.

**Covers:**
- 5-minute quick start
- Terminal commands (dev, database, monitoring, deployment)
- Testing with curl examples
- File structure
- Environment variables
- Troubleshooting table
- Development tips

**Use this when:** You need to quickly look up a command

---

### 3. **openclaw-LOCAL-VISUAL-GUIDE.md** (Architecture Diagrams)
Visual diagrams showing local architecture and workflows.

**Covers:**
- Local architecture diagram
- Request flow visualization
- Multi-terminal setup layout
- File editing workflow
- Database structure
- Step-by-step setup diagram
- Verification checklist
- Common workflows

**Use this when:** You want to understand the architecture visually

---

### 4. **test-openclaw-local.sh** (Test Script)
Bash script to automatically test the local setup.

**Tests:**
- Health check endpoint
- Simple message webhook
- Search query webhook
- Follow-up message webhook

**Use this when:** You want to run automated tests

---

## 🚀 Getting Started (Choose Your Path)

### Path 1: I'm in a hurry (5 minutes)
1. Read: **openclaw-QUICK-REFERENCE.md** (Quick Start section)
2. Run: `wrangler dev`
3. Test: `curl http://localhost:8787/`

### Path 2: I want detailed instructions (15 minutes)
1. Read: **openclaw-LOCAL-SETUP.md** (Step 1-8)
2. Follow each step carefully
3. Test with curl examples

### Path 3: I want to understand the architecture (20 minutes)
1. Read: **openclaw-LOCAL-VISUAL-GUIDE.md** (Architecture section)
2. Read: **openclaw-LOCAL-SETUP.md** (How It Works section)
3. Set up following the diagrams

### Path 4: I want to run automated tests (10 minutes)
1. Set up local environment
2. Run: `bash test-openclaw-local.sh`
3. Check results in `wrangler tail`

---

## 📋 Quick Setup Checklist

```bash
# 1. Prerequisites
node --version          # Should be 18+
npm --version          # Should be 8+

# 2. Get API Keys
# - Telegram: @BotFather on Telegram
# - Gemini: https://ai.google.dev/

# 3. Create project
mkdir openclaw-experience
cd openclaw-experience

# 4. Copy files and rename
# (See openclaw-LOCAL-SETUP.md Step 2)

# 5. Install dependencies
npm install

# 6. Create .env.local
echo "TELEGRAM_BOT_TOKEN=your_token" > .env.local
echo "GEMINI_API_KEY=your_key" >> .env.local

# 7. Set up database
wrangler d1 create openclaw-db --local
wrangler d1 execute openclaw-db --local --file=src/db/schema.sql

# 8. Start development
wrangler dev

# 9. In another terminal, test
curl http://localhost:8787/

# 10. Monitor logs
wrangler tail
```

---

## 🎯 Common Tasks

### Task: Start Development
```bash
wrangler dev
# Server runs on http://localhost:8787
```

### Task: View Logs
```bash
wrangler tail
# Shows real-time logs from your Worker
```

### Task: Test Endpoint
```bash
curl http://localhost:8787/
# Should return: {"status":"ok","service":"openclaw-experience"}
```

### Task: Send Test Message
```bash
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "message_id": 1,
      "date": 1234567890,
      "chat": {"id": 123456789, "type": "private"},
      "from": {"id": 123456789, "is_bot": false, "first_name": "Test"},
      "text": "Hello!"
    }
  }'
```

### Task: View Database
```bash
wrangler d1 execute openclaw-db --local --command "SELECT * FROM chat_history"
```

### Task: Clear Database
```bash
wrangler d1 execute openclaw-db --local --command "DELETE FROM chat_history"
```

### Task: Run Tests
```bash
bash test-openclaw-local.sh
```

---

## 🔧 Terminal Setup

### Recommended: 4 Terminal Windows

**Terminal 1: Development Server**
```bash
wrangler dev
# Keep this running
```

**Terminal 2: Log Monitoring**
```bash
wrangler tail
# Watch logs in real-time
```

**Terminal 3: Testing**
```bash
# Run curl commands here
curl http://localhost:8787/webhook ...
```

**Terminal 4: Database Queries**
```bash
# Query database here
wrangler d1 execute openclaw-db --local --command "SELECT * FROM chat_history"
```

---

## 📊 File Organization

```
openclaw-experience/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── handlers/
│   │   ├── telegram.ts          # Telegram webhook
│   │   ├── llm.ts               # Gemini integration
│   │   └── search.ts            # Web search
│   └── db/
│       ├── schema.sql           # Database schema
│       └── queries.ts           # DB helpers
├── wrangler.toml                # Cloudflare config
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
├── .env.local                   # Your API keys (don't commit!)
└── .gitignore                   # Git ignore rules
```

---

## 🐛 Troubleshooting

### Problem: "Cannot find module 'hono'"
**Solution:**
```bash
npm install
```

### Problem: "Port 8787 already in use"
**Solution:**
```bash
wrangler dev --port 8788
```

### Problem: "D1 database not found"
**Solution:**
```bash
wrangler d1 create openclaw-db --local
wrangler d1 execute openclaw-db --local --file=src/db/schema.sql
```

### Problem: "Gemini API errors"
**Solution:**
- Check `.env.local` has correct API key
- Verify API is enabled in Google Cloud Console
- Check rate limits (free tier: ~60 requests/minute)

### Problem: "No response from webhook"
**Solution:**
```bash
# Check logs
wrangler tail

# Test health endpoint
curl http://localhost:8787/

# Verify environment variables
cat .env.local
```

---

## 📚 Documentation Map

```
openclaw-LOCAL-SETUP.md
├── Prerequisites
├── Step 1-8: Setup Instructions
├── Project Structure
├── How It Works
├── Testing
├── Troubleshooting
└── Debugging Tips

openclaw-QUICK-REFERENCE.md
├── Quick Start (5 min)
├── Terminal Commands
├── Testing with curl
├── File Structure
├── Environment Variables
├── Troubleshooting Table
└── Checklist

openclaw-LOCAL-VISUAL-GUIDE.md
├── Local Architecture
├── Request Flow
├── Multi-Terminal Setup
├── File Editing Workflow
├── Database Structure
├── Step-by-Step Setup
├── Verification Checklist
└── Common Workflows

test-openclaw-local.sh
├── Health Check Test
├── Simple Message Test
├── Search Query Test
└── Follow-up Message Test
```

---

## 🎓 Learning Path

### Beginner (New to Cloudflare Workers)
1. Read: **openclaw-LOCAL-VISUAL-GUIDE.md** (Architecture section)
2. Read: **openclaw-LOCAL-SETUP.md** (Steps 1-5)
3. Run: `wrangler dev`
4. Test: `curl http://localhost:8787/`

### Intermediate (Familiar with Node.js)
1. Read: **openclaw-QUICK-REFERENCE.md**
2. Follow: **openclaw-LOCAL-SETUP.md** (Steps 1-8)
3. Run: `bash test-openclaw-local.sh`
4. Explore: Database queries

### Advanced (Want to customize)
1. Read: All documentation
2. Modify: `src/handlers/llm.ts` (change Gemini prompt)
3. Modify: `src/handlers/search.ts` (change search logic)
4. Test: `wrangler dev` with your changes
5. Deploy: `wrangler deploy`

---

## ✅ Success Criteria

You'll know it's working when:

- [ ] `wrangler dev` starts without errors
- [ ] `curl http://localhost:8787/` returns `{"status":"ok",...}`
- [ ] `wrangler tail` shows incoming requests
- [ ] Test message webhook returns `{"ok":true}`
- [ ] Database stores messages: `SELECT COUNT(*) FROM chat_history` > 0
- [ ] No errors in `wrangler tail` logs

---

## 🚀 Next Steps

1. **Set up locally** using **openclaw-LOCAL-SETUP.md**
2. **Test thoroughly** using **test-openclaw-local.sh**
3. **Understand architecture** using **openclaw-LOCAL-VISUAL-GUIDE.md**
4. **Customize code** in `src/` directory
5. **Deploy to production** when ready

---

## 📞 Support Resources

- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/
- **D1 Database**: https://developers.cloudflare.com/d1/
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **Google Gemini**: https://ai.google.dev/

---

## 💡 Pro Tips

1. **Use multiple terminals** - One for dev, one for logs, one for testing
2. **Check logs first** - Always run `wrangler tail` when debugging
3. **Test incrementally** - Test each component separately
4. **Keep .env.local safe** - Never commit API keys to git
5. **Use curl for testing** - Easier than setting up Telegram webhook locally
6. **Database persists** - Local database survives `wrangler dev` restarts
7. **Auto-reload works** - Changes to `src/` reload automatically

---

## 🎯 Quick Links

- **Setup Guide**: openclaw-LOCAL-SETUP.md
- **Quick Reference**: openclaw-QUICK-REFERENCE.md
- **Visual Guide**: openclaw-LOCAL-VISUAL-GUIDE.md
- **Test Script**: test-openclaw-local.sh
- **Project Page**: telegram-ai-researcher.html
- **Deployment Guide**: telegram-bot-DEPLOYMENT.md
