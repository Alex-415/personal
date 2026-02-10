# AI-Assisted Cloud Config Risk Scanner

A simple web app that analyzes AWS configuration text using AI to identify common security risks.

## What It Does

- Accepts pasted AWS configuration text (IAM policies, S3 configs, Terraform, CloudFormation)
- Summarizes what the config does in plain English
- Flags obvious, common risk patterns
- Suggests high-level safer alternatives

## What It Does NOT Do

- ❌ Does NOT scan live AWS accounts
- ❌ Does NOT claim compliance or security certification
- ❌ Does NOT guarantee correctness
- ❌ Does NOT replace professional security audits
- ❌ Does NOT authenticate users or store data

## Why AI Is Used Here

AI helps translate complex configuration syntax into plain English and identify patterns that commonly indicate security risks. This is appropriate for:
- Educational purposes
- Initial review before deeper analysis
- Learning about common AWS security patterns

This is NOT appropriate for:
- Production security audits
- Compliance certification
- Critical infrastructure decisions

## Limitations

- **Not a security guarantee**: This tool provides suggestions, not guarantees
- **Pattern-based only**: Flags well-known risks like `*:*` permissions, public access, hardcoded secrets
- **No context awareness**: Cannot understand your specific use case or requirements
- **Educational tool**: Designed for learning, not production security

## Tech Stack

- **Frontend**: React (Next.js)
- **Backend**: Next.js API routes
- **AI**: Mock implementation (replace with OpenAI/Anthropic API)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Deploy to Netlify

1. Push to GitHub
2. Connect repository to Netlify
3. Netlify will auto-detect Next.js and deploy
4. Build settings (auto-configured via netlify.toml):
   - Build command: `npm run build`
   - Publish directory: `.next`

## Integrating Real LLM

The current implementation uses a MOCK analyzer. To integrate a real LLM:

1. Install OpenAI SDK: `npm install openai`

2. Replace the mock in `pages/api/analyze.js`:

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  const { config } = req.body;
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are analyzing AWS configurations for common security risks.
        
Rules:
- Flag only well-known, obvious risks (wildcards, public access, hardcoded secrets)
- Use cautious language: "may be risky", "worth reviewing"
- Do NOT claim certainty or invent vulnerabilities
- Respond in JSON format with: summary, risks[], suggestions[], disclaimer`
      },
      {
        role: "user",
        content: config
      }
    ],
    response_format: { type: "json_object" }
  });
  
  return res.json(JSON.parse(completion.choices[0].message.content));
}
```

3. Add `.env.local`:
```
OPENAI_API_KEY=your_key_here
```

## Example Test Input

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "*",
    "Resource": "*"
  }]
}
```

Expected output: High severity warning about wildcard permissions.

## License

Educational use only. No warranty provided.
