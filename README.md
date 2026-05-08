# banproof.me — Banproof / Proof of Agency

## Canonical route ownership
Single source of truth: `ops/route-ownership.json`.

### Production / Staging / Preview (same ownership map)
- `banproof.me/*` → Pages/Assets (`pages:banproof`)
- `www.banproof.me/*` → Pages/Assets (`pages:banproof`)
- `api.banproof.me/*` → gateway worker (`worker:banproof-gateway`)
- `admin.banproof.me/*` → gateway worker (`worker:banproof-gateway`)
- `preview.banproof.me/*` → designated preview runtime (`worker:banproof-gateway-preview`)

## Repo → Runtime → Domain
| App | Runtime | Domain | Status |
|-----|---------|--------|--------|
| `public/` | `banproof` Pages | `banproof.me`, `www.banproof.me` | ✅ Live |
| `gateway/` | `banproof-me` Worker | `api.banproof.me`, `admin.banproof.me` | ✅ Live |
| root worker | preview runtime | `preview.banproof.me` | ✅ Live |

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
