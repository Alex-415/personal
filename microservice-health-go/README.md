# Microservice Health Simulator - Go Backend

Production-grade microservice health monitoring system built with Go.

## Features

- Simulates 9 interconnected microservices
- Concurrent goroutines for service simulation
- Real-time metrics with mutex-based thread safety
- WebSocket streaming for live updates
- REST API for metrics and failure simulation
- High-performance Go runtime

## Tech Stack

- Go 1.21
- Gorilla Mux (routing)
- Gorilla WebSocket
- CORS middleware
- Docker

## Local Development

```bash
# Install dependencies
go mod download

# Run server
go run main.go
```

Server runs at `http://localhost:10000`

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

### Step 1: Initialize Go Module

```bash
cd microservice-health-go
go mod tidy
```

This creates `go.sum` file with dependency checksums.

### Step 2: Push to GitHub

```bash
git init
git add .
git commit -m "Go microservice health simulator"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 3: Deploy on Render.com

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `microservice-health-go`
   - **Environment**: `Docker`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Plan**: Free (or paid for better performance)
5. Click **"Create Web Service"**

### Step 4: Configuration (Auto-detected)

Render will automatically:
- Detect the Dockerfile
- Build the Go binary in multi-stage build
- Expose port 10000
- Run the compiled binary

### Step 5: Get Your API URL

After deployment completes, you'll get a URL like:
```
https://microservice-health-go.onrender.com
```

Test it:
```bash
curl https://YOUR_APP.onrender.com/health
curl https://YOUR_APP.onrender.com/services
```

### Step 6: Update Frontend

In your Vue frontend `index.html`, update the API URL:
```javascript
apiUrl: 'https://microservice-health-go.onrender.com'
```

## Build & Run with Docker

```bash
# Build
docker build -t microservice-health-go .

# Run
docker run -p 10000:10000 microservice-health-go
```

## Architecture

```
main.go
├── Simulator struct
│   ├── 9 simulated services
│   ├── Dependency graph
│   ├── Goroutines for concurrent simulation
│   └── Mutex-protected metrics
├── HTTP handlers (Gorilla Mux)
│   ├── REST API endpoints
│   └── WebSocket handler
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
curl http://localhost:10000/services

# Get metrics
curl http://localhost:10000/metrics

# Simulate failure
curl -X POST http://localhost:10000/simulate-failure \
  -H "Content-Type: application/json" \
  -d '{"service_id": "db-service", "duration_seconds": 30}'
```

## WebSocket Testing

```javascript
const ws = new WebSocket('ws://localhost:10000/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Services:', data.services);
};
```

## Performance Benefits of Go

- **Concurrency**: Goroutines are lightweight (2KB stack vs Python threads)
- **Speed**: Compiled binary runs 10-50x faster than Python
- **Memory**: Lower memory footprint
- **Deployment**: Single binary, no runtime dependencies
- **Scalability**: Better handling of concurrent WebSocket connections

## Production Notes

- Goroutines for concurrent service simulation
- Mutex-based thread-safe metrics (RWMutex for read optimization)
- Structured logging with standard library
- Multi-stage Docker build for minimal image size
- CORS enabled for frontend integration
- Graceful handling of WebSocket connections

## License

© 2024 Al A. All rights reserved.
