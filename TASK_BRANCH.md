# Task Branch: Banproof Auth and Billing Alignment

Agent target: Codex
Repository: marzton/banproof-me
Branch: codex/banproof-auth-billing

## Mission
Align Banproof with the Gold Shore identity, role, queue, and subscription model without breaking its existing gateway behavior.

## Scope
- Review current worker and gateway handlers.
- Remove duplicated or malformed queue handler logic.
- Normalize auth context shape with Gold Shore API expectations.
- Add billing tier mapping for free, pro, agency, and admin capabilities.
- Confirm email handler and queue consumer fail safely when bindings are missing.
- Document required Cloudflare bindings, secrets, and local dev vars.

## Acceptance Criteria
- TypeScript compiles cleanly.
- Queue handler has one clear dispatch path.
- Protected routes enforce the intended role or tier.
- Missing optional bindings produce controlled errors, not crashes.
- README explains deploy and smoke test sequence.
