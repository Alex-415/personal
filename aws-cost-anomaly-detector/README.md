# AWS Cost Anomaly Detector

Production-ready AWS cost monitoring system that detects spending anomalies and sends alerts via Slack or email. Built on Cloudflare Workers with D1 database storage.

## Features

- **Real-time Cost Tracking**: Fetch daily costs from AWS Cost Explorer API by service
- **Anomaly Detection**: Automatically detects >20% spikes (day-over-day or week-over-week)
- **Alert System**: Send notifications via Slack webhooks or email (SendGrid)
- **Historical Analysis**: Store cost history in Cloudflare D1 for trend analysis
- **Dashboard**: Clean, responsive UI showing costs, trends, and anomalies
- **Scheduled Jobs**: Daily automated cost fetching via Cloudflare Cron Triggers
- **Multi-account Support**: Monitor multiple AWS accounts from one dashboard
- **API-first Design**: Full REST API with API key authentication
- **Demo Mode**: Try the dashboard with sample AWS data (no credentials needed)

## Quick Start

### Option 1: Demo Mode (No AWS Required)

1. Deploy the app (see deployment steps below)
2. Open the dashboard
3. Click **"Try Demo Mode"**
4. Explore the UI with sample AWS cost data

### Option 2: Production Mode (Real AWS Data)

1. Deploy the app
2. Generate an API key
3. Add your AWS credentials
4. Fetch real cost data from AWS

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Cloudflare      │────▶│  AWS Cost       │
│   (Pages)       │     │  Workers         │     │  Explorer API   │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                              │
                              ▼
                        ┌──────────────────┐
                        │  Cloudflare D1   │
                        │  (SQLite)        │
                        └──────────────────┘
                              │
                              ▼
                        ┌──────────────────┐
                        │  Slack / Email   │
                        │  Alerts          │
                        └──────────────────┘
```

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [AWS account](https://aws.amazon.com/) with Cost Explorer enabled (for production mode)
- [Node.js 18+](https://nodejs.org/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## Deployment

### 1. Install Dependencies

```bash
cd aws-cost-anomaly-detector
npm install
```

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 3. Create D1 Database

```bash
# Create the database
npx wrangler d1 create cost-anomaly-db

# Copy the database_id from the output
# Update wrangler.toml: database_id = "your-database-id-here"
```

### 4. Initialize Database Schema

```bash
# Initialize the schema
npx wrangler d1 execute cost-anomaly-db --file=database/schema.sql
```

### 5. Configure Secrets (Production Mode Only)

```bash
# AWS credentials (only needed for production mode)
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY

# Optional: Slack webhook for alerts
npx wrangler secret put SLACK_WEBHOOK_URL

# Optional: SendGrid for email alerts
npx wrangler secret put SENDGRID_API_KEY
npx wrangler secret put FROM_EMAIL
```

### 6. Deploy to Cloudflare

```bash
# Deploy the Worker
npx wrangler deploy

# Deploy the frontend to Pages
npm run deploy:frontend
```

Your app will be deployed to:
- Worker API: `https://aws-cost-anomaly-detector.<your-subdomain>.workers.dev`
- Frontend: `https://aws-cost-anomaly-detector.pages.dev`

## Usage

### Demo Mode

1. Open the dashboard at your Pages URL
2. Click **"Try Demo Mode (No API Key Needed)"**
3. The app will:
   - Generate sample AWS cost data (30 days)
   - Create a demo API key automatically
   - Show cost trends, services, and anomalies
   - Include a 45% EC2 spike from 5 days ago for anomaly demo

### Production Mode

#### 1. Generate an API Key

```bash
curl -X POST https://your-worker.workers.dev/api/keys \
  -H "Content-Type: application/json"
```

Save the returned API key - it cannot be retrieved later.

#### 2. Add Your AWS Account

```bash
curl -X POST https://your-worker.workers.dev/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "accountName": "Production",
    "accessKeyId": "AKIA...",
    "secretAccessKey": "...",
    "region": "us-east-1"
  }'
```

#### 3. Fetch Cost Data

```bash
curl -X POST https://your-worker.workers.dev/api/costs/fetch \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### 4. Detect Anomalies

```bash
curl -X POST "https://your-worker.workers.dev/api/anomalies/detect?threshold=20" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### 5. Configure Alerts

```bash
# Slack
curl -X POST https://your-worker.workers.dev/api/alerts/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "alertType": "slack",
    "destination": "https://hooks.slack.com/services/...",
    "minAlertAmount": 10
  }'

# Email
curl -X POST https://your-worker.workers.dev/api/alerts/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "alertType": "email",
    "destination": "you@example.com",
    "minAlertAmount": 10
  }'
```

## API Reference

### Demo Endpoints (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/demo/seed` | Generate sample AWS cost data |
| GET | `/api/demo/status` | Check if demo data exists |
| DELETE | `/api/demo/clear` | Clear demo data |

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/keys` | Generate new API key |
| GET | `/api/keys` | List API keys |
| DELETE | `/api/keys/:id` | Revoke API key |

### Account & Cost Endpoints (Require API Key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/accounts` | Add AWS account |
| GET | `/api/accounts` | List accounts |
| DELETE | `/api/accounts/:id` | Deactivate account |
| POST | `/api/costs/fetch` | Fetch costs from AWS |
| GET | `/api/costs/summary` | Get cost summary |
| GET | `/api/costs/trend` | Get daily cost trend |
| POST | `/api/anomalies/detect` | Run anomaly detection |
| GET | `/api/anomalies` | Get detected anomalies |
| POST | `/api/alerts/config` | Configure alert destination |
| POST | `/api/alerts/send` | Send alerts for unalerted anomalies |

## AWS IAM Policy

Create an IAM user with the following **read-only** policy for Cost Explorer access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CostExplorerReadOnly",
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetCostForecast"
      ],
      "Resource": "*"
    }
  ]
}
```

## Demo Data Features

The demo mode includes realistic AWS cost patterns:

| Feature | Description |
|---------|-------------|
| **10 AWS Services** | EC2, RDS, Lambda, S3, CloudFront, DynamoDB, ELB, Route53, CloudWatch, API Gateway |
| **30 Days of Data** | Full month of daily cost records |
| **Weekend Dips** | 30% lower costs on weekends (simulates reduced traffic) |
| **Anomaly Spike** | 45% EC2 cost spike 5 days ago for anomaly detection demo |
| **Service Variance** | Each service has realistic cost variance (10-40%) |

## Cost Estimation

### Cloudflare (Free Tier)
- **Workers**: 100,000 requests/day included
- **D1**: 5GB storage, 5 million reads/month included
- **Pages**: Unlimited sites, 100GB bandwidth/month

### AWS Cost Explorer
- **Free**: Up to 3 years of cost data
- **API calls**: ~60 per month (2 per day for daily fetch)

### Optional Services
- **SendGrid**: Free tier (100 emails/day)
- **Slack**: Free

## Project Structure

```
aws-cost-anomaly-detector/
├── src/
│   └── worker.ts          # Cloudflare Worker API (demo + production)
├── database/
│   └── schema.sql         # D1 database schema
├── frontend/
│   └── index.html         # Dashboard UI with demo mode
├── aws-iam-policy.json    # AWS IAM policy template
├── package.json
├── wrangler.toml
├── tsconfig.json
├── DEPLOYMENT.md          # Step-by-step deployment checklist
└── README.md              # This file
```

## Development

### Local Testing

```bash
# Start local dev server
npx wrangler dev

# The API will be available at http://localhost:8787
# The frontend can be opened directly in browser
```

### Test Demo Mode

```bash
# Seed demo data
curl -X POST http://localhost:8787/api/demo/seed

# Generate API key
curl -X POST http://localhost:8787/api/keys

# Check demo status
curl http://localhost:8787/api/demo/status
```

## Troubleshooting

### Demo Mode Not Working
- Clear browser localStorage: `localStorage.clear()`
- Delete demo data: `curl -X DELETE https://your-worker.workers.dev/api/demo/clear`
- Reload the dashboard

### Invalid AWS Credentials (Production Mode)
- Verify the access key starts with `AKIA`
- Check that Cost Explorer is enabled in your AWS account (takes 24 hours to activate)
- Ensure the IAM user has `ce:GetCostAndUsage` permission

### Database Errors
- Verify `database_id` in `wrangler.toml`
- Re-run schema initialization

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions welcome! Please open an issue for bugs or feature requests.
