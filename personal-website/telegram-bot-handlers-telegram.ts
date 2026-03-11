import { getChatHistory, saveChatMessage } from '../db/queries';
import { generateResponse } from './llm';
import { searchWeb } from './search';

type Env = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
};

export async function handleTelegramWebhook(body: any, env: Env) {
  const message = body.message;
  if (!message || !message.text) {
    return { ok: true };
  }

  const userId = message.from.id.toString();
  const userText = message.text;
  const chatId = message.chat.id;

  try {
    // Get conversation history
    const history = await getChatHistory(env.DB, userId, 10);

    // Determine if web search is needed
    const needsSearch = shouldSearch(userText);
    let searchResults = '';

    if (needsSearch) {
      searchResults = await searchWeb(userText);
    }

    // Generate response using Gemini
    const botResponse = await generateResponse(
      userText,
      history,
      searchResults,
      env.GEMINI_API_KEY
    );

    // Save to database
    await saveChatMessage(env.DB, userId, userText, botResponse);

    // Send response to Telegram
    await sendTelegramMessage(chatId, botResponse, env.TELEGRAM_BOT_TOKEN);

    return { ok: true };
  } catch (error) {
    console.error('Error processing message:', error);
    await sendTelegramMessage(
      chatId,
      'Sorry, I encountered an error processing your request.',
      env.TELEGRAM_BOT_TOKEN
    );
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function shouldSearch(text: string): boolean {
  const searchKeywords = [
    'latest',
    'current',
    'today',
    'news',
    'recent',
    'what is',
    'who is',
    'when',
    'where',
    'how much',
    'price',
    'weather',
    'stock',
  ];
  return searchKeywords.some((keyword) => text.toLowerCase().includes(keyword));
}

async function sendTelegramMessage(
  chatId: number,
  text: string,
  botToken: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    }),
  });
}
