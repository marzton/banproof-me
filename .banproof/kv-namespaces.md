# Cloudflare KV Namespace Registry

All KV namespace IDs for the Gold Shore / BanProof platform.
Keep this file in sync whenever a namespace is created or renamed.

> **Cross-repo IDs**: the namespaces marked with a repo other than
> `banproof.me` must be backfilled into their respective `wrangler.toml`
> files; they are listed here as the single source of truth.

---

## banproof.me (this repo)

| Binding        | Namespace ID                       | Worker config                     | Status   |
|----------------|------------------------------------|-----------------------------------|----------|
| `CACHE`        | `af8eb071fce34b5eafbdeb1badd93876` | `gateway/wrangler.toml` (all envs) + `worker/wrangler.toml` | ✅ Live |
| `INFRA_SECRETS`| `b9824d3280c54573a24137c7e7143b33` | `gateway/wrangler.toml` (all envs) + `worker/wrangler.toml` | ✅ Live |

---

## Cross-repo — IDs provisioned 2026-04-03

The following IDs were supplied on 2026-04-03 and must be backfilled into
the wrangler.toml files of their target repositories.

| ID                                 | Target repo          | Binding name     | Target config path                              |
|------------------------------------|----------------------|------------------|-------------------------------------------------|
| `9cc2209906a94851b704be57543987a9` | `goldshore-ai`       | `KV`             | `apps/gs-api/wrangler.toml` → `[env.prod]`     |
| `6229af63c7b4470eb4244f17995ed0ce` | `goldshore-ai`       | `CONTROL_LOGS`   | `apps/gs-api/wrangler.toml` → `[env.prod]`     |
| `5f13370575784c9dacff522121104cb3` | `goldshore-gateway`  | `GS_CONFIG`      | `goldshore-gateway/wrangler.toml` ✅ already set |
| `44814e2bc96a43eda231e0156c29b6c9` | `goldshore-core`     | `INFRA_SECRETS`  | `apps/admin-dashboard/wrangler.toml`            |
| `0c45009b68c944d6988a5268bdaa7361` | `goldshore-api`      | `STORE`          | `apps/api-worker/wrangler.toml` → `[env.production]` |
| `895b3586e1ce46c5b33f7a2fdbdad314` | `goldshore-api`      | `STORE` (preview)| `apps/api-worker/wrangler.toml` → `[env.preview]` |
| `d0b889d0ba314b42892f5b959356ceda` | `goldshore-gateway`  | `CONTROL_STORE`  | `goldshore-control-worker/wrangler.toml`        |
| `30ad09d3df9944dc8590fcbe230f6f5b` | `goldshore-admin`    | `KV_SESSIONS`    | Pending — backfill once admin worker is wired   |

> **Note**: IDs for `KV_CACHE`, `GOOGLE_KV`, and the two goldshore-ai
> preview namespaces (`gs_api_kv_preview`, `gs_control_logs_preview`)
> are not yet in this list. Provision via:
> ```
> wrangler kv:namespace create KV_CACHE
> wrangler kv:namespace create GOOGLE_KV
> wrangler kv:namespace create gs_api_kv_preview
> wrangler kv:namespace create gs_control_logs_preview
> ```
> then append them here.

---

## How to add a new namespace

```bash
# 1. Create
wrangler kv:namespace create MY_BINDING

# 2. Note the returned ID, add a row to this table.

# 3. Add to the relevant wrangler.toml:
# [[kv_namespaces]]
# binding = "MY_BINDING"
# id      = "<returned-id>"
```
