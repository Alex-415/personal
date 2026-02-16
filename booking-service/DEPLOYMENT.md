# Cloudflare Deployment Guide

## Overview

This project has two components:
1. **Booking Service API** - Cloudflare Worker (backend)
2. **Dashboard UI** - Cloudflare Pages (frontend)

## Prerequisites

- Cloudflare account (free tier works)
- Cloudflare API token

## Deploy the Booking Service API (Worker)

### 1. Update wrangler.toml

```toml
name = "booking-service-api"
main = "src/index.js"
compatibility_date = "2024-01-01"

# Add your Cloudflare account ID
account_id = "your-account-id-here"

# D1 Database (if using Cloudflare D1 instead of PostgreSQL)
[[d1_databases]]
binding = "DB"
database_name = "booking-service-db"
database_id = "your-database-id-here"

# KV Namespace (for Redis-like caching)
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-id-here"
```

### 2. Deploy Worker

```bash
cd booking-service
npx wrangler deploy
```

Your API will be at: `https://booking-service-api.your-subdomain.workers.dev`

## Deploy the Dashboard UI (Pages)

### 1. Update dashboard.js

Edit `public/dashboard.js` and change:

```javascript
const API_BASE = 'https://booking-service-api.your-subdomain.workers.dev';
```

### 2. Deploy to Pages

```bash
npx wrangler pages deploy public --project-name=booking-service-demo
```

Your UI will be at: `https://booking-service-demo.pages.dev`

## Alternative: Deploy via Cloudflare Dashboard

### For Pages:
1. Go to Cloudflare Dashboard → Pages
2. Click "Create a project"
3. Connect your GitHub repository
4. Build settings:
   - Build command: `echo "No build needed"`
   - Build output: `public`
5. Deploy

### For Worker:
1. Go to Cloudflare Dashboard → Workers & Pages
2. Click "Create Worker"
3. Copy `src/index.js` content
4. Add environment variables in Settings

## Environment Variables

Set these in Cloudflare Dashboard:

### Worker Variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string  
- `PORT` - 3000
- `NODE_ENV` - production

## Update Portfolio

After deploying:

1. Update `personal-website/index.html`:
   - Change GitHub link to your repo
   - Change demo link to your Pages URL

2. Update `booking-service/public/dashboard.js`:
   - Change `API_BASE` to your Worker URL

## Local Testing

Before deploying, test locally:

```bash
# Start infrastructure
docker compose up -d postgres redis

# Install and setup
npm install
npx prisma migrate dev

# Run service
npm run dev

# Open dashboard
open http://localhost:3000
```

## Notes

- The current implementation uses PostgreSQL + Redis (not Cloudflare D1)
- For full Cloudflare integration, you'd need to adapt the code to use D1 and KV
- The UI is static and works on any static hosting (Pages, Netlify, Vercel)
