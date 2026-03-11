# Telegram AI Researcher Bot

A 24/7 personal AI research assistant on Telegram. Searches the web, summarizes content, and remembers conversation context. Built entirely on Cloudflare's free tier with zero infrastructure costs.

## Features

- **🤖 AI-Powered**: Uses Google Gemini 1.5 Flash for intelligent responses
- **🌐 Web Search**: Automatically searches DuckDuckGo for current information
- **💾 Conversation Memory**: Stores last 10 messages for context-aware responses
- **⚡ Serverless**: Runs on Cloudflare Workers with automatic scaling
- **🔒 Secure**: Uses Worker Bindings for database access (no exposed API keys)
- **💰 Free**: Runs entirely on free tiers (zero infrastructure costs)

## Architecture

```
Telegram Bot API
    ↓
Cloudflare Worker (Webhook)
    ├── ↔ Cloudflare D1 (Chat History)
    ├── ↔ Google Gemini API (LLM)
    └── ↔ DuckDuckGo Search (Web Results)
```

## Tech Stack

- **Hosting**: Cloudflare Workers
- **Language**: TypeScript
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **LLM**: Google Gemini 1.5 Flash
- **Search**: DuckDuckGo API
- **Messaging**: Telegram Bot API

## Quick Start

### 1. Prerequisites
- Cloudflare account (free)
- Node.js 18+
- Telegram account
- Google account

### 2. Create Telegram Bot
```bash
# Open Telegram, search @BotFather
# Send /newbot and follow prompts
# Copy your bot token
```

### 3. Get Gemini API Key
```bash
# Visit https://ai.google.dev/
# Click "Get API Key"
# Copy your API key
```

### 4. Set Up Database
```bash
npm install -g wrangler
wrangler d1 create openclaw-db
# Copy the database ID
```

### 5. Configure & Deploy
```bash
# Update wrangler.toml with database ID
# Create .env with TELEGRAM_BOT_TOKEN and GEMINI_API_KEY
npm install
wrangler deploy
```

### 6. Set Webhook
```bash
curl -X POST https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "YOUR_WORKER_URL/webhook"}'
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Project Structure

```
telegram-ai-researcher/
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
├── .env.example
├── DEPLOYMENT.md
└── README.md
```

## How It Works

1. **User sends message** → Telegram forwards to Worker webhook
2. **Retrieve context** → Query last 10 messages from D1
3. **Determine search need** → Analyze if current info required
4. **Optional web search** → Fetch top results from DuckDuckGo
5. **Generate response** → Send to Google Gemini with context
6. **Store & respond** → Save to D1 and send back to Telegram

## Database Schema

```sql
CREATE TABLE chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GEMINI_API_KEY=your_google_gemini_api_key
```

## Limitations

- **30-second timeout**: Telegram expects responses within 30 seconds
- **Rate limits**: Gemini free tier ~60 requests/minute
- **Storage**: D1 free tier 5GB (sufficient for millions of messages)
- **Requests**: Workers free tier 100k requests/day
- **Search results**: Limited to 3 results per search

## Monitoring

```bash
# View real-time logs
wrangler tail

# Query chat history
wrangler d1 execute openclaw-db --command "SELECT * FROM chat_history LIMIT 10"
```

## Costs

| Service | Free Tier | Cost |
|---------|-----------|------|
| Cloudflare Workers | 100k requests/day | $0 |
| D1 Database | 5GB storage | $0 |
| Telegram Bot API | Unlimited | $0 |
| Google Gemini | Rate limited | $0 |
| **Total** | | **$0/month** |

## Future Enhancements

- Image recognition capabilities
- Conversation summarization
- Custom knowledge base integration
- Multi-user support with separate contexts
- Usage analytics dashboard
- Scheduled reminders
- Integration with other APIs

## Troubleshooting

**Bot not responding?**
- Check webhook: `curl https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo`
- View logs: `wrangler tail`
- Verify environment variables in Cloudflare dashboard

**Database errors?**
- Check schema: `wrangler d1 execute openclaw-db --command "SELECT * FROM chat_history LIMIT 1"`
- Verify binding in `wrangler.toml`

**Gemini API errors?**
- Verify API key is correct
- Check rate limits (free tier: ~60 req/min)
- Ensure API is enabled in Google Cloud Console

## License

© 2024 Al A. All rights reserved.
