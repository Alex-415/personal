-- Chat history table for storing conversation context
CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_user_id ON chat_history(user_id);

-- Index for ordering by timestamp
CREATE INDEX IF NOT EXISTS idx_created_at ON chat_history(created_at DESC);
