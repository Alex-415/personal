#!/bin/bash

# openClaw experience - Local Testing Script
# Usage: ./test-local.sh

set -e

BASE_URL="http://localhost:8787"
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-test_token}"

echo "🚀 openClaw experience - Local Testing"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${BLUE}Test 1: Health Check${NC}"
echo "GET $BASE_URL/"
response=$(curl -s "$BASE_URL/")
echo "Response: $response"
echo ""

# Test 2: Webhook with Simple Message
echo -e "${BLUE}Test 2: Webhook - Simple Message${NC}"
echo "POST $BASE_URL/webhook"
payload='{
  "message": {
    "message_id": 1,
    "date": 1234567890,
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "from": {
      "id": 123456789,
      "is_bot": false,
      "first_name": "TestUser"
    },
    "text": "Hello, what can you do?"
  }
}'
echo "Payload: $payload"
response=$(curl -s -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d "$payload")
echo "Response: $response"
echo ""

# Test 3: Webhook with Search Query
echo -e "${BLUE}Test 3: Webhook - Search Query${NC}"
echo "POST $BASE_URL/webhook"
payload='{
  "message": {
    "message_id": 2,
    "date": 1234567891,
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "from": {
      "id": 123456789,
      "is_bot": false,
      "first_name": "TestUser"
    },
    "text": "What is the latest news today?"
  }
}'
echo "Payload: $payload"
response=$(curl -s -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d "$payload")
echo "Response: $response"
echo ""

# Test 4: Webhook with Follow-up Message
echo -e "${BLUE}Test 4: Webhook - Follow-up Message${NC}"
echo "POST $BASE_URL/webhook"
payload='{
  "message": {
    "message_id": 3,
    "date": 1234567892,
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "from": {
      "id": 123456789,
      "is_bot": false,
      "first_name": "TestUser"
    },
    "text": "Tell me more about that"
  }
}'
echo "Payload: $payload"
response=$(curl -s -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d "$payload")
echo "Response: $response"
echo ""

echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Check wrangler logs: wrangler tail"
echo "2. Query database: wrangler d1 execute openclaw-db --local --command \"SELECT * FROM chat_history\""
echo "3. View full response in logs"
