import { Hono } from 'hono';

type Env = {
  openclaw_db: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'telegram-ai-researcher' });
});

app.post('/telegram-ai-researcher/webhook', async (c) => {
  try {
    const body = await c.req.json();
    const message = body.message;
    
    if (!message || !message.text) {
      return c.json({ ok: true });
    }

    const chatId = message.chat.id;
    const userId = message.from.id.toString();
    const userText = message.text;
    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    const geminiKey = c.env.GEMINI_API_KEY;
    const db = c.env.openclaw_db;

    if (!botToken || !geminiKey) {
      console.error('Missing credentials');
      return c.json({ ok: false, error: 'Credentials not configured' }, 500);
    }

    // Get conversation history
    const history = await getChatHistory(db, userId, 5);

    // Perform research if needed
    const needsResearch = shouldResearch(userText);
    let researchFindings = '';
    let sources: string[] = [];

    if (needsResearch) {
      const research = await performResearch(userText);
      researchFindings = research.findings;
      sources = research.sources;
    }

    // Generate response with context
    const botResponse = await generateContextualResponse(
      userText,
      history,
      researchFindings,
      sources,
      geminiKey
    );

    // Save to database
    await saveChatMessage(db, userId, userText, botResponse);

    // Send response to Telegram
    await sendTelegramMessage(chatId, botResponse, botToken);

    return c.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ ok: false, error: 'Internal server error' }, 500);
  }
});

async function getChatHistory(db: D1Database, userId: string, limit: number): Promise<Message[]> {
  try {
    const result = await db
      .prepare(
        `SELECT role, content FROM chat_history 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`
      )
      .bind(userId, limit)
      .all();

    return (result.results as any[])
      .reverse()
      .map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: row.content,
      }));
  } catch (error) {
    console.error('Error getting chat history:', error);
    return [];
  }
}

async function saveChatMessage(
  db: D1Database,
  userId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO chat_history (user_id, role, content, created_at) 
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(userId, 'user', userMessage)
      .run();

    await db
      .prepare(
        `INSERT INTO chat_history (user_id, role, content, created_at) 
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(userId, 'assistant', assistantMessage)
      .run();
  } catch (error) {
    console.error('Error saving chat message:', error);
  }
}

function shouldResearch(text: string): boolean {
  const researchKeywords = [
    'latest',
    'current',
    'today',
    'news',
    'recent',
    'research',
    'find',
    'search',
    'what is',
    'who is',
    'when',
    'where',
    'how',
    'price',
    'weather',
    'stock',
    'crypto',
    'trending',
  ];
  return researchKeywords.some((keyword) => text.toLowerCase().includes(keyword));
}

async function performResearch(query: string): Promise<{ findings: string; sources: string[] }> {
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
    const data = await response.json() as any;

    const sources: string[] = [];
    const findings: string[] = [];

    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      data.RelatedTopics.slice(0, 5).forEach((item: any) => {
        if (item.Text) {
          findings.push(item.Text);
          if (item.FirstURL) {
            sources.push(item.FirstURL);
          }
        }
      });
    }

    return {
      findings: findings.join('\n'),
      sources: sources,
    };
  } catch (error) {
    console.error('Research error:', error);
    return { findings: '', sources: [] };
  }
}

async function getAvailableModel(geminiKey: string): Promise<string> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${geminiKey}`
    );
    const data = await response.json() as any;

    if (data.models && data.models.length > 0) {
      const model = data.models.find((m: any) =>
        m.supportedGenerationMethods?.includes('generateContent')
      );
      if (model) {
        return model.name.split('/').pop() || 'gemini-pro';
      }
    }
    return 'gemini-pro';
  } catch (error) {
    console.error('Error getting models:', error);
    return 'gemini-pro';
  }
}

async function generateContextualResponse(
  userQuery: string,
  history: Message[],
  researchFindings: string,
  sources: string[],
  geminiKey: string
): Promise<string> {
  try {
    const model = await getAvailableModel(geminiKey);

    // Build context from history
    const historyContext = history
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    // Build research context
    const researchContext = researchFindings
      ? `\n\nRecent Research Findings:\n${researchFindings}`
      : '';

    const systemPrompt = `You are OpenClaw, an AI research assistant. Your role is to:
1. Provide well-researched, accurate answers
2. Cite sources when providing information
3. Maintain conversation context and remember previous discussions
4. Synthesize information from multiple sources
5. Be concise but thorough

${researchContext}`;

    const messages = [
      ...history,
      { role: 'user' as const, content: userQuery },
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          contents: messages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
          })),
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7,
          },
        }),
      }
    );

    const data = await response.json() as any;

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      let responseText = data.candidates[0].content.parts[0].text;

      // Add sources if available
      if (sources.length > 0) {
        responseText += '\n\n📚 Sources:\n';
        sources.slice(0, 3).forEach((source, i) => {
          responseText += `${i + 1}. ${source}\n`;
        });
      }

      return responseText;
    }

    if (data.error) {
      return `Error: ${data.error.message}`;
    }

    return 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('Response generation error:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
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

app.all('*', (c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;
