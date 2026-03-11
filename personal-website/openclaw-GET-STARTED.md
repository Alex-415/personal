# 🚀 openClaw experience - Get Running in 10 Minutes

## Step 1: Get Your API Keys (2 minutes)

### Telegram Bot Token
1. Open Telegram
2. Search for `@BotFather`
3. Send `/newbot`
4. Follow prompts
5. Copy your token (looks like: `123456:ABC-DEF1234...`)

### Google Gemini API Key
1. Visit https://ai.google.dev/
2. Click "Get API Key"
3. Create new API key
4. Copy the key

---

## Step 2: Set Up Project (3 minutes)

```bash
# Create and enter directory
mkdir openclaw-experience
cd openclaw-experience

# Copy all files from personal-website directory
# Rename them (remove "telegram-bot-" prefix):
# - telegram-bot-wrangler.toml → wrangler.toml
# - telegram-bot-package.json → package.json
# - telegram-bot-index.ts → src/index.ts
# - telegram-bot-handlers-telegram.ts → src/handlers/telegram.ts
# - telegram-bot-handlers-llm.ts → src/handlers/llm.ts
# - telegram-bot-handlers-search.ts → src/handlers/search.ts
# - telegram-bot-db-queries.ts → src/db/queries.ts
# - telegram-bot-schema.sql → src/db/schema.sql

# Create directories
mkdir -p src/handlers src/db

# Install dependencies
npm install
```

---

## Step 3: Create Environment File (1 minute)

Create `.env.local` in your project root:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
GEMINI_API_KEY=your_gemini_api_key_here
```

Replace with your actual keys from Step 1.

---

## Step 4: Set Up Database (2 minutes)

```bash
# Create local database
wrangler d1 create openclaw-db --local

# Apply schema
wrangler d1 execute openclaw-db --local --file=src/db/schema.sql
```

---

## Step 5: Run It! (2 minutes)

### Terminal 1: Start Development Server
```bash
wrangler dev
```

You should see:
```
⛅ wrangler 3.x.x
▲ [wrangler:dev] Starting local server...
▲ [wrangler:dev] Listening on http://localhost:8787
```

### Terminal 2: Test It
```bash
# Health check
curl http://localhost:8787/

# Should return:
# {"status":"ok","service":"openclaw-experience"}
```

### Terminal 3: Watch Logs
```bash
wrangler tail
```

---

## 🎉 You're Running!

Your local openClaw experience is now running at `http://localhost:8787`

---

## 📝 Send Your First Message

```bash
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "message_id": 1,
      "date": 1234567890,
      "chat": {"id": 123456789, "type": "private"},
      "from": {"id": 123456789, "is_bot": false, "first_name": "Test"},
      "text": "Hello! What can you do?"
    }
  }'
```

Check `wrangler tail` to see the response!

---

## 🔍 Check Your Database

```bash
# View all messages
wrangler d1 execute openclaw-db --local --command "SELECT * FROM chat_history"

# Should show your test message
```

---

## 📚 Next Steps

- **Detailed Setup**: Read `openclaw-LOCAL-SETUP.md`
- **Quick Reference**: Read `openclaw-QUICK-REFERENCE.md`
- **Visual Guide**: Read `openclaw-LOCAL-VISUAL-GUIDE.md`
- **Run Tests**: `bash test-openclaw-local.sh`
- **Customize**: Edit files in `src/` directory
- **Deploy**: `wrangler deploy` when ready

---

## 🐛 Troubleshooting

### Port 8787 in use?
```bash
wrangler dev --port 8788
```

### Module not found?
```bash
npm install
```

### Database error?
```bash
wrangler d1 create openclaw-db --local
wrangler d1 execute openclaw-db --local --file=src/db/schema.sql
```

### API key errors?
- Check `.env.local` has correct keys
- Verify keys are not expired
- Check Google Cloud Console has API enabled

---

## ✅ Checklist

- [ ] API keys obtained
- [ ] Project directory created
- [ ] Files copied and renamed
- [ ] `.env.local` created
- [ ] `npm install` completed
- [ ] Database created
- [ ] `wrangler dev` running
- [ ] Health check passes
- [ ] Test message works
- [ ] Database shows messages

---

## 🎯 You're All Set!

Your local development environment is ready. Start building! 🚀

For more details, see the other documentation files:
- `openclaw-LOCAL-SETUP.md` - Comprehensive guide
- `openclaw-QUICK-REFERENCE.md` - Command reference
- `openclaw-LOCAL-VISUAL-GUIDE.md` - Architecture diagrams
- `openclaw-LOCAL-RESOURCES.md` - Resource index
