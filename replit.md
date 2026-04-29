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

## API Endpoints (local dev — serve.js)
- `POST /api/contact` — Contact/access request form. Validates name + email, saves to `data/contacts.json`
- `POST /api/subscribe` — Waitlist email capture. Deduplicates by email, saves to `data/subscribers.json`

## Cloudflare Pages Functions (deployed)
- `functions/api/contact.js` — Sends email via CF Email Routing (`SEND_EMAIL` binding), stores in D1
- `functions/api/subscribe.js` — Waitlist signup, KV dedup (`WAITLIST_KV` binding), email notify, D1 store

## DNS / Redirect
- `_redirects` — Redirects `banproof.me/*` → `https://www.banproof.me/:splat` (Cloudflare Pages)
- `serve.js` — Also enforces www redirect locally when `Host: banproof.me`

## Deployment
The backend workers run on Cloudflare's edge infrastructure and are deployed via Wrangler (`wrangler deploy`). The frontend is served as Cloudflare Pages.

## Key Features
- AI gateway with Proof of Agency scoring
- Residential DePIN node network (94 nodes)
- Multi-tier subscription model (Free, Pro, Agency)
- Sentiment analysis, odds aggregation, risk assessment signal engines
- Cloudflare Turnstile for bot protection
