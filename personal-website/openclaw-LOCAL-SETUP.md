# openClaw experience - Local Development Setup

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Telegram account
- Google account (for Gemini API)
- Cloudflare account (free)

## Step 1: Get Your API Keys

### Telegram Bot Token
1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow prompts to create a bot
4. Copy the bot token (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### Google Gemini API Key
1. Visit https://ai.google.dev/
2. Click "Get API Key"
3. Create a new API key
4. Copy the key

## Step 2: Set Up Local Project

```bash
# Create project directory
mkdir openclaw-experience
cd openclaw-experience

# Copy all the telegram-bot-* files here
# Rename files (remove telegram-bot- prefix):
# - telegram-bot-wrangler.toml → wrangler.toml
# - telegram-bot-package.json → package.json
# - telegram-bot-index.ts → src/index.ts
# - telegram-bot-handlers-telegram.ts → src/handlers/telegram.ts
# - telegram-bot-handlers-llm.ts → src/handlers/llm.ts
# - telegram-bot-handlers-search.ts → src/handlers/search.ts
# - telegram-bot-db-queries.ts → src/db/queries.ts
# - telegram-bot-schema.sql → src/db/schema.sql
# - telegram-bot-env-example → .env.local

# Install dependencies
npm install
```

## Step 3: Create Local Environment File

Create `.env.local`:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
GEMINI_API_KEY=your_gemini_api_key_here
```

## Step 4: Set Up Local D1 Database

```bash
# Install Wrangler globally
npm install -g wrangler

# Create local D1 database
wrangler d1 create openclaw-db --local

# Apply schema
wrangler d1 execute openclaw-db --local --file=src/db/schema.sql
```

## Step 5: Run Locally

### Option A: Using Wrangler Dev (Recommended)

```bash
# Start local development server
wrangler dev

# Output will show:
# ⛅ wrangler 3.x.x
# ▲ [wrangler:dev] Starting local server...
# ▲ [wrangler:dev] Listening on http://localhost:8787
```

The Worker will be available at `http://localhost:8787`

### Option B: Using Node.js Directly

```bash
# Install tsx for TypeScript execution
npm install -D tsx

# Run the server
npx tsx src/index.ts
```

## Step 6: Test Locally

### Health Check
```bash
curl http://localhost:8787/
# Response: {"status":"ok","service":"openclaw-experience"}
```

### Test Webhook (Simulate Telegram Message)

```bash
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "message_id": 1,
      "date": 1234567890,
      "chat": {
        "id": 123456789,
        "type": "private"
      },
      "from": {
        "id": 123456789,
        "is_bot": false,
        "first_name": "Test"
      },
      "text": "What is the weather today?"
    }
  }'
```

## Step 7: View Logs

```bash
# In another terminal, watch logs
wrangler tail
```

## Step 8: Query Local Database

```bash
# View chat history
wrangler d1 execute openclaw-db --local --command "SELECT * FROM chat_history"

# Insert test data
wrangler d1 execute openclaw-db --local --command "INSERT INTO chat_history (user_id, user_message, bot_response) VALUES ('123', 'test', 'response')"
```

## Project Structure

```
openclaw-experience/
├── src/
│   ├── index.ts                 # Main Worker entry point
│   ├── handlers/
│   │   ├── telegram.ts          # Telegram webhook handler
│   │   ├── llm.ts               # Gemini API integration
│   │   └── search.ts            # DuckDuckGo search
│   └── db/
│       ├── schema.sql           # D1 database schema
│       └── queries.ts           # SQL query helpers
├── wrangler.toml                # Cloudflare config
├── package.json
├── tsconfig.json
├── .env.local                   # Local environment variables
└── README.md
```

## Common Issues & Solutions

### Issue: "Cannot find module 'hono'"
```bash
npm install
```

### Issue: "D1 database not found"
```bash
# Recreate local database
wrangler d1 create openclaw-db --local
wrangler d1 execute openclaw-db --local --file=src/db/schema.sql
```

### Issue: "Gemini API errors"
- Verify API key is correct in `.env.local`
- Check rate limits (free tier: ~60 requests/minute)
- Ensure API is enabled in Google Cloud Console

### Issue: "Port 8787 already in use"
```bash
# Use different port
wrangler dev --port 8788
```

### Issue: "TypeScript compilation errors"
```bash
# Install TypeScript types
npm install -D @cloudflare/workers-types
```

## Development Workflow

1. **Make code changes** in `src/` directory
2. **Wrangler dev automatically reloads** on file changes
3. **Test with curl** or Postman
4. **Check logs** with `wrangler tail`
5. **Query database** with `wrangler d1 execute`

## Testing the Full Flow

```bash
# Terminal 1: Start dev server
wrangler dev

# Terminal 2: Watch logs
wrangler tail

# Terminal 3: Send test message
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "message_id": 1,
      "date": 1234567890,
      "chat": {"id": 123456789, "type": "private"},
      "from": {"id": 123456789, "is_bot": false, "first_name": "Test"},
      "text": "Hello, what can you do?"
    }
  }'

# Terminal 4: Check database
wrangler d1 execute openclaw-db --local --command "SELECT * FROM chat_history ORDER BY created_at DESC LIMIT 5"
```

## Next Steps

1. ✅ Set up local environment
2. ✅ Run `wrangler dev`
3. ✅ Test with curl requests
4. ✅ Verify database operations
5. ✅ Check logs for errors
6. ✅ Deploy to Cloudflare when ready

## Deployment to Cloudflare

When ready to deploy:

```bash
# Create production D1 database
wrangler d1 create openclaw-db

# Update wrangler.toml with production database ID

# Deploy
wrangler deploy
```

## Useful Commands

```bash
# Start dev server
wrangler dev

# Watch logs
wrangler tail

# Query database
wrangler d1 execute openclaw-db --local --command "SELECT * FROM chat_history"

# Deploy to production
wrangler deploy

# Check deployment status
wrangler deployments list
```

## Debugging Tips

1. **Enable verbose logging**: `wrangler dev --debug`
2. **Check environment variables**: `wrangler env list`
3. **Inspect requests**: Use browser DevTools or Postman
4. **Test Gemini API separately**: Use curl to test API directly
5. **Verify database schema**: `wrangler d1 execute openclaw-db --local --command ".schema"`

## Support

- Cloudflare Docs: https://developers.cloudflare.com/workers/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- Telegram Bot API: https://core.telegram.org/bots/api
- Google Gemini: https://ai.google.dev/
