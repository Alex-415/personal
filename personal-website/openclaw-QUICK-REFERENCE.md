# openClaw experience - Quick Reference

## 🚀 Quick Start (5 minutes)

```bash
# 1. Navigate to project
cd openclaw-experience

# 2. Install dependencies
npm install

# 3. Create .env.local with your keys
echo "TELEGRAM_BOT_TOKEN=your_token" > .env.local
echo "GEMINI_API_KEY=your_key" >> .env.local

# 4. Set up local database
wrangler d1 create openclaw-db --local
wrangler d1 execute openclaw-db --local --file=src/db/schema.sql

# 5. Start dev server
wrangler dev

# 6. In another terminal, test it
curl http://localhost:8787/
```

## 📋 Terminal Commands

### Start Development
```bash
wrangler dev                    # Start local server (port 8787)
wrangler dev --port 8788       # Use different port
wrangler dev --debug           # Enable debug logging
```

### Database Operations
```bash
# View all messages
wrangler d1 execute openclaw-db --local --command "SELECT * FROM chat_history"

# View last 5 messages
wrangler d1 execute openclaw-db --local --command "SELECT * FROM chat_history ORDER BY created_at DESC LIMIT 5"

# View messages from specific user
wrangler d1 execute openclaw-db --local --command "SELECT * FROM chat_history WHERE user_id = '123456789'"

# Delete all messages
wrangler d1 execute openclaw-db --local --command "DELETE FROM chat_history"

# Check database schema
wrangler d1 execute openclaw-db --local --command ".schema"
```

### Monitoring
```bash
wrangler tail                   # Watch logs in real-time
wrangler tail --format pretty   # Pretty formatted logs
```

### Deployment
```bash
wrangler deploy                 # Deploy to production
wrangler deployments list       # View deployment history
```

## 🧪 Testing with curl

### Health Check
```bash
curl http://localhost:8787/
```

### Send Test Message
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

### Send Search Query
```bash
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "message_id": 1,
      "date": 1234567890,
      "chat": {"id": 123456789, "type": "private"},
      "from": {"id": 123456789, "is_bot": false, "first_name": "Test"},
      "text": "What is the weather today?"
    }
  }'
```

## 📁 File Structure

```
openclaw-experience/
├── src/
│   ├── index.ts                 # Entry point
│   ├── handlers/
│   │   ├── telegram.ts          # Telegram logic
│   │   ├── llm.ts               # Gemini integration
│   │   └── search.ts            # Web search
│   └── db/
│       ├── schema.sql           # Database schema
│       └── queries.ts           # DB helpers
├── wrangler.toml                # Config
├── package.json
├── .env.local                   # Your API keys
└── tsconfig.json
```

## 🔑 Environment Variables

Create `.env.local`:
```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
GEMINI_API_KEY=AIzaSyD...
```

Get them from:
- **Telegram**: @BotFather on Telegram
- **Gemini**: https://ai.google.dev/

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 8787 in use | `wrangler dev --port 8788` |
| Module not found | `npm install` |
| DB not found | `wrangler d1 create openclaw-db --local` |
| API key errors | Check `.env.local` has correct keys |
| No response | Check `wrangler tail` for errors |

## 📊 Workflow

```
Terminal 1: wrangler dev
    ↓
Terminal 2: wrangler tail (watch logs)
    ↓
Terminal 3: curl http://localhost:8787/webhook (send test)
    ↓
Terminal 4: wrangler d1 execute ... (check database)
```

## 🎯 Development Tips

1. **Auto-reload**: Wrangler automatically reloads on file changes
2. **Hot reload**: Changes to `src/` files reload instantly
3. **Database**: Use `--local` flag for local testing
4. **Logs**: Always check `wrangler tail` for errors
5. **Testing**: Use curl or Postman to test endpoints

## 📝 Common Tasks

### Add Logging
```typescript
console.log('Debug message:', variable);
// View in: wrangler tail
```

### Test Gemini API
```bash
curl -X POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: YOUR_KEY" \
  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'
```

### Test DuckDuckGo Search
```bash
curl "https://api.duckduckgo.com/?q=weather&format=json"
```

## 🚀 Deploy to Production

```bash
# 1. Create production database
wrangler d1 create openclaw-db

# 2. Update wrangler.toml with production database ID

# 3. Deploy
wrangler deploy

# 4. Set Telegram webhook
curl -X POST https://api.telegram.org/botYOUR_TOKEN/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "YOUR_WORKER_URL/webhook"}'
```

## 📚 Resources

- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- Telegram Bot API: https://core.telegram.org/bots/api
- Google Gemini: https://ai.google.dev/
- D1 Database: https://developers.cloudflare.com/d1/

## ✅ Checklist

- [ ] Node.js 18+ installed
- [ ] API keys obtained (Telegram, Gemini)
- [ ] `.env.local` created with keys
- [ ] `npm install` completed
- [ ] Local database created
- [ ] `wrangler dev` running
- [ ] Health check passes
- [ ] Test message works
- [ ] Database stores messages
- [ ] Logs show no errors
