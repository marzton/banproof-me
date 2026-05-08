# banproof.me — Banproof / Proof of Agency

<a href="https://github.com/marzton/banproof-me/actions/workflows/deploy.yml"><img src="https://github.com/marzton/banproof-me/actions/workflows/deploy.yml/badge.svg?branch=main"></a>

## Repo → Worker → Domain
| App | CF Pages | Domain | Status |
|-----|----------|--------|--------|
| `public/` | `banproof` Pages | `banproof.me`, `www.banproof.me` | ✅ Live |

## Cloudflare Account
- **Account:** Gold Shore Labs (`f77de112d2019e5456a3198a8bb50bd2`)
- **Pages project:** `banproof`
- **Pages Function:** `functions/api/contact.js` → CF Email Routing
- **D1:** `gs_platform_db` (binding: `PLATFORM_DB`)

## Email binding (required)
CF Pages → Settings → Functions → Bindings → Add:
- Type: Send Email · Name: `SEND_EMAIL` · Destination: `marstonr6@gmail.com`

## Powered by
Gold Shore Labs — goldshore.ai
