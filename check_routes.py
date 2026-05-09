import json
import re
from collections import Counter
from pathlib import Path

ROUTE_PATTERN = re.compile(r'^\s*pattern\s*=\s*"(.*?)"', re.MULTILINE)


def load_json(path: Path):
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def parse_routes(manifest_path: Path):
    content = manifest_path.read_text(encoding='utf-8')
    return ROUTE_PATTERN.findall(content)


def format_status(ok: bool, message: str):
    return f"{'OK' if ok else 'FAIL'}: {message}"


def known_zones_from_targets(targets: dict):
    zones = set()
    for value in targets.values():
        if isinstance(value, dict):
            zone = value.get('zone')
            host = value.get('host')
            if zone:
                zones.add(zone)
            if host:
                parts = host.split('.')
                if len(parts) >= 2:
                    zones.add('.'.join(parts[-2:]))
    if targets.get('repo'):
        zones.add(targets['repo'])
    return {z.lower() for z in zones}


def zone_from_route(route: str):
    host = route.split('/')[0].lower()
    parts = host.split('.')
    if len(parts) < 2:
        return host
    return '.'.join(parts[-2:])


def check():
    required = load_json(Path('ops/cloudflare-required.json'))
    targets = load_json(Path('ops/cloudflare-deploy-targets.json'))

    deployable_paths = [Path(p) for p in targets.get('deployable_manifest_paths', [])]
    archived_paths = {Path(p) for p in targets.get('archived_manifest_paths', [])}

    found_routes = []
    missing_manifests = []
    ignored_archived = []

    for manifest_path in deployable_paths:
        if manifest_path in archived_paths:
            ignored_archived.append(str(manifest_path))
            continue
        if not manifest_path.exists():
            missing_manifests.append(str(manifest_path))
            continue
        found_routes.extend(parse_routes(manifest_path))

    required_routes = required.get('required_routes', [])
    forbidden_routes = required.get('forbidden_routes', [])

    route_counts = Counter(found_routes)
    duplicate_routes = sorted([route for route, count in route_counts.items() if count > 1])

    known_zones = known_zones_from_targets(targets)
    unknown_zone_routes = sorted([r for r in found_routes if zone_from_route(r) not in known_zones])

    all_ok = True

    print('=== required routes status ===')
    if missing_manifests:
        all_ok = False
        for manifest in missing_manifests:
            print(format_status(False, f'deployable manifest not found: {manifest}'))
    for route in required_routes:
        ok = route in found_routes
        print(format_status(ok, f'{route}'))
        all_ok = all_ok and ok

    print('\n=== forbidden routes status ===')
    for route in forbidden_routes:
        ok = route not in found_routes
        print(format_status(ok, f'{route}'))
        all_ok = all_ok and ok

    print('\n=== duplicate route detection ===')
    if duplicate_routes:
        all_ok = False
        for route in duplicate_routes:
            print(format_status(False, f'duplicate route found: {route} ({route_counts[route]} entries)'))
    else:
        print(format_status(True, 'no duplicate routes found'))

    print('\n=== unknown-zone route detection ===')
    if unknown_zone_routes:
        all_ok = False
        for route in unknown_zone_routes:
            print(format_status(False, f'unknown zone route: {route}'))
    else:
        print(format_status(True, 'all routes belong to known zones'))

    if ignored_archived:
        print('\n=== archived manifests ignored ===')
        for manifest in sorted(ignored_archived):
            print(format_status(True, f'ignored archived manifest: {manifest}'))

    return all_ok


if __name__ == '__main__':
    import sys

    if not check():
        sys.exit(1)
