import json
import os
import re

def check():
    with open('ops/cloudflare-required.json', 'r') as f:
        required = json.load(f)

    found_routes = []
    for root, dirs, files in os.walk('.'):
        if 'node_modules' in root: continue
        for file in files:
            if file == 'wrangler.toml':
                path = os.path.join(root, file)
                with open(path, 'r') as f:
                    content = f.read()
                    patterns = re.findall(r'pattern\s*=\s*"(.*?)"', content)
                    found_routes.extend(patterns)

    print(f"Found routes: {found_routes}")

    all_ok = True
    for req in required.get('required_routes', []):
        if req in found_routes:
            print(f"OK: {req} is covered")
        else:
            print(f"MISSING: {req} is NOT covered in wrangler.toml files")
            all_ok = False

    for forbidden in required.get('forbidden_routes', []):
        if forbidden in found_routes:
            print(f"FORBIDDEN: {forbidden} IS PRESENT in wrangler.toml files")
            all_ok = False
        else:
            print(f"OK: {forbidden} is correctly absent")

    return all_ok

if __name__ == "__main__":
    import sys
    if not check():
        sys.exit(1)
