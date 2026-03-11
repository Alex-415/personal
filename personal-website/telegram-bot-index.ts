import { Hono } from 'hono';
import { handleTelegramWebhook } from './handlers/telegram';

type Env = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

// Health check endpoint
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'telegram-ai-researcher' });
});

// Telegram webhook endpoint
app.post('/webhook', async (c) => {
  try {
    const body = await c.req.json();
    const response = await handleTelegramWebhook(body, c.env);
    return c.json(response);
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ ok: false, error: 'Internal server error' }, 500);
  }
});

export default app;
