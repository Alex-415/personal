-- AWS Cost Anomaly Detector - D1 Database Schema
-- Cloudflare D1 uses SQLite syntax

-- Stores AWS account configurations
CREATE TABLE IF NOT EXISTS aws_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT NOT NULL UNIQUE,
    aws_access_key_id TEXT NOT NULL,
    aws_secret_access_key TEXT NOT NULL,
    aws_region TEXT DEFAULT 'us-east-1',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily cost data by service
CREATE TABLE IF NOT EXISTS daily_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    cost_date DATE NOT NULL,
    service_name TEXT NOT NULL,
    usage_type TEXT,
    cost_usd REAL NOT NULL DEFAULT 0,
    usage_quantity REAL,
    usage_unit TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES aws_accounts(id),
    UNIQUE(account_id, cost_date, service_name, usage_type)
);

-- Aggregated daily totals (for quick dashboard queries)
CREATE TABLE IF NOT EXISTS daily_totals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    cost_date DATE NOT NULL UNIQUE(account_id, cost_date),
    total_cost_usd REAL NOT NULL DEFAULT 0,
    service_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES aws_accounts(id)
);

-- Anomaly detection results
CREATE TABLE IF NOT EXISTS anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    cost_date DATE NOT NULL,
    service_name TEXT NOT NULL,
    current_cost REAL NOT NULL,
    previous_cost REAL NOT NULL,
    spike_percentage REAL NOT NULL,
    spike_type TEXT NOT NULL, -- 'dod' (day-over-day) or 'wow' (week-over-week)
    threshold_percentage REAL NOT NULL DEFAULT 20.0,
    is_alerted INTEGER DEFAULT 0,
    alerted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES aws_accounts(id)
);

-- Alert configuration
CREATE TABLE IF NOT EXISTS alert_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    alert_type TEXT NOT NULL, -- 'email' or 'slack'
    destination TEXT NOT NULL, -- email address or Slack webhook URL
    is_active INTEGER DEFAULT 1,
    min_alert_amount REAL DEFAULT 0, -- minimum cost to trigger alert
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES aws_accounts(id)
);

-- API keys for dashboard access
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL, -- first 8 chars for identification
    name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME
);

-- Job execution log (for monitoring scheduled runs)
CREATE TABLE IF NOT EXISTS job_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL, -- 'fetch_costs', 'detect_anomalies', 'send_alerts'
    account_id INTEGER,
    status TEXT NOT NULL, -- 'success', 'failed', 'partial'
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (account_id) REFERENCES aws_accounts(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_daily_costs_account_date ON daily_costs(account_id, cost_date);
CREATE INDEX IF NOT EXISTS idx_daily_costs_service ON daily_costs(service_name);
CREATE INDEX IF NOT EXISTS idx_daily_totals_account_date ON daily_totals(account_id, cost_date);
CREATE INDEX IF NOT EXISTS idx_anomalies_account_date ON anomalies(account_id, cost_date);
CREATE INDEX IF NOT EXISTS idx_anomalies_alerted ON anomalies(is_alerted);
CREATE INDEX IF NOT EXISTS idx_job_logs_status ON job_logs(status);
