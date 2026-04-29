# Banproof — AI Gateway

## Project Overview
**banproof.me** is a static landing page for a multi-service AI gateway platform built on the Cloudflare ecosystem. The frontend is a polished static HTML/CSS/JS site served from the `public/` directory.

## Tech Stack
- **Frontend**: Static HTML, CSS, JavaScript (in `public/`)
- **Backend** (Cloudflare, not run locally): Cloudflare Workers (Hono framework), D1, KV, R2, Cloudflare AI
- **Package Manager**: pnpm (monorepo with workspaces)
- **Language**: TypeScript (backend workers)

## Project Structure
```
public/           # Static frontend (HTML, CSS, JS)
  index.html      # Main landing page
  banproof.css    # Styles
  banproof.js     # Client-side JS
  admin/          # Admin panel
  cloudflare-dashboard/  # Cloudflare dashboard UI
gateway/          # Cloudflare Worker — API gateway (Hono)
worker/           # Cloudflare Worker — ingress/egress
apps/             # Core engine logic (Cloudflare Workflows)
packages/         # Shared libraries (database, identity)
functions/        # Cloudflare Pages Functions
```

## Running Locally
The static frontend is served via a Node.js HTTP server:
```
node serve.js
```
This serves the `public/` directory on port 5000.

## Deployment
The backend workers run on Cloudflare's edge infrastructure and are deployed via Wrangler (`wrangler deploy`). The frontend is served as Cloudflare Pages.

## Key Features
- AI gateway with Proof of Agency scoring
- Residential DePIN node network (94 nodes)
- Multi-tier subscription model (Free, Pro, Agency)
- Sentiment analysis, odds aggregation, risk assessment signal engines
- Cloudflare Turnstile for bot protection
