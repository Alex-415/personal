import { Hono } from 'hono';

type Env = {
  openclaw_db: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'telegram-ai-researcher' });
});

app.post('/webhook', async (c) => {
  try {
    const body = await c.req.json();
    const message = body.message;
    
    if (!message || !message.text) {
      return c.json({ ok: true });
    }

    const chatId = message.chat.id;
    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    
    // Send simple response
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'Bot is working!',
      }),
    });

    return c.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ ok: false, error: 'Internal server error' }, 500);
  }
});

export default app;
