# Personal Portfolio Website

Modern, minimalist portfolio website for a Cloud-Native Developer.

## Features

- Clean, professional design inspired by modern tech companies
- Fully responsive (mobile, tablet, desktop)
- Smooth animations and interactions
- Mobile hamburger navigation
- Fast loading and optimized performance

## Tech Stack

- HTML5
- CSS3 (Custom, no frameworks)
- Vanilla JavaScript
- Inter font family

## Local Development

Simply open `personal-website/index.html` in your browser.

## Deployment

### Netlify (Recommended)
1. Push to GitHub
2. Connect repository to Netlify
3. Deploy automatically

### Manual Deploy
Drag the `personal-website` folder to any static hosting service.

## Structure

```
personal-website/
├── index.html              # Main HTML file
├── projects.html           # Projects page
├── ai-scanner.html         # AI Cloud Config Risk Scanner
├── seo-scanner.html        # AI SEO Snapshot Scanner
├── css/
│   └── style.css          # All styles
├── js/
│   └── script.js          # Navigation and animations
└── images/
    └── profile-placeholder.svg
```

## Projects

### AI-Assisted Cloud Config Risk Scanner
- Analyzes AWS configurations (IAM policies, S3, Terraform, CloudFormation)
- Detects wildcard permissions, public access, hardcoded secrets
- Provides severity-ranked security risks and recommendations
- Tech: React, Node.js, LLM Integration

### AI-Assisted SEO Snapshot Scanner
- Analyzes on-page SEO signals from a single URL
- Extracts title tags, meta descriptions, H1 tags, image alt text
- Uses LLM to interpret findings and prioritize fixes
- Tech: React, Node.js, Cheerio

## License

© 2024 Al A. All rights reserved.
