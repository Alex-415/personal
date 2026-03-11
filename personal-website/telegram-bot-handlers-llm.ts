type ChatMessage = {
  user_message: string;
  bot_response: string;
  created_at: string;
};

async function callGemini(
  userPrompt: string,
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: userPrompt,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json() as any;
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('No content in Gemini response');
  }

  return content;
}

async function callGroq(
  userPrompt: string,
  systemPrompt: string,
  groqApiKey: string
): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'mixtral-8x7b-32768',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in Groq response');
  }

  return content;
}

export async function generateResponse(
  userMessage: string,
  history: ChatMessage[],
  searchResults: string,
  apiKey: string,
  groqApiKey?: string
): Promise<string> {
  // Build context from history
  let contextText = '';
  if (history.length > 0) {
    contextText = 'Previous conversation:\n';
    history.forEach((msg) => {
      contextText += `User: ${msg.user_message}\nAssistant: ${msg.bot_response}\n`;
    });
  }

  // Build search context
  let searchContext = '';
  if (searchResults) {
    searchContext = `\n\nRecent web search results:\n${searchResults}`;
  }

  const systemPrompt = `You are a helpful AI research assistant. You provide accurate, concise, and well-researched responses. 
When you have access to web search results, use them to provide current information. 
Keep responses clear and under 4096 characters for Telegram compatibility.`;

  const userPrompt = `${contextText}${searchContext}\n\nCurrent question: ${userMessage}`;

  try {
    // Try Gemini first
    console.log('Attempting Gemini API...');
    return await callGemini(userPrompt, systemPrompt, apiKey);
  } catch (geminiError) {
    console.error('Gemini API failed:', geminiError);
    if (!groqApiKey) {
      console.error('Groq API key not configured');
      return 'I apologize, but I\'m currently unable to process your request. Both AI services are temporarily unavailable. Please try again in a moment.';
    }
    try {
      // Fallback to Groq
      console.log('Falling back to Groq API...');
      return await callGroq(userPrompt, systemPrompt, groqApiKey);
    } catch (groqError) {
      console.error('Groq API also failed:', groqError);
      return 'I apologize, but I\'m currently unable to process your request. Both AI services are temporarily unavailable. Please try again in a moment.';
    }
  }
}
