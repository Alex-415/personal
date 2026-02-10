// API route: /api/analyze
// This accepts AWS config text and returns AI-assisted analysis
// NOTE: This is a MOCK implementation. In production, you would call an actual LLM API.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { config } = req.body;

  if (!config || typeof config !== 'string') {
    return res.status(400).json({ error: 'Invalid config provided' });
  }

  // MOCK ANALYSIS - Replace with actual LLM API call
  // In production: call OpenAI/Anthropic with carefully crafted system prompt
  const analysis = analyzeMock(config);

  return res.status(200).json(analysis);
}

// MOCK analyzer - simulates LLM response
// Replace this with actual LLM API integration
function analyzeMock(config) {
  const risks = [];
  const suggestions = [];
  let summary = 'This configuration ';

  // Check for wildcard permissions
  if (config.includes('"*"') || config.includes("'*'")) {
    if (config.toLowerCase().includes('action') && config.toLowerCase().includes('resource')) {
      risks.push({
        severity: 'high',
        description: 'Wildcard (*) permissions detected on both Action and Resource. This grants unrestricted access and is commonly discouraged.'
      });
      suggestions.push('Replace wildcard permissions with specific, least-privilege actions and resources');
      summary += 'grants broad wildcard permissions, ';
    }
  }

  // Check for public access indicators
  if (config.toLowerCase().includes('public') || config.includes('0.0.0.0/0')) {
    risks.push({
      severity: 'medium',
      description: 'Public access or open CIDR range (0.0.0.0/0) detected. This may expose resources publicly.'
    });
    suggestions.push('Restrict access to specific IP ranges or private networks');
    summary += 'may allow public access, ';
  }

  // Check for hardcoded secrets
  if (/secret|password|key|token/i.test(config) && /[A-Za-z0-9+/=]{20,}/.test(config)) {
    risks.push({
      severity: 'high',
      description: 'Possible hardcoded secret or credential detected. Hardcoded secrets are a security risk.'
    });
    suggestions.push('Use AWS Secrets Manager or environment variables instead of hardcoded credentials');
  }

  if (risks.length === 0) {
    summary = 'This configuration appears to follow common security practices. No obvious risks detected.';
  } else {
    summary = summary.slice(0, -2) + '. Review recommended.';
  }

  return {
    summary,
    risks,
    suggestions,
    disclaimer: 'This is an AI-assisted review for educational purposes. It does not guarantee security, compliance, or correctness.'
  };
}
