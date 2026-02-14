# Network Scanner Backend

Production-grade async TCP port scanner with FastAPI.

## Features

- Async concurrent scanning with semaphore-based rate limiting
- SSRF protection (blocks private IPs)
- Input validation and sanitization
- Structured JSON logging
- Configurable concurrency limits
- Proper error handling

## Local Development

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Deploy to Render.com

1. Create new Web Service
2. Connect GitHub repo
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Deploy

## Environment Variables

- `MAX_CONCURRENT`: Max concurrent connections (default: 100)
- `MAX_PORT_RANGE`: Max port range per scan (default: 1024)

## API

**POST /scan**

Request:
```json
{
  "host": "scanme.nmap.org",
  "startPort": 20,
  "endPort": 100,
  "timeoutMs": 1000
}
```

Response:
```json
{
  "host": "scanme.nmap.org",
  "resolvedIp": "45.33.32.156",
  "scanSummary": {
    "totalPorts": 81,
    "openPorts": 3,
    "closedPorts": 78,
    "avgLatencyMs": 45.2
  },
  "results": [
    {"port": 22, "status": "open", "latencyMs": 21.5},
    {"port": 23, "status": "closed", "latencyMs": null}
  ]
}
```
