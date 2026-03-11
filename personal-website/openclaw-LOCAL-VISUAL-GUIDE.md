# openClaw experience - Local Development Visual Guide

## 🏗️ Local Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Computer                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Terminal 1: wrangler dev                            │   │
│  │  ▲ [wrangler:dev] Listening on http://localhost:8787 │   │
│  │  ├─ Watches src/ for changes                         │   │
│  │  ├─ Auto-reloads on file save                        │   │
│  │  └─ Serves HTTP requests                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Local Cloudflare Worker                             │   │
│  │  ├─ src/index.ts (Entry point)                       │   │
│  │  ├─ src/handlers/telegram.ts                         │   │
│  │  ├─ src/handlers/llm.ts                              │   │
│  │  └─ src/handlers/search.ts                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Local D1 Database (SQLite)                          │   │
│  │  ├─ chat_history table                               │   │
│  │  ├─ Stored in .wrangler/state/d1/                    │   │
│  │  └─ Persists between runs                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Terminal 2: wrangler tail                           │   │
│  │  ▲ [wrangler:tail] Connected                         │   │
│  │  ├─ Shows real-time logs                             │   │
│  │  ├─ Displays errors                                  │   │
│  │  └─ Monitors requests                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Terminal 3: curl / Testing                          │   │
│  │  $ curl http://localhost:8787/                       │   │
│  │  $ curl -X POST http://localhost:8787/webhook ...   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Terminal 4: Database Queries                        │   │
│  │  $ wrangler d1 execute openclaw-db --local ...       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Request Flow (Local)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. You send curl request                                    │
│    curl -X POST http://localhost:8787/webhook              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Wrangler dev receives request                            │
│    ▲ [wrangler:dev] POST /webhook 200 OK                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Worker processes request                                 │
│    ├─ Parse JSON body                                       │
│    ├─ Extract user message                                  │
│    └─ Call handlers                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Retrieve conversation history                            │
│    SELECT * FROM chat_history WHERE user_id = '123'        │
│    ↓                                                         │
│    Local D1 Database returns last 10 messages               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Determine if web search needed                           │
│    if (text.includes('latest', 'today', 'news')) → YES     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Fetch web search results (DuckDuckGo API)                │
│    fetch('https://api.duckduckgo.com/?q=...')              │
│    ↓                                                         │
│    Returns search results                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Call Google Gemini API                                   │
│    fetch('https://generativelanguage.googleapis.com/...')  │
│    ├─ Send: user message + history + search results        │
│    └─ Receive: AI response                                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Save to local database                                   │
│    INSERT INTO chat_history (user_id, user_message, ...)   │
│    ↓                                                         │
│    Local D1 Database stores message pair                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. Return response                                          │
│    { ok: true }                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. View in logs                                            │
│     Terminal 2 (wrangler tail) shows:                       │
│     ├─ Request received                                     │
│     ├─ Database query results                               │
│     ├─ Gemini API response                                  │
│     └─ Response sent                                        │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Multi-Terminal Setup

```
┌─────────────────────────────────────────────────────────────┐
│ TERMINAL 1: Development Server                              │
├─────────────────────────────────────────────────────────────┤
│ $ wrangler dev                                              │
│ ⛅ wrangler 3.28.0                                          │
│ ▲ [wrangler:dev] Starting local server...                  │
│ ▲ [wrangler:dev] Listening on http://localhost:8787        │
│ ▲ [wrangler:dev] Watching src/ for changes                 │
│                                                              │
│ (Keep this running)                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TERMINAL 2: Log Monitoring                                  │
├─────────────────────────────────────────────────────────────┤
│ $ wrangler tail                                             │
│ ▲ [wrangler:tail] Connected                                │
│ ▲ POST /webhook 200 OK (45ms)                              │
│ ▲ Database query: 10 rows returned                          │
│ ▲ Gemini API: Response received (1200ms)                    │
│ ▲ Message saved to database                                │
│                                                              │
│ (Keep this running to see logs)                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TERMINAL 3: Testing                                         │
├─────────────────────────────────────────────────────────────┤
│ $ curl http://localhost:8787/                              │
│ {"status":"ok","service":"openclaw-experience"}            │
│                                                              │
│ $ curl -X POST http://localhost:8787/webhook \             │
│   -H "Content-Type: application/json" \                    │
│   -d '{"message": {...}}'                                  │
│ {"ok":true}                                                │
│                                                              │
│ (Run tests here)                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TERMINAL 4: Database Inspection                             │
├─────────────────────────────────────────────────────────────┤
│ $ wrangler d1 execute openclaw-db --local \                │
│   --command "SELECT * FROM chat_history"                   │
│                                                              │
│ id | user_id | user_message | bot_response | created_at    │
│ 1  | 123     | Hello        | Hi there!    | 2024-01-15... │
│ 2  | 123     | How are you? | I'm good!    | 2024-01-15... │
│                                                              │
│ (Query database here)                                       │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 File Editing Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ You edit src/handlers/llm.ts                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Save file (Cmd+S)                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Wrangler detects change                                     │
│ ▲ [wrangler:dev] Reloading...                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ TypeScript compiles                                         │
│ ▲ [wrangler:dev] Compiled successfully                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Worker reloads                                              │
│ ▲ [wrangler:dev] Ready on http://localhost:8787            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Test your changes                                           │
│ $ curl http://localhost:8787/webhook ...                   │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Local Database Structure

```
.wrangler/
└── state/
    └── d1/
        └── openclaw-db.sqlite3
            ├── chat_history table
            │   ├── id (INTEGER, PRIMARY KEY)
            │   ├── user_id (TEXT)
            │   ├── user_message (TEXT)
            │   ├── bot_response (TEXT)
            │   └── created_at (DATETIME)
            │
            └── Indexes
                ├── idx_user_id
                └── idx_created_at
```

## 🚀 Step-by-Step Local Setup

```
Step 1: Create Project Directory
$ mkdir openclaw-experience && cd openclaw-experience

Step 2: Copy Files
$ cp /path/to/telegram-bot-* .
$ mv telegram-bot-wrangler.toml wrangler.toml
$ mv telegram-bot-package.json package.json
$ mkdir -p src/handlers src/db
$ mv telegram-bot-index.ts src/index.ts
$ mv telegram-bot-handlers-*.ts src/handlers/
$ mv telegram-bot-db-queries.ts src/db/queries.ts
$ mv telegram-bot-schema.sql src/db/schema.sql

Step 3: Install Dependencies
$ npm install

Step 4: Create Environment File
$ echo "TELEGRAM_BOT_TOKEN=your_token" > .env.local
$ echo "GEMINI_API_KEY=your_key" >> .env.local

Step 5: Create Local Database
$ wrangler d1 create openclaw-db --local
$ wrangler d1 execute openclaw-db --local --file=src/db/schema.sql

Step 6: Start Development
$ wrangler dev

Step 7: Monitor Logs (New Terminal)
$ wrangler tail

Step 8: Test (New Terminal)
$ curl http://localhost:8787/

Step 9: Query Database (New Terminal)
$ wrangler d1 execute openclaw-db --local --command "SELECT * FROM chat_history"
```

## ✅ Verification Checklist

```
□ Node.js 18+ installed
  $ node --version

□ Wrangler installed
  $ wrangler --version

□ Project directory created
  $ ls openclaw-experience/

□ Dependencies installed
  $ npm list hono

□ .env.local created with keys
  $ cat .env.local

□ Local database created
  $ ls .wrangler/state/d1/

□ wrangler dev running
  $ curl http://localhost:8787/

□ wrangler tail showing logs
  $ wrangler tail

□ Test message works
  $ curl -X POST http://localhost:8787/webhook ...

□ Database stores messages
  $ wrangler d1 execute openclaw-db --local --command "SELECT COUNT(*) FROM chat_history"
```

## 🎯 Common Workflows

### Workflow 1: Quick Test
```
Terminal 1: wrangler dev
Terminal 2: curl http://localhost:8787/webhook ...
Terminal 3: wrangler d1 execute ... (check database)
```

### Workflow 2: Development
```
Terminal 1: wrangler dev (auto-reloads)
Terminal 2: wrangler tail (watch logs)
Terminal 3: Edit code in IDE
Terminal 4: curl to test changes
```

### Workflow 3: Debugging
```
Terminal 1: wrangler dev --debug
Terminal 2: wrangler tail
Terminal 3: curl with test data
Terminal 4: Check database state
```
