/**
 * AWS Cost Anomaly Detector - Cloudflare Worker
 * 
 * Production-ready serverless API for detecting AWS cost anomalies
 * Runs on Cloudflare Workers with D1 database storage
 * 
 * HYBRID MODE:
 * - Use demo data for testing (POST /api/demo/seed)
 * - Use real AWS credentials for production (POST /api/accounts)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AwsClient } from 'aws4fetch';

// Type definitions for Cloudflare environment
interface Env {
  DB: D1Database;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  SLACK_WEBHOOK_URL?: string;
  SENDGRID_API_KEY?: string;
  FROM_EMAIL?: string;
  CRON_SECRET?: string;
}

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS for frontend access
app.use('/*', cors({
  origin: ['*'], // Restrict to your domain in production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// API key authentication for protected routes
const authenticate = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header. Use: Bearer <your-api-key>' }, 401);
  }

  const apiKey = authHeader.substring(7);
  const keyHash = await hashKey(apiKey);

  const result = await c.env.DB.prepare(
    'SELECT id, key_prefix, last_used_at FROM api_keys WHERE key_hash = ? AND is_active = 1'
  ).bind(keyHash).first();

  if (!result) {
    return c.json({ error: 'Invalid API key. Generate one via POST /api/keys' }, 401);
  }

  // Update last used timestamp
  await c.env.DB.prepare(
    'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key_hash = ?'
  ).bind(keyHash).run();

  c.set('userId', result.id);
  c.set('keyPrefix', result.key_prefix);
  await next();
};

// Simple SHA-256 hash for API keys
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'AWS Cost Anomaly Detector'
  });
});

// ============================================================================
// API KEY MANAGEMENT (Public - no auth required for key generation)
// ============================================================================

// Generate new API key
app.post('/api/keys', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    
    // Generate random API key (48 characters)
    const apiKey = 'sk-' + crypto.randomUUID().replace(/-/g, '') + 
                   crypto.randomUUID().replace(/-/g, '');
    const keyHash = await hashKey(apiKey);
    const keyPrefix = apiKey.substring(0, 8);

    await c.env.DB.prepare(`
      INSERT INTO api_keys (key_hash, key_prefix, name)
      VALUES (?, ?, ?)
    `).bind(keyHash, keyPrefix, body.name || 'Unnamed Key').run();

    // Return the key only once - cannot be retrieved later
    return c.json({
      success: true,
      apiKey,
      keyPrefix,
      warning: 'IMPORTANT: Save this API key securely. It cannot be retrieved later.',
      nextSteps: [
        '1. Store this API key in a secure location (password manager)',
        '2. Use it in the Authorization header: Bearer <your-api-key>',
        '3. Add your AWS credentials via POST /api/accounts'
      ]
    });
  } catch (error: any) {
    console.error('Error generating API key:', error);
    return c.json({ error: 'Failed to generate API key' }, 500);
  }
});

// ============================================================================
// PROTECTED ENDPOINTS (Require API key authentication)
// ============================================================================

// List API keys
app.get('/api/keys', authenticate, async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, key_prefix, name, is_active, created_at, last_used_at
      FROM api_keys
      ORDER BY created_at DESC
    `).all();

    return c.json({ keys: result.results || [] });
  } catch (error: any) {
    console.error('Error listing API keys:', error);
    return c.json({ error: 'Failed to list API keys' }, 500);
  }
});

// Revoke API key
app.delete('/api/keys/:id', authenticate, async (c) => {
  try {
    const keyId = parseInt(c.req.param('id'));

    await c.env.DB.prepare(
      'UPDATE api_keys SET is_active = 0 WHERE id = ?'
    ).bind(keyId).run();

    return c.json({ success: true, message: 'API key revoked' });
  } catch (error: any) {
    console.error('Error revoking API key:', error);
    return c.json({ error: 'Failed to revoke API key' }, 500);
  }
});

// ============================================================================
// DEMO DATA ENDPOINTS (No authentication required)
// ============================================================================

// Demo data generator
const demoServices = [
  { name: 'Amazon Elastic Compute Cloud', baseCost: 45, variance: 0.3 },
  { name: 'Amazon Relational Database Service', baseCost: 28, variance: 0.2 },
  { name: 'AWS Lambda', baseCost: 12, variance: 0.4 },
  { name: 'Amazon Simple Storage Service', baseCost: 8, variance: 0.15 },
  { name: 'Amazon CloudFront', baseCost: 6, variance: 0.25 },
  { name: 'Amazon DynamoDB', baseCost: 15, variance: 0.2 },
  { name: 'Elastic Load Balancing', baseCost: 10, variance: 0.1 },
  { name: 'Amazon Route 53', baseCost: 2, variance: 0.1 },
  { name: 'AWS CloudWatch', baseCost: 5, variance: 0.3 },
  { name: 'Amazon API Gateway', baseCost: 8, variance: 0.25 },
];

function randomCost(baseCost: number, variance: number): number {
  const multiplier = 1 + (Math.random() * variance * 2 - variance);
  return Math.round(baseCost * multiplier * 100) / 100;
}

// Seed demo data
app.post('/api/demo/seed', async (c) => {
  try {
    const accountId = 1; // Demo account ID

    // Clear existing demo data
    await c.env.DB.prepare('DELETE FROM daily_costs WHERE account_id = ?').bind(accountId).run();
    await c.env.DB.prepare('DELETE FROM daily_totals WHERE account_id = ?').bind(accountId).run();
    await c.env.DB.prepare('DELETE FROM anomalies WHERE account_id = ?').bind(accountId).run();
    await c.env.DB.prepare('DELETE FROM aws_accounts WHERE id = ?').bind(accountId).run();

    // Create demo account
    await c.env.DB.prepare(`
      INSERT INTO aws_accounts (id, account_name, aws_access_key_id, aws_secret_access_key, aws_region, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET account_name = excluded.account_name
    `).bind(accountId, 'Demo Account', 'DEMO_KEY', 'DEMO_SECRET', 'us-east-1').run();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    let totalRecords = 0;
    let totalCost = 0;

    // Generate 30 days of data
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const costDate = d.toISOString().split('T')[0];
      let dailyTotal = 0;

      for (const service of demoServices) {
        let cost = randomCost(service.baseCost, service.variance);

        // Add anomaly spike on day 5 ago (EC2 spike - 45% increase)
        const daysAgo = Math.floor((endDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo === 5 && service.name.includes('Compute')) {
          cost = cost * 1.45;
        }

        await c.env.DB.prepare(`
          INSERT INTO daily_costs (account_id, cost_date, service_name, cost_usd)
          VALUES (?, ?, ?, ?)
        `).bind(accountId, costDate, service.name, cost).run();

        dailyTotal += cost;
        totalRecords++;
      }

      // Weekend dip (30% lower costs)
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        dailyTotal *= 0.7;
      }

      await c.env.DB.prepare(`
        INSERT INTO daily_totals (account_id, cost_date, total_cost_usd, service_count)
        VALUES (?, ?, ?, ?)
      `).bind(accountId, costDate, dailyTotal, demoServices.length).run();

      totalCost += dailyTotal;
    }

    // Generate demo anomaly record
    const anomalyDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await c.env.DB.prepare(`
      INSERT INTO anomalies (account_id, cost_date, service_name, current_cost, previous_cost, spike_percentage, spike_type, threshold_percentage, is_alerted)
      VALUES (?, ?, ?, ?, ?, ?, 'dod', 20, 0)
    `).bind(accountId, anomalyDate, 'Amazon Elastic Compute Cloud', 65.25, 45.00, 45.0).run();

    return c.json({
      success: true,
      message: 'Demo data seeded successfully',
      recordsInserted: totalRecords,
      totalCostUsd: totalCost.toFixed(2),
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      demoAccount: {
        id: accountId,
        name: 'Demo Account',
      },
      features: {
        weekendDips: 'Costs are 30% lower on weekends',
        anomalySpike: '45% EC2 spike on day -5 for anomaly detection demo',
      },
      nextSteps: [
        '1. Generate an API key: POST /api/keys',
        '2. Open the dashboard and enter your API key',
        '3. View cost data, trends, and anomalies',
        '4. To use real AWS data: POST /api/accounts with your credentials'
      ]
    });

  } catch (error: any) {
    console.error('Error seeding demo data:', error);
    return c.json({
      error: 'Failed to seed demo data',
      details: error.message
    }, 500);
  }
});

// Get demo status
app.get('/api/demo/status', async (c) => {
  try {
    const demoAccount = await c.env.DB.prepare(`
      SELECT id, account_name FROM aws_accounts WHERE id = 1 AND aws_access_key_id = 'DEMO_KEY'
    `).first();

    const costCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM daily_costs WHERE account_id = 1
    `).first();

    const anomalyCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM anomalies WHERE account_id = 1
    `).first();

    return c.json({
      hasDemoData: (costCount?.count || 0) > 0,
      costRecordCount: costCount?.count || 0,
      anomalyCount: anomalyCount?.count || 0,
      hasDemoAccount: !!demoAccount,
      mode: demoAccount ? 'demo' : 'production',
      message: demoAccount
        ? `Demo mode: ${costCount?.count} cost records loaded`
        : 'Production mode: Add AWS credentials to fetch real data'
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Clear demo data
app.delete('/api/demo/clear', async (c) => {
  try {
    const accountId = 1;

    await c.env.DB.prepare('DELETE FROM daily_costs WHERE account_id = ?').bind(accountId).run();
    await c.env.DB.prepare('DELETE FROM daily_totals WHERE account_id = ?').bind(accountId).run();
    await c.env.DB.prepare('DELETE FROM anomalies WHERE account_id = ?').bind(accountId).run();
    await c.env.DB.prepare('DELETE FROM aws_accounts WHERE id = ?').bind(accountId).run();

    return c.json({
      success: true,
      message: 'Demo data cleared. You can now add real AWS credentials.'
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// AWS ACCOUNT MANAGEMENT
// ============================================================================

// Add AWS account
app.post('/api/accounts', authenticate, async (c) => {
  try {
    const body = await c.req.json();
    const { accountName, accessKeyId, secretAccessKey, region = 'us-east-1' } = body;

    // Validate required fields
    if (!accountName || !accessKeyId || !secretAccessKey) {
      return c.json({ error: 'Missing required fields: accountName, accessKeyId, secretAccessKey' }, 400);
    }

    // Validate AWS credentials format
    if (!accessKeyId.startsWith('AKIA')) {
      return c.json({ error: 'Invalid AWS Access Key ID format. Must start with AKIA' }, 400);
    }

    // Test AWS credentials by making a simple Cost Explorer call
    const awsClient = new AwsClient({
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      region: region || 'us-east-1',
      service: 'ce',
    });

    try {
      const testResponse = await awsClient.fetch('https://ce.us-east-1.amazonaws.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCostExplorerService.GetCostAndUsage',
        },
        body: JSON.stringify({
          TimePeriod: {
            Start: new Date().toISOString().split('T')[0],
            End: new Date().toISOString().split('T')[0],
          },
          Granularity: 'DAILY',
          Metrics: ['UnblendedCost'],
        }),
      });

      if (!testResponse.ok) {
        const errorData = await testResponse.text();
        return c.json({ 
          error: 'AWS credentials validation failed',
          details: errorData,
          hint: 'Ensure your IAM user has ce:GetCostAndUsage permission'
        }, 401);
      }
    } catch (awsError: any) {
      return c.json({ 
        error: 'Failed to connect to AWS Cost Explorer',
        details: awsError.message,
        hint: 'Check your AWS credentials and network connectivity'
      }, 401);
    }

    // Insert account (in production, encrypt credentials)
    const result = await c.env.DB.prepare(`
      INSERT INTO aws_accounts (account_name, aws_access_key_id, aws_secret_access_key, aws_region)
      VALUES (?, ?, ?, ?)
    `).bind(accountName, accessKeyId, secretAccessKey, region).run();

    return c.json({
      success: true,
      accountId: result.meta.last_row_id,
      message: 'AWS account added and verified successfully',
      nextSteps: [
        '1. Fetch cost data: POST /api/costs/fetch',
        '2. Detect anomalies: POST /api/anomalies/detect',
        '3. Configure alerts: POST /api/alerts/config'
      ]
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'Account name already exists' }, 409);
    }
    console.error('Error adding account:', error);
    return c.json({ error: 'Failed to add account: ' + error.message }, 500);
  }
});

// List all accounts
app.get('/api/accounts', authenticate, async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, account_name, aws_region, is_active, created_at
      FROM aws_accounts
      ORDER BY created_at DESC
    `).all();

    return c.json({ accounts: result.results || [] });
  } catch (error: any) {
    console.error('Error listing accounts:', error);
    return c.json({ error: 'Failed to list accounts' }, 500);
  }
});

// Delete/deactivate account
app.delete('/api/accounts/:id', authenticate, async (c) => {
  try {
    const accountId = parseInt(c.req.param('id'));
    
    await c.env.DB.prepare(
      'UPDATE aws_accounts SET is_active = 0 WHERE id = ?'
    ).bind(accountId).run();

    return c.json({ success: true, message: 'Account deactivated' });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    return c.json({ error: 'Failed to delete account' }, 500);
  }
});

// ============================================================================
// COST DATA ENDPOINTS
// ============================================================================

// Fetch costs from AWS Cost Explorer
app.post('/api/costs/fetch', authenticate, async (c) => {
  const userId = c.get('userId');
  
  try {
    // Get active AWS account
    const account = await c.env.DB.prepare(`
      SELECT * FROM aws_accounts WHERE is_active = 1 LIMIT 1
    `).first();

    if (!account) {
      return c.json({ 
        error: 'No AWS account configured',
        hint: 'Add your AWS credentials via POST /api/accounts'
      }, 400);
    }

    // Log job start
    const jobLog = await c.env.DB.prepare(`
      INSERT INTO job_logs (job_type, account_id, status)
      VALUES ('fetch_costs', ?, 'running')
    `).bind(account.id).run();

    // Initialize AWS client
    const awsClient = new AwsClient({
      accessKeyId: account.aws_access_key_id,
      secretAccessKey: account.aws_secret_access_key,
      region: account.aws_region || 'us-east-1',
      service: 'ce',
    });

    // Get last 30 days of cost data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const response = await awsClient.fetch('https://ce.us-east-1.amazonaws.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCostExplorerService.GetCostAndUsage',
      },
      body: JSON.stringify({
        TimePeriod: {
          Start: startDate.toISOString().split('T')[0],
          End: endDate.toISOString().split('T')[0],
        },
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost'],
        GroupBy: [
          { Type: 'DIMENSION', Key: 'SERVICE' },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AWS API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const resultsByTime = data.ResultsByTime || [];

    let totalRecords = 0;
    let totalCost = 0;

    // Process and store cost data
    for (const timeResult of resultsByTime) {
      const costDate = timeResult.TimePeriod?.Start;
      if (!costDate) continue;

      let dailyTotal = 0;
      const serviceCount = new Set();

      for (const group of timeResult.Groups || []) {
        const serviceName = group.Keys?.[0] || 'Unknown';
        const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');

        if (cost > 0) {
          await c.env.DB.prepare(`
            INSERT OR REPLACE INTO daily_costs 
            (account_id, cost_date, service_name, cost_usd)
            VALUES (?, ?, ?, ?)
          `).bind(account.id, costDate, serviceName, cost).run();

          dailyTotal += cost;
          serviceCount.add(serviceName);
          totalRecords++;
        }
      }

      totalCost += dailyTotal;

      // Update daily totals
      await c.env.DB.prepare(`
        INSERT INTO daily_totals (account_id, cost_date, total_cost_usd, service_count)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(account_id, cost_date) DO UPDATE SET
          total_cost_usd = excluded.total_cost_usd,
          service_count = excluded.service_count,
          updated_at = CURRENT_TIMESTAMP
      `).bind(account.id, costDate, dailyTotal, serviceCount.size).run();
    }

    // Update job log
    await c.env.DB.prepare(`
      UPDATE job_logs 
      SET status = 'success', records_processed = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(totalRecords, jobLog.meta.last_row_id).run();

    return c.json({
      success: true,
      recordsProcessed: totalRecords,
      totalCostUsd: totalCost.toFixed(2),
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      message: `Successfully fetched ${totalRecords} cost records from AWS Cost Explorer`
    });

  } catch (error: any) {
    console.error('Error fetching costs:', error);
    
    // Log failure
    await c.env.DB.prepare(`
      UPDATE job_logs 
      SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
      WHERE account_id = ? AND job_type = 'fetch_costs'
      ORDER BY started_at DESC LIMIT 1
    `).bind(error.message, userId).run();

    return c.json({ 
      error: 'Failed to fetch costs from AWS',
      details: error.message,
      hint: 'Verify your AWS credentials have Cost Explorer access'
    }, 500);
  }
});

// Get cost summary
app.get('/api/costs/summary', authenticate, async (c) => {
  try {
    const account = await c.env.DB.prepare(`
      SELECT id FROM aws_accounts WHERE is_active = 1 LIMIT 1
    `).first();

    if (!account) {
      return c.json({ 
        summary: { totalCost: 0, avgDailyCost: 0, maxDailyCost: 0, minDailyCost: 0, daysCount: 0 },
        topServices: [],
        message: 'No AWS account configured'
      });
    }

    const days = parseInt(c.req.query('days') || '30');

    const summary = await c.env.DB.prepare(`
      SELECT 
        SUM(total_cost_usd) as total_cost,
        AVG(total_cost_usd) as avg_daily_cost,
        MAX(total_cost_usd) as max_daily_cost,
        MIN(total_cost_usd) as min_daily_cost,
        COUNT(*) as days_count
      FROM daily_totals
      WHERE account_id = ?
        AND cost_date >= date('now', ?)
    `).bind(account.id, `-${days} days`).first();

    const topServices = await c.env.DB.prepare(`
      SELECT 
        service_name,
        SUM(cost_usd) as total_cost,
        COUNT(DISTINCT cost_date) as days_active
      FROM daily_costs
      WHERE account_id = ?
        AND cost_date >= date('now', ?)
      GROUP BY service_name
      ORDER BY total_cost DESC
      LIMIT 10
    `).bind(account.id, `-${days} days`).all();

    return c.json({
      summary: {
        totalCost: parseFloat(summary?.total_cost || 0),
        avgDailyCost: parseFloat(summary?.avg_daily_cost || 0),
        maxDailyCost: parseFloat(summary?.max_daily_cost || 0),
        minDailyCost: parseFloat(summary?.min_daily_cost || 0),
        daysCount: summary?.days_count || 0,
      },
      topServices: topServices.results || []
    });
  } catch (error: any) {
    console.error('Error getting cost summary:', error);
    return c.json({ error: 'Failed to get cost summary' }, 500);
  }
});

// Get daily cost trend
app.get('/api/costs/trend', authenticate, async (c) => {
  try {
    const account = await c.env.DB.prepare(`
      SELECT id FROM aws_accounts WHERE is_active = 1 LIMIT 1
    `).first();

    if (!account) {
      return c.json({ trend: [], message: 'No AWS account configured' });
    }

    const days = parseInt(c.req.query('days') || '30');

    const trend = await c.env.DB.prepare(`
      SELECT 
        cost_date,
        total_cost_usd,
        service_count
      FROM daily_totals
      WHERE account_id = ?
        AND cost_date >= date('now', ?)
      ORDER BY cost_date ASC
    `).bind(account.id, `-${days} days`).all();

    return c.json({ trend: trend.results || [] });
  } catch (error: any) {
    console.error('Error getting cost trend:', error);
    return c.json({ error: 'Failed to get cost trend' }, 500);
  }
});

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

// Detect anomalies (manual trigger)
app.post('/api/anomalies/detect', authenticate, async (c) => {
  const userId = c.get('userId');
  const threshold = parseFloat(c.req.query('threshold') || '20');

  try {
    const account = await c.env.DB.prepare(`
      SELECT id FROM aws_accounts WHERE is_active = 1 LIMIT 1
    `).first();

    if (!account) {
      return c.json({ error: 'No AWS account configured' }, 400);
    }

    // Log job start
    const jobLog = await c.env.DB.prepare(`
      INSERT INTO job_logs (job_type, account_id, status)
      VALUES ('detect_anomalies', ?, 'running')
    `).bind(account.id).run();

    const anomalies: any[] = [];

    // Get day-over-day anomalies
    const dodResults = await c.env.DB.prepare(`
      WITH cost_with_prev AS (
        SELECT 
          dc.account_id,
          dc.cost_date,
          dc.service_name,
          dc.cost_usd,
          LAG(dc.cost_usd, 1) OVER (
            PARTITION BY dc.service_name 
            ORDER BY dc.cost_date
          ) as prev_cost
        FROM daily_costs dc
        WHERE dc.account_id = ?
          AND dc.cost_date >= date('now', '-30 days')
      )
      SELECT * FROM cost_with_prev
      WHERE prev_cost > 0 AND prev_cost IS NOT NULL
        AND ((cost_usd - prev_cost) / prev_cost * 100) > ?
      ORDER BY cost_date DESC
    `).bind(account.id, threshold).all();

    // Process day-over-day anomalies
    for (const row of dodResults.results || []) {
      const spikePercentage = ((row.cost_usd - row.prev_cost) / row.prev_cost) * 100;
      
      // Check if already detected
      const exists = await c.env.DB.prepare(`
        SELECT id FROM anomalies 
        WHERE account_id = ? AND cost_date = ? AND service_name = ? AND spike_type = 'dod'
      `).bind(account.id, row.cost_date, row.service_name).first();

      if (!exists) {
        await c.env.DB.prepare(`
          INSERT INTO anomalies 
          (account_id, cost_date, service_name, current_cost, previous_cost, 
           spike_percentage, spike_type, threshold_percentage)
          VALUES (?, ?, ?, ?, ?, ?, 'dod', ?)
        `).bind(
          account.id, row.cost_date, row.service_name, 
          row.cost_usd, row.prev_cost, spikePercentage, threshold
        ).run();

        anomalies.push({
          service: row.service_name,
          date: row.cost_date,
          currentCost: row.cost_usd,
          previousCost: row.prev_cost,
          spikePercentage: spikePercentage.toFixed(2),
          type: 'day-over-day'
        });
      }
    }

    // Get week-over-week anomalies
    const wowResults = await c.env.DB.prepare(`
      WITH cost_with_prev AS (
        SELECT 
          dc.account_id,
          dc.cost_date,
          dc.service_name,
          dc.cost_usd,
          LAG(dc.cost_usd, 7) OVER (
            PARTITION BY dc.service_name 
            ORDER BY dc.cost_date
          ) as prev_cost
        FROM daily_costs dc
        WHERE dc.account_id = ?
          AND dc.cost_date >= date('now', '-30 days')
      )
      SELECT * FROM cost_with_prev
      WHERE prev_cost > 0 AND prev_cost IS NOT NULL
        AND ((cost_usd - prev_cost) / prev_cost * 100) > ?
      ORDER BY cost_date DESC
    `).bind(account.id, threshold).all();

    // Process week-over-week anomalies
    for (const row of wowResults.results || []) {
      const spikePercentage = ((row.cost_usd - row.prev_cost) / row.prev_cost) * 100;
      
      // Check if already detected
      const exists = await c.env.DB.prepare(`
        SELECT id FROM anomalies 
        WHERE account_id = ? AND cost_date = ? AND service_name = ? AND spike_type = 'wow'
      `).bind(account.id, row.cost_date, row.service_name).first();

      if (!exists) {
        await c.env.DB.prepare(`
          INSERT INTO anomalies 
          (account_id, cost_date, service_name, current_cost, previous_cost, 
           spike_percentage, spike_type, threshold_percentage)
          VALUES (?, ?, ?, ?, ?, ?, 'wow', ?)
        `).bind(
          account.id, row.cost_date, row.service_name, 
          row.cost_usd, row.prev_cost, spikePercentage, threshold
        ).run();

        anomalies.push({
          service: row.service_name,
          date: row.cost_date,
          currentCost: row.cost_usd,
          previousCost: row.prev_cost,
          spikePercentage: spikePercentage.toFixed(2),
          type: 'week-over-week'
        });
      }
    }

    // Update job log
    await c.env.DB.prepare(`
      UPDATE job_logs 
      SET status = 'success', records_processed = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(anomalies.length, jobLog.meta.last_row_id).run();

    return c.json({
      success: true,
      anomaliesDetected: anomalies.length,
      anomalies: anomalies,
      message: anomalies.length > 0 
        ? `Found ${anomalies.length} cost anomalies exceeding ${threshold}% threshold`
        : `No anomalies found exceeding ${threshold}% threshold`
    });

  } catch (error: any) {
    console.error('Error detecting anomalies:', error);
    return c.json({ error: `Failed to detect anomalies: ${error.message}` }, 500);
  }
});

// Get detected anomalies
app.get('/api/anomalies', authenticate, async (c) => {
  try {
    const account = await c.env.DB.prepare(`
      SELECT id FROM aws_accounts WHERE is_active = 1 LIMIT 1
    `).first();

    if (!account) {
      return c.json({ anomalies: [], message: 'No AWS account configured' });
    }

    const days = parseInt(c.req.query('days') || '7');
    const onlyUnalerted = c.req.query('unalerted') === 'true';

    let query = `
      SELECT 
        a.id,
        a.cost_date,
        a.service_name,
        a.current_cost,
        a.previous_cost,
        a.spike_percentage,
        a.spike_type,
        a.is_alerted,
        a.alerted_at,
        a.created_at
      FROM anomalies a
      WHERE a.account_id = ?
        AND a.cost_date >= date('now', ?)
    `;

    const params: any[] = [account.id, `-${days} days`];

    if (onlyUnalerted) {
      query += ' AND a.is_alerted = 0';
    }

    query += ' ORDER BY a.spike_percentage DESC, a.cost_date DESC';

    const result = await c.env.DB.prepare(query).bind(...params).all();

    return c.json({ anomalies: result.results || [] });
  } catch (error: any) {
    console.error('Error getting anomalies:', error);
    return c.json({ error: 'Failed to get anomalies' }, 500);
  }
});

// ============================================================================
// ALERTS
// ============================================================================

// Configure alert destination
app.post('/api/alerts/config', authenticate, async (c) => {
  try {
    const userId = c.get('userId');
    const { alertType, destination, minAlertAmount = 0 } = await c.req.json();

    if (!alertType || !destination) {
      return c.json({ error: 'Missing required fields: alertType, destination' }, 400);
    }

    if (!['email', 'slack'].includes(alertType)) {
      return c.json({ error: 'Invalid alert type. Must be "email" or "slack"' }, 400);
    }

    // Get account ID
    const account = await c.env.DB.prepare(`
      SELECT id FROM aws_accounts WHERE is_active = 1 LIMIT 1
    `).first();

    if (!account) {
      return c.json({ error: 'No AWS account configured' }, 400);
    }

    await c.env.DB.prepare(`
      INSERT INTO alert_config (account_id, alert_type, destination, min_alert_amount)
      VALUES (?, ?, ?, ?)
    `).bind(account.id, alertType, destination, minAlertAmount).run();

    return c.json({ 
      success: true, 
      message: 'Alert configuration saved',
      config: { alertType, destination, minAlertAmount }
    });
  } catch (error: any) {
    console.error('Error saving alert config:', error);
    return c.json({ error: 'Failed to save alert configuration' }, 500);
  }
});

// Send alerts for unalerted anomalies
app.post('/api/alerts/send', authenticate, async (c) => {
  const userId = c.get('userId');

  try {
    const account = await c.env.DB.prepare(`
      SELECT id FROM aws_accounts WHERE is_active = 1 LIMIT 1
    `).first();

    if (!account) {
      return c.json({ error: 'No AWS account configured' }, 400);
    }

    // Log job start
    const jobLog = await c.env.DB.prepare(`
      INSERT INTO job_logs (job_type, account_id, status)
      VALUES ('send_alerts', ?, 'running')
    `).bind(account.id).run();

    // Get unalerted anomalies
    const anomalies = await c.env.DB.prepare(`
      SELECT * FROM anomalies
      WHERE account_id = ? AND is_alerted = 0
      ORDER BY spike_percentage DESC
    `).bind(account.id).all();

    // Get alert configurations
    const alertConfigs = await c.env.DB.prepare(`
      SELECT * FROM alert_config WHERE account_id = ? AND is_active = 1
    `).bind(account.id).all();

    let alertsSent = 0;

    for (const anomaly of anomalies.results || []) {
      for (const config of alertConfigs.results || []) {
        if (anomaly.current_cost < (config.min_alert_amount || 0)) {
          continue; // Skip if below minimum threshold
        }

        const message = formatAlertMessage(anomaly, config.alert_type);

        if (config.alert_type === 'slack' && c.env.SLACK_WEBHOOK_URL) {
          await sendSlackAlert(c.env.SLACK_WEBHOOK_URL, message);
          alertsSent++;
        } else if (config.alert_type === 'email' && c.env.SENDGRID_API_KEY && c.env.FROM_EMAIL) {
          await sendEmailAlert(
            c.env.SENDGRID_API_KEY,
            c.env.FROM_EMAIL,
            config.destination,
            anomaly
          );
          alertsSent++;
        }
      }

      // Mark as alerted
      await c.env.DB.prepare(`
        UPDATE anomalies 
        SET is_alerted = 1, alerted_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(anomaly.id).run();
    }

    // Update job log
    await c.env.DB.prepare(`
      UPDATE job_logs 
      SET status = 'success', records_processed = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(alertsSent, jobLog.meta.last_row_id).run();

    return c.json({
      success: true,
      alertsSent,
      message: alertsSent > 0 
        ? `Successfully sent ${alertsSent} alerts`
        : 'No unalerted anomalies to send'
    });

  } catch (error: any) {
    console.error('Error sending alerts:', error);
    return c.json({ error: `Failed to send alerts: ${error.message}` }, 500);
  }
});

// Format alert message
function formatAlertMessage(anomaly: any, alertType: string): string {
  const emoji = alertType === 'slack' ? '🚨' : '';
  
  return `${emoji} *Cost Anomaly Detected* ${emoji}

*Service:* ${anomaly.service_name}
*Date:* ${anomaly.cost_date}
*Current Cost:* $${anomaly.current_cost.toFixed(2)}
*Previous Cost:* $${anomaly.previous_cost.toFixed(2)}
*Spike:* ${anomaly.spike_percentage.toFixed(1)}% (${anomaly.spike_type === 'dod' ? 'Day-over-Day' : 'Week-over-Week'})

Please review your AWS console for this service.`;
}

// Send Slack alert
async function sendSlackAlert(webhookUrl: string, message: string) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status}`);
  }
}

// Send email alert via SendGrid
async function sendEmailAlert(
  apiKey: string,
  fromEmail: string,
  toEmail: string,
  anomaly: any
) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail },
      subject: `🚨 AWS Cost Anomaly: ${anomaly.service_name} (+${anomaly.spike_percentage.toFixed(1)}%)`,
      content: [{
        type: 'text/plain',
        value: formatAlertMessage(anomaly, 'email'),
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`SendGrid API failed: ${response.status}`);
  }
}

// ============================================================================
// SCHEDULED JOB (Daily cost fetch + anomaly detection)
// ============================================================================

// This endpoint is called by Cloudflare Cron Trigger
app.post('/api/jobs/daily', async (c) => {
  // Verify cron secret if configured
  const cronSecret = c.req.header('X-Cron-Secret');
  if (cronSecret && c.env.CRON_SECRET && cronSecret !== c.env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const accounts = await c.env.DB.prepare(`
      SELECT id FROM aws_accounts WHERE is_active = 1
    `).all();

    const results = [];

    for (const account of accounts.results || []) {
      // Fetch costs
      const fetchResult = await fetchCostsForAccount(c, account.id);
      
      // Detect anomalies
      const anomalyResult = await detectAnomaliesForAccount(c, account.id);
      
      // Send alerts
      const alertResult = await sendAlertsForAccount(c, account.id);

      results.push({
        accountId: account.id,
        costsFetched: fetchResult,
        anomaliesDetected: anomalyResult,
        alertsSent: alertResult,
      });
    }

    return c.json({ 
      success: true, 
      results,
      message: `Processed ${results.length} accounts`
    });

  } catch (error: any) {
    console.error('Error in daily job:', error);
    return c.json({ error: `Daily job failed: ${error.message}` }, 500);
  }
});

// Helper functions for scheduled job
async function fetchCostsForAccount(c: any, accountId: number) {
  try {
    const account = await c.env.DB.prepare(`
      SELECT * FROM aws_accounts WHERE id = ? AND is_active = 1
    `).bind(accountId).first();

    if (!account) return { success: false, error: 'Account not found' };

    const awsClient = new AwsClient({
      accessKeyId: account.aws_access_key_id,
      secretAccessKey: account.aws_secret_access_key,
      region: account.aws_region || 'us-east-1',
      service: 'ce',
    });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const response = await awsClient.fetch('https://ce.us-east-1.amazonaws.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCostExplorerService.GetCostAndUsage',
      },
      body: JSON.stringify({
        TimePeriod: {
          Start: startDate.toISOString().split('T')[0],
          End: endDate.toISOString().split('T')[0],
        },
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      }),
    });

    if (!response.ok) throw new Error(`AWS API error: ${response.status}`);

    const data = await response.json();
    let totalRecords = 0;
    let totalCost = 0;

    for (const timeResult of data.ResultsByTime || []) {
      const costDate = timeResult.TimePeriod?.Start;
      if (!costDate) continue;

      let dailyTotal = 0;
      const serviceCount = new Set();

      for (const group of timeResult.Groups || []) {
        const serviceName = group.Keys?.[0] || 'Unknown';
        const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');

        if (cost > 0) {
          await c.env.DB.prepare(`
            INSERT OR REPLACE INTO daily_costs 
            (account_id, cost_date, service_name, cost_usd)
            VALUES (?, ?, ?, ?)
          `).bind(accountId, costDate, serviceName, cost).run();

          dailyTotal += cost;
          serviceCount.add(serviceName);
          totalRecords++;
        }
      }

      totalCost += dailyTotal;

      await c.env.DB.prepare(`
        INSERT INTO daily_totals (account_id, cost_date, total_cost_usd, service_count)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(account_id, cost_date) DO UPDATE SET
          total_cost_usd = excluded.total_cost_usd,
          service_count = excluded.service_count,
          updated_at = CURRENT_TIMESTAMP
      `).bind(accountId, costDate, dailyTotal, serviceCount.size).run();
    }

    return { success: true, recordsProcessed: totalRecords, totalCostUsd: totalCost.toFixed(2) };
  } catch (error: any) {
    console.error(`Error fetching costs for account ${accountId}:`, error);
    return { success: false, error: error.message };
  }
}

async function detectAnomaliesForAccount(c: any, accountId: number) {
  try {
    const threshold = 20;
    let anomaliesCount = 0;

    const dodResults = await c.env.DB.prepare(`
      WITH cost_with_prev AS (
        SELECT 
          dc.account_id, dc.cost_date, dc.service_name, dc.cost_usd,
          LAG(dc.cost_usd, 1) OVER (PARTITION BY dc.service_name ORDER BY dc.cost_date) as prev_cost
        FROM daily_costs dc
        WHERE dc.account_id = ? AND dc.cost_date >= date('now', '-30 days')
      )
      SELECT * FROM cost_with_prev
      WHERE prev_cost > 0 AND prev_cost IS NOT NULL 
        AND ((cost_usd - prev_cost) / prev_cost * 100) > ?
    `).bind(accountId, threshold).all();

    for (const row of dodResults.results || []) {
      const spikePercentage = ((row.cost_usd - row.prev_cost) / row.prev_cost) * 100;
      
      const exists = await c.env.DB.prepare(`
        SELECT id FROM anomalies 
        WHERE account_id = ? AND cost_date = ? AND service_name = ? AND spike_type = 'dod'
      `).bind(accountId, row.cost_date, row.service_name).first();

      if (!exists) {
        await c.env.DB.prepare(`
          INSERT INTO anomalies 
          (account_id, cost_date, service_name, current_cost, previous_cost, 
           spike_percentage, spike_type, threshold_percentage)
          VALUES (?, ?, ?, ?, ?, ?, 'dod', ?)
        `).bind(accountId, row.cost_date, row.service_name, row.cost_usd, row.prev_cost, spikePercentage, threshold).run();
        
        anomaliesCount++;
      }
    }

    return { success: true, anomaliesDetected: anomaliesCount };
  } catch (error: any) {
    console.error(`Error detecting anomalies for account ${accountId}:`, error);
    return { success: false, error: error.message };
  }
}

async function sendAlertsForAccount(c: any, accountId: number) {
  try {
    const anomalies = await c.env.DB.prepare(`
      SELECT * FROM anomalies WHERE account_id = ? AND is_alerted = 0
    `).bind(accountId).all();

    const alertConfigs = await c.env.DB.prepare(`
      SELECT * FROM alert_config WHERE account_id = ? AND is_active = 1
    `).bind(accountId).all();

    let alertsSent = 0;

    for (const anomaly of anomalies.results || []) {
      for (const config of alertConfigs.results || []) {
        if (anomaly.current_cost < (config.min_alert_amount || 0)) continue;

        const message = formatAlertMessage(anomaly, config.alert_type);

        if (config.alert_type === 'slack' && c.env.SLACK_WEBHOOK_URL) {
          await sendSlackAlert(c.env.SLACK_WEBHOOK_URL, message);
          alertsSent++;
        } else if (config.alert_type === 'email' && c.env.SENDGRID_API_KEY && c.env.FROM_EMAIL) {
          await sendEmailAlert(c.env.SENDGRID_API_KEY, c.env.FROM_EMAIL, config.destination, anomaly);
          alertsSent++;
        }
      }

      await c.env.DB.prepare(`
        UPDATE anomalies SET is_alerted = 1, alerted_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(anomaly.id).run();
    }

    return { success: true, alertsSent };
  } catch (error: any) {
    console.error(`Error sending alerts for account ${accountId}:`, error);
    return { success: false, error: error.message };
  }
}

// Export Hono app for Cloudflare Workers
export default app;
