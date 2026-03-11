# Telegram AI Researcher Bot - Deployment Guide

## Prerequisites

- Cloudflare account (free tier works)
- Node.js 18+ installed
- Telegram account
- Google account (for Gemini API)

## Step 1: Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow prompts to create a new bot
4. Copy the bot token (you'll need this later)

## Step 2: Get Google Gemini API Key

1. Go to https://ai.google.dev/
2. Click "Get API Key"
3. Create a new API key in Google Cloud Console
4. Copy the API key

## Step 3: Set Up Cloudflare D1 Database

```bash
# Install Wrangler CLI
npm install -g wrangler

# Create D1 database
wrangler d1 create openclaw-db

# Copy the database ID from the output
```

## Step 4: Configure Project

1. Update `wrangler.toml` with your database ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "openclaw-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

2. Create `.env` file with your credentials:
```
TELEGRAM_BOT_TOKEN=your_bot_token
GEMINI_API_KEY=your_api_key
```

## Step 5: Initialize Database

```bash
# Apply schema to create tables
wrangler d1 execute openclaw-db --file=src/db/schema.sql
```

## Step 6: Deploy Worker

```bash
# Install dependencies
npm install

# Deploy to Cloudflare
wrangler deploy
```

The output will show your Worker URL (e.g., `https://openclaw-experience.your-account.workers.dev`)

## Step 7: Set Telegram Webhook

Replace `YOUR_WORKER_URL` and `YOUR_BOT_TOKEN`:

```bash
curl -X POST https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "YOUR_WORKER_URL/webhook"}'
```

Or use this Python script:

```python
import requests

bot_token = "YOUR_BOT_TOKEN"
worker_url = "YOUR_WORKER_URL"

url = f"https://api.telegram.org/bot{bot_token}/setWebhook"
data = {"url": f"{worker_url}/webhook"}

response = requests.post(url, json=data)
print(response.json())
```

## Step 8: Test the Bot

1. Open Telegram and find your bot
2. Send a message like "What is the weather today?"
3. The bot should respond with information

## Troubleshooting

### Bot not responding
- Check webhook is set correctly: `curl https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo`
- Check Worker logs: `wrangler tail`
- Verify environment variables are set in Cloudflare dashboard

### Database errors
- Check schema was applied: `wrangler d1 execute openclaw-db --command "SELECT * FROM chat_history LIMIT 1"`
- Verify database binding in `wrangler.toml`

### Gemini API errors
- Verify API key is correct
- Check rate limits (free tier: ~60 requests/minute)
- Ensure API is enabled in Google Cloud Console

## Monitoring

View real-time logs:
```bash
wrangler tail
```

Query chat history:
```bash
wrangler d1 execute openclaw-db --command "SELECT * FROM chat_history ORDER BY created_at DESC LIMIT 10"
```

## Costs

- **Cloudflare Workers**: Free tier includes 100k requests/day
- **D1 Database**: Free tier includes 5GB storage
- **Telegram Bot API**: Completely free
- **Google Gemini**: Free tier available (rate limited)

**Total cost: $0/month** (for personal use)

## Advanced Configuration

### Rate Limiting
Modify `shouldSearch()` in `handlers/telegram.ts` to control when web searches are triggered.

### Response Length
Adjust `maxOutputTokens` in `handlers/llm.ts` to control response length.

### Conversation History
Change the `limit` parameter in `getChatHistory()` to store more/fewer messages.

### Auto-cleanup
Add a scheduled cron trigger to clear old messages:

```toml
[triggers]
crons = ["0 0 * * *"]  # Daily at midnight UTC
```

Then call `clearOldMessages()` in a cron handler.
