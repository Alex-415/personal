# Deployment Checklist

## Prerequisites
- [ ] Cloudflare account created
- [ ] AWS account with Cost Explorer enabled (24hr activation required)
- [ ] Node.js 18+ installed
- [ ] Wrangler CLI installed (`npm install -g wrangler`)

## Initial Setup

### 1. Authenticate with Cloudflare
```bash
npx wrangler login
```

### 2. Create D1 Database
```bash
npx wrangler d1 create cost-anomaly-db
```
- [ ] Copy the `database_id` from output
- [ ] Update `wrangler.toml` with `database_id = "..."`

### 3. Initialize Database Schema
```bash
npx wrangler d1 execute cost-anomaly-db --file=database/schema.sql
```

### 4. Create AWS IAM User
- [ ] Go to AWS IAM Console → Users → Create user
- [ ] Name: `cost-anomaly-detector`
- [ ] Attach policy from `aws-iam-policy.json`
- [ ] Create access keys
- [ ] Save Access Key ID and Secret Access Key

### 5. Configure Secrets
```bash
# Required
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY

# Optional (for alerts)
npx wrangler secret put SLACK_WEBHOOK_URL
npx wrangler secret put SENDGRID_API_KEY
npx wrangler secret put FROM_EMAIL
npx wrangler secret put CRON_SECRET
```

## Deploy

### 6. Deploy Worker
```bash
npx wrangler deploy
```
- [ ] Note the Worker URL (e.g., `https://aws-cost-anomaly-detector.your-subdomain.workers.dev`)

### 7. Deploy Frontend
```bash
npm run deploy:frontend
```
- [ ] Note the Pages URL (e.g., `https://aws-cost-anomaly-detector.pages.dev`)

## Post-Deployment

### 8. Generate API Key
```bash
curl -X POST https://YOUR-WORKER-URL/api/keys \
  -H "Content-Type: application/json"
```
- [ ] Save the API key securely

### 9. Add AWS Account
```bash
curl -X POST https://YOUR-WORKER-URL/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-API-KEY" \
  -d '{
    "accountName": "Production",
    "accessKeyId": "AKIA...",
    "secretAccessKey": "...",
    "region": "us-east-1"
  }'
```
- [ ] Verify response shows success

### 10. Fetch Initial Cost Data
```bash
curl -X POST https://YOUR-WORKER-URL/api/costs/fetch \
  -H "Authorization: Bearer YOUR-API-KEY"
```
- [ ] Verify costs are fetched

### 11. Test Anomaly Detection
```bash
curl -X POST https://YOUR-WORKER-URL/api/anomalies/detect \
  -H "Authorization: Bearer YOUR-API-KEY"
```

### 12. Configure Alerts (Optional)
```bash
# Slack
curl -X POST https://YOUR-WORKER-URL/api/alerts/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-API-KEY" \
  -d '{
    "alertType": "slack",
    "destination": "https://hooks.slack.com/services/...",
    "minAlertAmount": 10
  }'
```

## Verify

- [ ] Dashboard loads at Pages URL
- [ ] Can enter API key and access dashboard
- [ ] Cost data displays correctly
- [ ] Anomaly detection works
- [ ] Alerts configured (if applicable)
- [ ] Cron trigger is active (check Cloudflare dashboard)

## Troubleshooting

### Cost Explorer Not Enabled
- AWS Cost Explorer takes 24 hours to activate after enabling
- Wait and try again tomorrow

### Invalid Credentials
- Verify IAM user has `ce:GetCostAndUsage` permission
- Check Access Key ID starts with `AKIA`
- Ensure no extra whitespace in keys

### Database Errors
- Verify `database_id` in `wrangler.toml`
- Re-run schema initialization

## Cost Monitoring

- Cloudflare Free Tier: 100K requests/day, 5GB D1 storage
- AWS Cost Explorer: Free
- Expected monthly cost: $0 (within free tiers)
