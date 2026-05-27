# Cloudflare deployment source of truth

This repository blocks deploys when Cloudflare routes/bindings drift from committed manifests.

## Canonical inputs

- Route policy: `ops/cloudflare-required.json`
- Binding policy by target/environment: `ops/cloudflare-bindings-required.json`
- Canonical worker manifests:
  - `wrangler.jsonc` (`banproof-me`)
  - `gateway/wrangler.toml` (`banproof-core`)

## Agent onboarding flow

1. **Pick the deploy target + environment** you are touching (`banproof-me` default, or `banproof-core` default/development/staging).
2. **Edit the canonical manifest first** (`wrangler.jsonc` or `gateway/wrangler.toml`).
3. **Update required policy files**:
   - routes/DNS expectations in `ops/cloudflare-required.json`
   - binding expectations in `ops/cloudflare-bindings-required.json`
4. **Run static validators locally**:
   - `python check_routes.py`
   - `python scripts/validate_cloudflare_manifests.py`
5. **Open PR only after validators pass**. CI will run these validators again and fail deploy if mismatch or duplicate bindings are found.

## What is validated

`python scripts/validate_cloudflare_manifests.py` checks for each deploy target/environment:

- required binding presence by type: D1, KV, R2, service, send_email, workflows, queues, and vars;
- duplicate binding names (e.g., duplicate route producer binding names in one env).

`python check_routes.py` ensures required routes are present and forbidden routes are absent across scanned `wrangler.toml` manifests.

## CI enforcement

`.github/workflows/cloudflare-infra-guard.yml` runs both static validators before live Cloudflare API checks. Any mismatch blocks the workflow and therefore blocks deploy/merge.
