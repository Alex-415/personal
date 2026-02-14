# Microservice Health Simulator - Backend

Production-grade microservice health monitoring system with async Python backend.

## Features

- Simulates 9 interconnected microservices
- Real-time metrics tracking (latency, error rates, success rates)
- Failure propagation across dependencies
- WebSocket streaming for live updates
- REST API for metrics and failure simulation
- Concurrency-safe metric updates

## Tech Stack

- Python 3.11
- FastAPI
- asyncio
- WebSockets
- Docker

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --reload --port 8000
```

Server runs at `http://localhost:8000`

## API Endpoints

- `GET /health` - Health check
- `GET /services` - Get all services with metrics
- `GET /metrics` - Get aggregated metrics
- `POST /simulate-failure` - Simulate failure on a service
  ```json
  {
    "service_id": "api-gateway",
    "duration_seconds": 30
  }
  ```
- `WS /ws` - WebSocket for real-time updates

## Render.com Deployment

### Step 1: Push to GitHub

```bash
cd microservice-health-backend
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 2: Deploy on Render.com

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `microservice-health-backend`
   - **Environment**: `Docker`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Plan**: Free (or paid for better performance)
5. Click **"Create Web Service"**

### Step 3: Configuration (Auto-detected from Dockerfile)

Render will automatically:
- Detect the Dockerfile
- Build the container
- Expose port 10000
- Run the uvicorn command

### Step 4: Get Your API URL

After deployment completes, you'll get a URL like:
```
https://microservice-health-backend.onrender.com
```

Test it:
```bash
curl https://YOUR_APP.onrender.com/health
curl https://YOUR_APP.onrender.com/services
```

## Environment Variables (Optional)

No environment variables required for basic setup. Can add:

- `LOG_LEVEL` - Logging level (default: INFO)
- `SIMULATION_SPEED` - Adjust simulation speed

## Architecture

```
main.py
├── MicroserviceSimulator
│   ├── 9 simulated services
│   ├── Dependency graph
│   ├── Async simulation loop
│   └── Metrics collection
├── FastAPI endpoints
│   ├── REST API
│   └── WebSocket streaming
└── CORS middleware
```

## Services Simulated

1. **api-gateway** → auth-service, user-service
2. **auth-service** → db-service
3. **user-service** → db-service, cache-service
4. **order-service** → payment-service, inventory-service
5. **payment-service** → db-service
6. **inventory-service** → db-service, cache-service
7. **notification-service** (no dependencies)
8. **db-service** (no dependencies)
9. **cache-service** (no dependencies)

## Testing

```bash
# Get all services
curl http://localhost:8000/services

# Get metrics
curl http://localhost:8000/metrics

# Simulate failure
curl -X POST http://localhost:8000/simulate-failure \
  -H "Content-Type: application/json" \
  -d '{"service_id": "db-service", "duration_seconds": 30}'
```

## WebSocket Testing

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Services:', data.services);
};
```

## Production Notes

- Async Python with asyncio for concurrency
- Semaphore-based locking for thread-safe metrics
- Structured JSON logging
- Graceful shutdown handling
- Docker containerized
- CORS enabled for frontend integration

## License

© 2024 Al A. All rights reserved.
