# Deploy Booking Service to Cloudflare

## Quick Deploy (Requires Cloudflare Account)

### 1. Create D1 Database

```bash
cd booking-service/worker
npx wrangler d1 create booking-service-db
```

Copy the `database_id` from output and update `wrangler.toml`.

### 2. Create KV Namespace

```bash
npx wrangler kv:namespace create CACHE
```

Copy the `id` and update `wrangler.toml`.

### 3. Initialize Database

```bash
npx wrangler d1 execute booking-service-db --file=../database/schema-d1.sql
```

### 4. Deploy Worker

```bash
npx wrangler deploy
```

Your API will be at: `https://booking-service-api.your-subdomain.workers.dev`

### 5. Deploy UI (Pages)

```bash
cd ../
npx wrangler pages deploy public --project-name=booking-service
```

Your UI will be at: `https://booking-service.pages.dev`

### 6. Update Portfolio

Update `personal-website/index.html`:

```html
<a href="https://booking-service.pages.dev" target="_blank">🎬 View Live Demo →</a>
```

---

## Without Cloudflare Account (Local Demo)

The current demo shows the UI only. To test full functionality:

```bash
cd booking-service
docker compose up -d
npm install && npm run dev
open http://localhost:3000
```

---

## Architecture Comparison

### Current (PostgreSQL + Redis)
- ✅ Full-featured
- ✅ Production-ready
- ❌ Requires Docker or cloud VM

### Cloudflare Version (D1 + KV)
- ✅ Serverless (no servers to manage)
- ✅ Free tier (100K requests/day)
- ✅ Global edge deployment
- ⚠️ D1 is SQLite (limited vs PostgreSQL)
- ⚠️ KV has eventual consistency

For a portfolio project, the Cloudflare version demonstrates:
- Serverless architecture
- Edge computing
- Cloud-native patterns
