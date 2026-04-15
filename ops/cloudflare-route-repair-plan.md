# Cloudflare Route and Binding Repair Plan

## Repository
`marzton/banproof.me`

## Objective
Restore static-first public delivery while keeping worker runtime behavior explicit and verifiable.

## Target ownership
- `banproof.me` and `www.banproof.me`: static-first
- `api.banproof.me`: runtime worker if used
- `admin.banproof.me`: placeholder or app shell if used
- `preview.banproof.me`: preview or staging if used

## Guardrails
- Verify required bindings, KV namespaces, secrets, and DNS records before deploy.
- Fail deploy when route ownership or Cloudflare dependencies are incomplete.
