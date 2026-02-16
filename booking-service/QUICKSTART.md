# Booking Service - Quick Start Guide

## Option 1: With Docker (Recommended)

### Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Wait for services
sleep 5

# Check they're running
docker compose ps
```

### Setup Database

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init
```

### Run Service

```bash
npm run dev
```

API runs on `http://localhost:3000`

---

## Option 2: Without Docker (Local PostgreSQL + Redis)

### Install PostgreSQL

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Create database:**
```bash
createdb booking_db
psql -d booking_db -c "CREATE USER booking WITH PASSWORD 'booking123';"
psql -d booking_db -c "GRANT ALL PRIVILEGES ON DATABASE booking_db TO booking;"
```

### Install Redis

**macOS:**
```bash
brew install redis
brew services start redis
```

### Configure Environment

```bash
cp .env.example .env
# Edit .env if needed (defaults work with local install)
```

### Run Service

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

---

## Test the API

### Health Check
```bash
curl http://localhost:3000/health
```

### Create a Booking
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-123" \
  -H "X-User-ID: user-123" \
  -d '{
    "userId": "user-123",
    "startTime": "2024-01-15T14:00:00Z",
    "endTime": "2024-01-15T14:30:00Z",
    "metadata": {"title": "Test Meeting"}
  }'
```

### Get Available Slots
```bash
curl "http://localhost:3000/api/users/user-123/slots?startDate=2024-01-15T00:00:00Z&endDate=2024-01-16T00:00:00Z&slotDuration=30"
```

---

## Run Tests

```bash
# All tests
npm test

# Concurrency tests (the important ones)
npm run test:concurrency
```

---

## Stop Services

```bash
# Docker
docker compose down

# Local PostgreSQL (macOS)
brew services stop postgresql@15

# Local Redis (macOS)
brew services stop redis
```
