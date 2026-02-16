# Production-Grade Booking Service

A race-condition safe, distributed booking system demonstrating enterprise-level concurrency control patterns.

## 🎯 What This Demonstrates

This is **not** a tutorial project. It's a production-ready booking service that handles:

- ✅ **Race conditions** - Prevents double-booking with distributed locks
- ✅ **Concurrent requests** - Handles simultaneous booking attempts safely
- ✅ **Idempotency** - Duplicate API calls return same result
- ✅ **Database transactions** - Atomic operations with proper isolation
- ✅ **Distributed locking** - Redis-based coordination across service instances
- ✅ **Audit logging** - Complete history of all booking changes
- ✅ **Graceful shutdown** - Proper cleanup on termination

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│                    (Fastify + Rate Limiting)                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Booking Service                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Request Validation (Zod)                                │  │
│  │  ↓                                                       │  │
│  │  Idempotency Check                                       │  │
│  │  ↓                                                       │  │
│  │  Redis Distributed Lock (per time slot)                  │  │
│  │  ↓                                                       │  │
│  │  Database Transaction (SELECT FOR UPDATE)                │  │
│  │  ↓                                                       │  │
│  │  Unique Constraint Enforcement                           │  │
│  │  ↓                                                       │  │
│  │  Audit Log                                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │  PostgreSQL  │ │    Redis     │ │   Structured │
        │  (Primary)   │ │   (Locks)    │ │    Logging   │
        └──────────────┘ └──────────────┘ └──────────────┘
```

## 🛡 Multi-Layer Concurrency Protection

### Layer 1: Idempotency Key
```
Client sends: X-Idempotency-Key: unique-request-id
Service checks: Have we seen this request before?
If yes: Return cached result (no duplicate processing)
```

### Layer 2: Redis Distributed Lock
```
Lock key: booking:{userId}:{startTime}
Algorithm: SETNX with TTL (lease-based)
Purpose: Prevents concurrent requests for same time slot
Timeout: 5 seconds (auto-expires if service crashes)
```

### Layer 3: Database Transaction
```sql
BEGIN TRANSACTION;

-- Check for overlapping bookings (with row-level lock)
SELECT * FROM bookings 
WHERE userId = ? 
  AND status IN ('PENDING', 'CONFIRMED')
  AND (
    startTime <= ? AND endTime > ?
    OR startTime < ? AND endTime >= ?
  )
FOR UPDATE; -- Blocks other transactions

-- Insert new booking
INSERT INTO bookings (...) VALUES (...);

COMMIT;
```

### Layer 4: Unique Constraints
```sql
-- Database-level protection (last line of defense)
UNIQUE CONSTRAINT ON (startTime, endTime, userId)
```

## 📁 Project Structure

```
booking-service/
├── src/
│   ├── index.js              # Fastify server setup
│   ├── services/
│   │   └── BookingService.js # Core booking logic with transactions
│   ├── lib/
│   │   └── RedisLock.js      # Distributed lock implementation
│   └── utils/
│       ├── logger.js         # Structured logging (Pino)
│       └── validators.js     # Zod schemas for validation
├── prisma/
│   └── schema.prisma         # Database schema with constraints
├── tests/
│   └── concurrency.test.js   # Race condition tests
├── docker/
│   └── Dockerfile            # Production container
├── docker-compose.yml        # Full stack (Postgres + Redis + Service)
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose

### 1. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for services to be healthy
docker-compose ps
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Database

```bash
# Copy environment file
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init
```

### 4. Run the Service

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Service runs on `http://localhost:3000`

## 🧪 Running Tests

### Run All Tests

```bash
npm test
```

### Run Concurrency Tests (The Important Ones)

```bash
# This demonstrates race-condition prevention
npm run test:concurrency
```

### What the Tests Prove

1. **Double-booking prevention**: 10 simultaneous requests → only 1 succeeds
2. **Idempotency**: Same request twice → same result, no duplicate
3. **Overlap detection**: Conflicting time slots → rejected
4. **Atomic operations**: Cancel/reschedule → all-or-nothing
5. **Distributed locks**: Lock acquisition → exclusive access
6. **High-load handling**: 50 concurrent different slots → all succeed

## 📡 API Reference

### Create Booking

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-request-123" \
  -H "X-User-ID: user-uuid" \
  -d '{
    "userId": "user-uuid",
    "startTime": "2024-01-15T14:00:00Z",
    "endTime": "2024-01-15T14:30:00Z",
    "metadata": {
      "title": "Team Meeting",
      "location": "Conference Room A"
    }
  }'
```

### Get Available Slots

```bash
curl "http://localhost:3000/api/users/user-uuid/slots?startDate=2024-01-15T00:00:00Z&endDate=2024-01-16T00:00:00Z&slotDuration=30"
```

### Cancel Booking

```bash
curl -X POST http://localhost:3000/api/bookings/{bookingId}/cancel \
  -H "X-User-ID: user-uuid" \
  -d '{"reason": "Schedule conflict"}'
```

### Reschedule Booking

```bash
curl -X POST http://localhost:3000/api/bookings/{bookingId}/reschedule \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-uuid" \
  -d '{
    "startTime": "2024-01-15T15:00:00Z",
    "endTime": "2024-01-15T15:30:00Z"
  }'
```

### Health Check

```bash
curl http://localhost:3000/health
```

## 🗄 Database Schema

### Key Design Decisions

```prisma
model Booking {
  id              String   @id @default(uuid())
  userId          String
  startTime       DateTime // Always UTC
  endTime         DateTime // Always UTC
  status          BookingStatus
  idempotencyKey  String   @unique  -- Prevents duplicates
  version         Int      @default(1) -- Optimistic locking
  
  @@unique([startTime, endTime, userId]) -- Race condition protection
  @@index([userId, startTime]) -- Efficient queries
}
```

### Why UTC?

- Timezone-aware scheduling is handled at the API layer
- All comparisons are consistent regardless of user location
- No DST (Daylight Saving Time) issues in storage

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| Input Validation | Zod schemas on all endpoints |
| Rate Limiting | 100 requests/minute per IP |
| CORS | Configurable origin restrictions |
| Security Headers | Helmet middleware |
| SQL Injection | Prisma ORM (parameterized queries) |
| Idempotency | Key-based deduplication |

## 📊 Observability

### Structured Logging

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:00.000Z",
  "service": "booking-service",
  "correlationId": "abc-123-def",
  "method": "POST",
  "url": "/api/bookings",
  "statusCode": 201,
  "responseTime": 45
}
```

### Metrics Endpoint

```bash
curl http://localhost:3000/metrics
```

Returns Prometheus-format metrics for monitoring.

## 🧩 Production Deployment

### Docker Deployment

```bash
# Build and run full stack
docker-compose up -d

# View logs
docker-compose logs -f booking-service
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | - | PostgreSQL connection string |
| `REDIS_URL` | ✅ | - | Redis connection string |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment |
| `RATE_LIMIT_MAX` | No | 100 | Max requests per window |
| `RATE_LIMIT_WINDOW` | No | 60000 | Rate limit window (ms) |

### Scaling Considerations

For production deployment:

1. **Multiple instances**: Redis locks work across all instances
2. **Connection pooling**: Prisma handles DB connections
3. **Graceful shutdown**: In-flight requests complete before termination
4. **Health checks**: `/health` endpoint for load balancer

## 🎓 Key Engineering Concepts

### 1. Distributed Locking

```javascript
const lock = await redisLock.acquire(`booking:${userId}:${startTime}`, 5000);

if (!lock) {
  throw new Error('Another request in progress');
}

try {
  // Critical section - only one request can execute this
  await createBookingInTransaction();
} finally {
  await lock.release(); // Always release
}
```

### 2. Database Transactions

```javascript
await prisma.$transaction(async (tx) => {
  // All operations are atomic
  const overlapping = await tx.booking.findFirst({ ... });
  
  if (overlapping) {
    throw new Error('Conflict');
  }
  
  return await tx.booking.create({ ... });
});
```

### 3. Idempotency

```javascript
const existing = await prisma.booking.findUnique({
  where: { idempotencyKey }
});

if (existing) {
  return existing; // Return cached result
}
```

## 📝 Why This Matters

Most booking tutorials skip concurrency handling. This leads to:

- ❌ Double-bookings when traffic increases
- ❌ Data corruption under load
- ❌ Race conditions that are hard to debug
- ❌ Unhappy customers

This implementation shows you can build systems that:

- ✅ Handle concurrent requests safely
- ✅ Scale horizontally (multiple service instances)
- ✅ Recover gracefully from failures
- ✅ Maintain data integrity under load

## 🔧 Troubleshooting

### Lock Timeout Issues

If locks are timing out too quickly:

```bash
# Increase lock timeout in BookingService.js
this.lockTimeout = 10000; // 10 seconds
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View database logs
docker-compose logs postgres
```

### Redis Connection Issues

```bash
# Check Redis is running
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli ping
```

## 📚 Further Reading

- [Martin Kleppmann - Designing Data-Intensive Applications](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/)
- [Redis Distributed Locks](https://redis.io/topics/distlock)
- [Database Transaction Isolation](https://en.wikipedia.org/wiki/Isolation_(database_systems))

## 📄 License

MIT License
