# Manual Cutover Gate (Dashboard-Only)

This runbook is intentionally ordered to reduce lockout risk and split-brain behavior.

## Locked host map (decision frozen)

- `gw.goldshore.ai` → **Worker:** `gs-platform`
- `api.goldshore.ai` → **Worker:** `gs-api`
- `agent.goldshore.ai` → **Worker:** `gs-agent`
- `goldshore.ai` → **Pages:** `gs-web` (primary web surface)
- `api.goldshore.org` → **not active** (do not attach unless explicitly re-approved)

> This freezes the ambiguous `.ai` vs `.org` API decision to **`api.goldshore.ai`** for cutover.

---

## 1) Fix Cloudflare Access first (highest risk)

For the active Access application:

- Replace policy model from:
  - `non_identity + everyone`
- To:
  - `identity + email domain @goldshore.ai`

Implementation target:

- Include: **Email domain** = `goldshore.ai`
- Remove/disable any broad `everyone` include rule
- Keep policy action as **Allow** (but identity-gated)

### Verification

- Open the protected URL in a fresh/incognito browser session.
- Confirm unauthenticated users cannot pass through directly.
- Confirm a `@goldshore.ai` identity can authenticate successfully.

---

## 2) Delete stale Access applications (after policy correction)

Delete duplicate/stale Access apps:

- `gs-mail` ×2
- `gs-platform` ×2
- `gs-api` ×2
- `goldshore-core` ×2
- `banproof-me` ×2

### Safety rule

Do not delete until you have identified the single active app that now has the corrected identity policy.

---

## 3) Attach Worker custom domains

In Workers, attach these custom domains:

- `gs-platform` → `gw.goldshore.ai`
- `gs-api` → `api.goldshore.ai`
- `gs-agent` → `agent.goldshore.ai`

For each domain binding, confirm:

1. Route/custom domain is attached to the intended Worker.
2. No duplicate attachment exists on another Worker/Pages project.
3. Health endpoint returns an expected response.

---

## 4) Disconnect redundant `goldshore-ai` build

In **Workers / Pages / Build settings** for `goldshore-ai`:

- Disconnect Git build.

Do **not** delete the Worker yet unless dependency checks are complete.

Reason: avoid split-brain deployment path if `gs-web` already serves `goldshore.ai`.

---

## 5) Fix `goldshore.org` mail DNS

Add DNS records:

1. SPF TXT at apex (`@`):

```txt
v=spf1 include:_spf.mx.cloudflare.net ~all
```

2. DMARC TXT at `_dmarc`:

```txt
v=DMARC1; p=none; rua=mailto:<reporting-address>
```

If no dedicated reporting mailbox exists yet, use the Cloudflare-generated reporting address already standardized for your org.

---

## 6) Fix `armsway.com` mail routing

Add Cloudflare Email Routing MX records with Cloudflare-recommended priorities:

- `route1.mx.cloudflare.net`
- `route2.mx.cloudflare.net`
- `route3.mx.cloudflare.net`

Also ensure:

- A valid SPF record exists.
- Conflicting legacy MX records are removed.

---

## 7) Verification checks (after propagation)

### Workers / hostnames

```bash
curl -I https://gw.goldshore.ai/health
curl -I https://api.goldshore.ai/health
curl -I https://agent.goldshore.ai/health
```

Expect non-error HTTP status from the intended Worker handlers.

### DNS / mail

Verify publicly resolvable records:

```bash
dig +short TXT goldshore.org
dig +short TXT _dmarc.goldshore.org
dig +short MX armsway.com
```

---

## 8) Continue deploy/cutover only after all checks pass

No deploy or downstream cutover actions should proceed until steps 1–7 are complete.

## Operator sign-off checklist

- [ ] Access policy is identity-gated and scoped to `@goldshore.ai`
- [ ] Stale Access applications removed
- [ ] Worker custom domains attached and unique
- [ ] `goldshore-ai` redundant Git build disconnected
- [ ] `goldshore.org` SPF + DMARC present
- [ ] `armsway.com` MX + SPF valid, old MX removed
- [ ] Health endpoints and DNS records verified
- [ ] Cutover approval granted
