#!/bin/bash

# openClaw experience - Automated Local Setup Script
# This script sets up everything needed to run locally

set -e

echo "🚀 openClaw experience - Local Setup"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18+ required. You have $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v)${NC}"
echo -e "${GREEN}✅ npm $(npm -v)${NC}"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}Installing Wrangler CLI...${NC}"
    npm install -g wrangler
fi

echo -e "${GREEN}✅ Wrangler $(wrangler --version)${NC}"
echo ""

# Create project directory
PROJECT_DIR="openclaw-experience"
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}⚠️  Directory $PROJECT_DIR already exists${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${BLUE}Creating project directory...${NC}"
    mkdir -p "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# Create directory structure
echo -e "${BLUE}Creating directory structure...${NC}"
mkdir -p src/handlers src/db

# Copy and rename files
echo -e "${BLUE}Copying source files...${NC}"

# Get the source directory (parent directory)
SOURCE_DIR=".."

# Copy files with renaming
cp "$SOURCE_DIR/telegram-bot-index.ts" "src/index.ts"
cp "$SOURCE_DIR/telegram-bot-handlers-telegram.ts" "src/handlers/telegram.ts"
cp "$SOURCE_DIR/telegram-bot-handlers-llm.ts" "src/handlers/llm.ts"
cp "$SOURCE_DIR/telegram-bot-handlers-search.ts" "src/handlers/search.ts"
cp "$SOURCE_DIR/telegram-bot-db-queries.ts" "src/db/queries.ts"
cp "$SOURCE_DIR/telegram-bot-schema.sql" "src/db/schema.sql"
cp "$SOURCE_DIR/telegram-bot-wrangler.toml" "wrangler.toml"
cp "$SOURCE_DIR/telegram-bot-package.json" "package.json"

echo -e "${GREEN}✅ Files copied${NC}"
echo ""

# Create tsconfig.json if it doesn't exist
if [ ! -f "tsconfig.json" ]; then
    echo -e "${BLUE}Creating tsconfig.json...${NC}"
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
    echo -e "${GREEN}✅ tsconfig.json created${NC}"
fi

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo -e "${BLUE}Creating .gitignore...${NC}"
    cat > .gitignore << 'EOF'
node_modules/
dist/
.wrangler/
.env.local
.env
*.log
.DS_Store
EOF
    echo -e "${GREEN}✅ .gitignore created${NC}"
fi

echo ""

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm install

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Create .env.local
echo -e "${BLUE}Setting up environment variables...${NC}"

if [ ! -f ".env.local" ]; then
    cat > .env.local << 'EOF'
# Get these from:
# Telegram: @BotFather on Telegram
# Gemini: https://ai.google.dev/

TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
GEMINI_API_KEY=your_google_gemini_api_key_here
EOF
    echo -e "${YELLOW}⚠️  .env.local created with placeholder values${NC}"
    echo -e "${YELLOW}   Please edit .env.local and add your API keys:${NC}"
    echo -e "${YELLOW}   - TELEGRAM_BOT_TOKEN (from @BotFather)${NC}"
    echo -e "${YELLOW}   - GEMINI_API_KEY (from ai.google.dev)${NC}"
else
    echo -e "${GREEN}✅ .env.local already exists${NC}"
fi

echo ""

# Create local D1 database
echo -e "${BLUE}Setting up local D1 database...${NC}"

# Check if database already exists
if [ ! -d ".wrangler/state/d1" ]; then
    wrangler d1 create openclaw-db --local
    echo -e "${GREEN}✅ Database created${NC}"
else
    echo -e "${GREEN}✅ Database already exists${NC}"
fi

# Apply schema
echo -e "${BLUE}Applying database schema...${NC}"
wrangler d1 execute openclaw-db --local --file=src/db/schema.sql

echo -e "${GREEN}✅ Schema applied${NC}"
echo ""

# Summary
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "1. Edit .env.local with your API keys:"
echo "   nano .env.local"
echo ""
echo "2. Start development server:"
echo "   wrangler dev"
echo ""
echo "3. In another terminal, watch logs:"
echo "   wrangler tail"
echo ""
echo "4. In another terminal, test:"
echo "   curl http://localhost:8787/"
echo ""
echo "5. Send test message:"
echo "   curl -X POST http://localhost:8787/webhook \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"message\": {\"message_id\": 1, \"date\": 1234567890, \"chat\": {\"id\": 123456789, \"type\": \"private\"}, \"from\": {\"id\": 123456789, \"is_bot\": false, \"first_name\": \"Test\"}, \"text\": \"Hello!\"}}'"
echo ""
echo "6. Query database:"
echo "   wrangler d1 execute openclaw-db --local --command \"SELECT * FROM chat_history\""
echo ""
echo "7. Run automated tests:"
echo "   bash ../test-openclaw-local.sh"
echo ""
echo -e "${YELLOW}📝 Important: Edit .env.local before running!${NC}"
echo ""
