# Personal Portfolio Website


## Features

- Responsive design (mobile, tablet, desktop)
- Smooth animations
- Mobile hamburger menu
- Fast loading

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Inter font

## Local Development

Open `personal-website/index.html` in your browser.

## Deployment





## Structure

```
personal-website/
├── index.html              # Main HTML file
├── projects.html           # Projects page
├── network-scanner.html    # Network Inspection Platform
├── ai-scanner.html         # AI Cloud Config Risk Scanner
├── seo-scanner.html        # AI SEO Snapshot Scanner
├── doc-scanner.html        # Document Scanner
├── qr-generator.html       # QR Code Generator
├── css/
│   └── style.css          # All styles
├── js/
│   └── script.js          # Navigation and animations
└── images/
    └── profile-placeholder.svg
```

## Projects

### Network Inspection Platform
Production-grade TCP port scanner with async Python backend. Features concurrent scanning with semaphore-based rate limiting, SSRF protection, DNS validation, and structured logging. Clean architecture suitable for telecom-grade review.

Built with Python 3.11, asyncio, FastAPI, deployed on Render.com

### AI Cloud Config Risk Scanner
Scans AWS configs for security issues. Catches wildcard permissions, public access, hardcoded secrets, and open CIDR ranges. Returns severity-ranked risks with fix recommendations.

Built with JavaScript, HTML5, CSS3

### AI SEO Snapshot Scanner
Analyzes on-page SEO from any URL. Pulls title tags, meta descriptions, H1s, and image alt text. Flags issues and suggests quick wins.

Built with JavaScript, HTML5, CSS3

### Document Scanner
Turns photos into scanned PDFs. Supports color, grayscale, and B&W modes. Adjust brightness, contrast, quality. Drag to reorder pages, rotate images, pick page size (A4, Letter, Legal).

Built with JavaScript, Canvas API, jsPDF

### QR Code Generator
Makes QR codes from text or URLs. Pick size and colors. Download as PNG or SVG. Live preview.

Built with JavaScript, QRCode.js, Canvas API

## License

© 2024 Al A. All rights reserved.