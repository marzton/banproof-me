# Gold Shore Labs — Complete Remediation Runbook
# Generated: 2026-04-19 — Based on live CF dashboard state

# ══════════════════════════════════════════════════════════════
# PRIORITY 1 — CF ACCESS SECURITY FIX (CRITICAL)
# ══════════════════════════════════════════════════════════════
# PROBLEM: "Require Login" policy = non_identity + everyone = NO REAL AUTH
# Anyone who hits admin.goldshore.ai and any other CF Access app gets in.
#
# FIX — Zero Trust → Access → Policies → "Require Login" → Edit:
#   Change from:
#     Rule type: non_identity
#     Include: everyone
#   Change to:
#     Rule type: identity (not non_identity)
#     Include: Emails ending in: @goldshore.ai
#     Include: Specific email: marstonr6@gmail.com
#     Auth method: Google GoldShore Workspace OR GitHub
#
# Also: Create a REUSABLE policy to replace the 8 legacy non-reusable ones:
#   Name: "GoldShore Team Access"
#   Include: Email domain = goldshore.ai
#   Include: Specific emails: marstonr6@gmail.com
#   Require: Identity provider = Google GoldShore Workspace

# ══════════════════════════════════════════════════════════════
# PRIORITY 2 — DELETE STALE CF ACCESS APPLICATIONS
# ══════════════════════════════════════════════════════════════
# DELETE these (keep: goldshore-admin Pages, gs-web Pages, SSO App):
#   - gs-mail Workers (x2 — gs-mail.goldshore.workers.dev + *-gs-mail)
#   - gs-platform Workers (x2)
#   - gs-api Workers (x2)
#   - goldshore-core Workers (x2)
#   - gs-agent Workers (x2 — keep one if you want agent protected)
#   - banproof-me Workers (x2 — public site, shouldn't be CF Access protected)
#   - goldshore-monorepo Pages (x1 — separate account, not needed here)
#
# Path: Zero Trust → Access → Applications → Delete

# ══════════════════════════════════════════════════════════════
# PRIORITY 3 — CUSTOM DOMAINS ON WORKERS
# ══════════════════════════════════════════════════════════════
# These workers are running but have NO custom domain attached:

## api.goldshore.ai → gs-api Worker
# Dashboard: Workers & Pages → gs-api → Settings → Domains & Routes → Add Custom Domain
#   Domain: api.goldshore.ai
# OR add route: api.goldshore.ai/* in zone goldshore.ai

## gw.goldshore.ai → gs-platform Worker  
# Dashboard: Workers & Pages → gs-platform → Settings → Domains & Routes → Add Custom Domain
#   Domain: gw.goldshore.ai
# NOTE: gs-gateway Pages project is pointing at gs-admin.pages.dev — WRONG NAME
#       gs-platform is the ACTUAL gateway worker. Route gw.goldshore.ai to gs-platform.

## agent.goldshore.ai → gs-agent Worker
# Dashboard: Workers & Pages → gs-agent → Settings → Domains & Routes → Add Custom Domain
#   Domain: agent.goldshore.ai

# ══════════════════════════════════════════════════════════════
# PRIORITY 4 — EMAIL ROUTING FIXES
# ══════════════════════════════════════════════════════════════

## goldshore.org — Misconfigured + SPF errors
# Problem: Email routing enabled but DNS misconfigured
# MX records (route1/2/3.mx.cloudflare.net) are not in the SPF record
#
# Fix SPF — add to goldshore.org DNS:
# Type: TXT, Name: @
# Value: v=spf1 include:_spf.mx.cloudflare.net ~all
#
# Fix DMARC — add to goldshore.org DNS:
# Type: TXT, Name: _dmarc
# Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@goldshore.org; sp=quarantine; adkim=r; aspf=r;

## armsway.com — Misconfigured
# Email routing enabled but DNS records missing
# Add MX records in Cloudflare DNS for armsway.com:
# Type: MX, Name: @, Priority: 76, Value: route1.mx.cloudflare.net
# Type: MX, Name: @, Priority: 34, Value: route2.mx.cloudflare.net
# Type: MX, Name: @, Priority: 50, Value: route3.mx.cloudflare.net
# Add TXT for routing:
# Type: TXT, Name: @, Value: v=spf1 include:_spf.mx.cloudflare.net ~all

## rmarston.com — DMARC error
# Type: TXT, Name: _dmarc
# Value: v=DMARC1; p=quarantine; rua=mailto:marstonr6@gmail.com; adkim=r; aspf=r;

## solefoodny.com — DMARC error + Bot Fight Mode not enabled
# DMARC: same pattern as above
# Bot Fight Mode: Security → Bots → Bot Fight Mode → Enable

## goldshore.foundation — DMARC error
# Type: TXT, Name: _dmarc
# Value: v=DMARC1; p=none; rua=mailto:dmarc@goldshore.ai;

# ══════════════════════════════════════════════════════════════
# PRIORITY 5 — WORKER BUILD FIXES
# ══════════════════════════════════════════════════════════════

## goldshore-ai Worker — build failing
# Problem: Build command "pnpm run build --filter=..." builds entire monorepo
#          Deploy cmd "npx wrangler deploy --assets=./apps/gs-web/dist" conflicts with gs-web Pages
# FIX OPTION A (recommended): Remove the goldshore-ai Worker's git connection entirely.
#   The gs-web Pages project already serves goldshore.ai. The Worker is redundant.
#   Dashboard: Workers & Pages → goldshore-ai → Build → Disconnect git repo
# FIX OPTION B: Change build command to just: echo "no-op" and deploy cmd to: npx wrangler deploy

## banproof-me Worker — build failing
# Problem: Static assets only — no src/index.ts — wrangler can't deploy as Worker
# FIX: Add src/index.ts (committed to PR) + fix wrangler.toml (committed to PR)
# Also fix route: was wrongly pointing to rmarston.com/* 
# Dashboard: Workers & Pages → banproof-me → Build
#   Build command: pnpm install --no-frozen-lockfile && npx tsc --noEmit || true
#   Deploy command: npx wrangler deploy

# ══════════════════════════════════════════════════════════════
# PRIORITY 6 — QUEUE WIRING
# ══════════════════════════════════════════════════════════════
# Queue "goldshore-jobs" exists
# Producer: gs-platform (gateway) — binding QUEUE
# Consumer: gs-agent — binding implicit consumer

# Verify in dashboard: Queues → goldshore-jobs → should show:
#   Producers: gs-platform, banproof-me (after fix)
#   Consumers: gs-agent

# ══════════════════════════════════════════════════════════════
# PRIORITY 7 — GITHUB CASB BROKEN INTEGRATION
# ══════════════════════════════════════════════════════════════
# Zero Trust → CASB → Integrations → GOLDSHORE Github = Broken
# Fix: Remove broken integration, re-add with correct GitHub OAuth app
#   Client ID: Iv23lijhVvQ1K7zY6PVn (from GoldShore Deploy IdP)
#   Re-authorize in GitHub settings

# ══════════════════════════════════════════════════════════════
# PRIORITY 8 — SECURITY QUICK WINS
# ══════════════════════════════════════════════════════════════
# Bot Fight Mode: Security → Bots → enable for solefoodny.com
# Block AI bots: Security → Bots → AI Scrapers/Crawlers → Block (per domain)
# Security.txt: Add /.well-known/security.txt to each Worker/Pages site

# ══════════════════════════════════════════════════════════════
# COMPLETE DOMAIN → APP MAP (authoritative)
# ══════════════════════════════════════════════════════════════
#
# goldshore.ai      → gs-web Pages (goldshore/goldshore-ai) — LIVE ✓
# www.goldshore.ai  → gs-web Pages — LIVE ✓
# goldshore.org     → goldshore-org Pages (goldshore/goldshore.github.io) — LIVE ✓
# api.goldshore.ai  → gs-api Worker — NEEDS custom domain added
# gw.goldshore.ai   → gs-platform Worker — NEEDS custom domain added
# admin.goldshore.ai → goldshore-admin Pages (CF Access) — LIVE, fix policy
# agent.goldshore.ai → gs-agent Worker — NEEDS custom domain added
# mail.goldshore.ai  → gs-mail Worker — LIVE ✓
# banproof.me       → banproof-me Worker — fix build first
# rmarston.com      → rmarston-github-io Pages — LIVE (Bootstrap, fix pending PR #102)
# armsway.com       → armsway Worker — fix email routing
