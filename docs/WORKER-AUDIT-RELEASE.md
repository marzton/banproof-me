# Worker route repair release prerequisites

This change repairs the malformed root `src/index.ts`, not the separate `gateway/src/index.ts`. It restores one fetch entry point, correct HTTP method dispatch, validated workflow submissions, and explicit errors when assets or persistence are unavailable.

Workflow submit/status endpoints require a server-side `POA_TOKEN` and a matching Bearer header. Missing authorization configuration fails closed with 503. A configured service caller without valid credentials receives 401. Browser users must not be given this shared token; use a trusted authenticated backend for them.

The owner selected the canonical Gold Shore admin application. Browser GET/HEAD requests on `admin.banproof.me` redirect to `https://admin.goldshore.ai/app/dashboard`; `/app/` deep links preserve their path, and query strings are dropped. The destination is covered by the existing admin Access application. Health and API routes retain their explicit handlers and workflow authorization. Verify the canonical destination still challenges unauthorized users before release.

Run `node --test --test-isolation=none tests/worker.test.mjs` on Node 24, perform the full project type/build checks in a complete checkout, and verify the active release version before deployment. The repository's existing deploy workflow is a no-op; a commit is not a release. The unrelated broken gateway and its production-shared development/staging resources remain outside this root-worker fix.

No assets, DNS, Access policy, secret, workflow instance, or deployment was changed by this commit.

The pnpm lockfile was regenerated against the committed workspace manifests to repair Cloudflare Builds frozen-lockfile failure. The existing gateway coverage/Vitest major-version mismatch and malformed gateway source remain separate blockers; this root Worker repair does not bypass those checks.
