export type ChatMessage = {
  id: number;
  user_id: string;
  user_message: string;
  bot_response: string;
  created_at: string;
};

export async function getChatHistory(
  db: D1Database,
  userId: string,
  limit: number = 10
): Promise<ChatMessage[]> {
  try {
    const result = await db
      .prepare(
        `SELECT id, user_id, user_message, bot_response, created_at 
         FROM chat_history 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`
      )
      .bind(userId, limit)
      .all();

    // Reverse to get chronological order
    return (result.results as ChatMessage[]).reverse();
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
}

export async function saveChatMessage(
  db: D1Database,
  userId: string,
  userMessage: string,
  botResponse: string
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO chat_history (user_id, user_message, bot_response, created_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(userId, userMessage, botResponse)
      .run();
  } catch (error) {
    console.error('Error saving chat message:', error);
    throw error;
  }
}

export async function clearOldMessages(
  db: D1Database,
  daysToKeep: number = 30
): Promise<void> {
  try {
    await db
      .prepare(
        `DELETE FROM chat_history 
         WHERE created_at < datetime('now', '-' || ? || ' days')`
      )
      .bind(daysToKeep)
      .run();
  } catch (error) {
    console.error('Error clearing old messages:', error);
  }
}
