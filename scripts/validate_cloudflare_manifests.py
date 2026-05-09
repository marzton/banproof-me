#!/usr/bin/env python3
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQ_PATH = ROOT / "ops" / "cloudflare-bindings-required.json"


def load_manifest(path: Path):
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".jsonc":
        text = re.sub(r"//.*", "", text)
        return json.loads(text)
    if path.suffix == ".toml":
        try:
            import tomllib
        except ModuleNotFoundError:
            import tomli as tomllib
        return tomllib.loads(text)
    raise ValueError(f"Unsupported manifest type: {path}")


def binding_names(manifest: dict, env: str):
    node = manifest if env == "default" else manifest.get("env", {}).get(env, {})

    def get_list(key):
        return node.get(key) or []

    names = {
        "d1": [x.get("binding") for x in get_list("d1_databases") if x.get("binding")],
        "kv": [x.get("binding") for x in get_list("kv_namespaces") if x.get("binding")],
        "r2": [x.get("binding") for x in get_list("r2_buckets") if x.get("binding")],
        "service": [x.get("binding") for x in get_list("services") if x.get("binding")],
        "send_email": [x.get("name") for x in get_list("send_email") if x.get("name")],
        "workflows": [x.get("binding") for x in get_list("workflows") if x.get("binding")],
        "queues": [x.get("binding") for x in (node.get("queues", {}).get("producers") or []) if x.get("binding")],
        "vars": sorted((node.get("vars") or {}).keys()),
    }
    return names


def duplicates(values):
    c = Counter(values)
    return sorted([k for k, v in c.items() if v > 1])


def main():
    cfg = json.loads(REQ_PATH.read_text(encoding="utf-8"))
    failed = False

    for target, target_cfg in cfg.get("targets", {}).items():
        manifest_path = ROOT / target_cfg["manifest"]
        manifest = load_manifest(manifest_path)
        for env, env_cfg in target_cfg.get("environments", {}).items():
            actual = binding_names(manifest, env)
            required = env_cfg.get("required", {})
            print(f"\n[{target}:{env}] {manifest_path}")

            for kind, expected in required.items():
                missing = sorted(set(expected) - set(actual.get(kind, [])))
                if missing:
                    failed = True
                    print(f"  MISSING {kind}: {', '.join(missing)}")
                else:
                    print(f"  OK {kind}")

            for kind, values in actual.items():
                dups = duplicates(values)
                if dups:
                    failed = True
                    print(f"  DUPLICATE {kind}: {', '.join(dups)}")

    if failed:
        print("\nCloudflare manifest validation FAILED")
        sys.exit(1)

    print("\nCloudflare manifest validation passed")


if __name__ == "__main__":
    main()
