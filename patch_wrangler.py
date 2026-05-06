import re

with open("wrangler.toml", "r") as f:
    content = f.read()

bindings = """
[[d1_databases]]
binding = "PLATFORM_DB"
database_name = "gs_platform_db"
database_id = "9703574e-adb7-481e-8d98-96f8ce5f8a90"

[[d1_databases]]
binding = "AUDIT_DB"
database_name = "gs_audit_db"
database_id = "1ae71d76-188f-481b-91d9-db2d39013f68"

[[d1_databases]]
binding = "SIGNALS_DB"
database_name = "gs_signals_db"
database_id = "f77de112-d201-9e54-56a3-198a8bb50bd2" # Mock ID

[[kv_namespaces]]
binding = "GS_CONFIG"
id = "5f13370575784c9dacff522121104cb3"

[[kv_namespaces]]
binding = "BANPROOF_KV"
id = "b9824d3280c54573a24137c7e7143b33" # Mock ID

[[kv_namespaces]]
binding = "GOLDSHORE_KV"
id = "af8eb071fce34b5eafbdeb1badd93876" # Mock ID

[[r2_buckets]]
binding = "MEDIA_STORE"
bucket_name = "gs-assets"

[[r2_buckets]]
binding = "TELEMETRY_STORE"
bucket_name = "gs-telemetry-storage"

[[services]]
binding = "SECURITY"
service = "banproof-me"

[[services]]
binding = "SIGNALS"
service = "gs-signals-prod"
"""

# replace the existing ones so there are no duplicates
content = re.sub(r'\[\[d1_databases\]\][\s\S]*?(?=\[\[|\Z)', '', content)
content = re.sub(r'\[\[kv_namespaces\]\][\s\S]*?(?=\[\[|\Z)', '', content)
content = re.sub(r'\[\[r2_buckets\]\][\s\S]*?(?=\[\[|\Z)', '', content)
content = re.sub(r'\[\[services\]\][\s\S]*?(?=\[\[|\Z)', '', content)

content += "\n" + bindings

with open("wrangler.toml", "w") as f:
    f.write(content)
