import { Hono } from 'hono';

type Env = {
  openclaw_db: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
  GROQ_API_KEY?: string;
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

    // Get conversation history (last 100 messages)
    const history = await getChatHistory(db, userId, 100);

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
      geminiKey,
      c.env.GROQ_API_KEY
    );

    console.log('Generated response:', botResponse.substring(0, 100));

    // Save to database
    await saveChatMessage(db, userId, userText, botResponse);

    // Send response to Telegram
    console.log('Sending to Telegram, chatId:', chatId);
    const sendResult = await sendTelegramMessage(chatId, botResponse, botToken);
    console.log('Telegram send result:', sendResult);

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

    if (!result.results) {
      return [];
    }

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
    // Save user message
    await db
      .prepare(
        `INSERT INTO chat_history (user_id, role, content, created_at) 
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(userId, 'user', userMessage)
      .run();

    // Save assistant message
    await db
      .prepare(
        `INSERT INTO chat_history (user_id, role, content, created_at) 
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(userId, 'assistant', assistantMessage)
      .run();

    // Keep only last 100 messages per user (cleanup old messages)
    await db
      .prepare(
        `DELETE FROM chat_history 
         WHERE user_id = ? 
         AND id NOT IN (
           SELECT id FROM chat_history 
           WHERE user_id = ? 
           ORDER BY created_at DESC 
           LIMIT 100
         )`
      )
      .bind(userId, userId)
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
  geminiKey: string,
  groqKey?: string
): Promise<string> {
  try {
    // Try Gemini first
    const model = await getAvailableModel(geminiKey);

    const researchContext = researchFindings
      ? `\n\nRecent Research Findings:\n${researchFindings}`
      : '';

    const systemPrompt = `You are OpenClaw, an AI research assistant. Your role is to:
1. Provide well-researched, accurate answers
2. Cite sources when providing information
3. Maintain conversation context and remember previous discussions
4. Synthesize information from multiple sources
5. Be concise but thorough${researchContext}`;

    // Limit history to last 20 messages for API (to avoid token limits)
    const recentHistory = history.slice(-20);
    
    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n' + userQuery }],
      },
      ...recentHistory.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
    ];

    try {
      console.log('Attempting Gemini API...');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: contents,
            generationConfig: {
              maxOutputTokens: 1000,
              temperature: 0.7,
            },
          }),
        }
      );

      const data = await response.json() as any;
      console.log('Gemini response status:', response.status, 'data:', JSON.stringify(data).substring(0, 200));

      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        let responseText = data.candidates[0].content.parts[0].text;

        if (sources.length > 0) {
          responseText += '\n\n📚 Sources:\n';
          sources.slice(0, 3).forEach((source, i) => {
            responseText += `${i + 1}. ${source}\n`;
          });
        }

        return responseText;
      }

      if (data.error) {
        throw new Error(`Gemini error: ${data.error.message}`);
      }
      throw new Error('No content in Gemini response');
    } catch (geminiError) {
      console.error('Gemini failed:', geminiError);
      if (!groqKey) {
        console.error('Groq key not configured');
        return 'Sorry, I could not generate a response.';
      }

      // Fallback to Groq
      try {
        console.log('Attempting Groq API...');
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: userQuery,
              },
            ],
            temperature: 0.7,
            max_tokens: 1024,
          }),
        });

        const groqData = await groqResponse.json() as any;
        console.log('Groq response status:', groqResponse.status);
        console.log('Groq response data:', JSON.stringify(groqData));
        const groqContent = groqData.choices?.[0]?.message?.content;

        if (groqContent) {
          let responseText = groqContent;
          if (sources.length > 0) {
            responseText += '\n\n📚 Sources:\n';
            sources.slice(0, 3).forEach((source, i) => {
              responseText += `${i + 1}. ${source}\n`;
            });
          }
          return responseText;
        }

        throw new Error('No content in Groq response');
      } catch (groqError) {
        console.error('Groq also failed:', groqError);
        return 'Sorry, both AI services are temporarily unavailable. Please try again later.';
      }
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
): Promise<string> {
  const maxLength = 4096;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  if (text.length <= maxLength) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });
    const data = await response.json() as any;
    console.log('Telegram response:', data);
    return data.ok ? 'sent' : `error: ${data.description}`;
  } else {
    // Split long messages
    const messages = [];
    let currentMessage = '';

    const paragraphs = text.split('\n\n');
    for (const paragraph of paragraphs) {
      if ((currentMessage + paragraph).length > maxLength) {
        if (currentMessage) messages.push(currentMessage);
        currentMessage = paragraph;
      } else {
        currentMessage += (currentMessage ? '\n\n' : '') + paragraph;
      }
    }
    if (currentMessage) messages.push(currentMessage);

    // Send each message with delay
    for (const msg of messages) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg,
        }),
      });
      const data = await response.json() as any;
      console.log('Telegram response:', data);
      if (!data.ok) {
        return `error: ${data.description}`;
      }
      // Small delay between messages
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return 'sent';
  }
}

app.all('*', (c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;
