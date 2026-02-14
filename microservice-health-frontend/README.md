# Microservice Health Simulator - Frontend

Vue.js dashboard for real-time microservice health monitoring.

## Features

- Real-time service health visualization
- Color-coded status indicators (healthy/degraded/failing)
- Live metrics dashboard
- Failure simulation controls
- Auto-refresh mode
- **Wake Up Server button** for Render.com free tier
- Responsive design

## Tech Stack

- Vue.js 3 (CDN)
- Vanilla JavaScript
- CSS3
- Netlify deployment

## Local Development

1. Update API URL in `index.html`:
```javascript
apiUrl: 'http://localhost:8000'
```

2. Open `index.html` in browser or use a local server:
```bash
python -m http.server 3000
```

Visit `http://localhost:3000`

## Netlify Deployment

### Option 1: Drag & Drop
1. Go to [netlify.com](https://netlify.com)
2. Drag the `microservice-health-frontend` folder to deploy

### Option 2: GitHub
1. Push to GitHub:
```bash
cd microservice-health-frontend
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

2. On Netlify:
   - Click "New site from Git"
   - Connect GitHub repo
   - Build settings: (leave empty, it's static HTML)
   - Click "Deploy site"

### Step 3: Update API URL

After deploying backend to Render.com, update the API URL in `index.html`:

```javascript
apiUrl: 'https://YOUR-BACKEND.onrender.com'
```

Redeploy to Netlify.

## Configuration

In `index.html`, line ~180:
```javascript
apiUrl: 'https://YOUR-BACKEND.onrender.com'
```

Replace with your actual Render.com backend URL.

## Features Explained

### Wake Up Server Button
- Render.com free tier sleeps after 15 minutes of inactivity
- Button sends request to wake up the server
- Shows loading state during wake-up (30-60 seconds)
- Automatically fetches data once server is awake

### Auto-Refresh
- Toggle to enable/disable automatic data refresh
- Refreshes every 3 seconds when enabled
- Useful for monitoring real-time changes

### Simulate Failure
- Click button on any service card
- Forces that service to fail for 30 seconds
- Watch failure propagate to dependent services

## Service Status Colors

- 🟢 **Green (Healthy)**: Error rate < 20%
- 🟡 **Yellow (Degraded)**: Error rate > 20%
- 🔴 **Red (Failing)**: Forced failure active

## Metrics Displayed

- **Total Requests**: Across all services
- **Total Errors**: Failed requests
- **Avg Latency**: Average response time
- **Healthy Services**: Count of healthy services

Per Service:
- Latency (ms)
- Error Rate (%)
- Success Rate (%)
- Total Requests
- Dependencies

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

© 2024 Al A. All rights reserved.
