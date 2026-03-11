CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  first_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON chat_history(created_at);
