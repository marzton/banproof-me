# Worker route repair release prerequisites

This change repairs the malformed root `src/index.ts`, not the separate `gateway/src/index.ts`. It restores one fetch entry point, correct HTTP method dispatch, validated workflow submissions, and explicit errors when assets or persistence are unavailable.

Workflow submit/status endpoints require a server-side `POA_TOKEN` and a matching Bearer header. Missing authorization configuration fails closed with 503. A configured service caller without valid credentials receives 401. Browser users must not be given this shared token; use a trusted authenticated backend for them.

The audit found no ASSETS binding on the active Worker. This change returns an intentional 503 for the unconfigured root and JSON 404 for unknown routes. It does not invent or expose an admin UI. The owner must choose the canonical admin application, configure appropriate Access/application authorization, and review routing separately before that hostname can serve a working admin site.

Run `node --test --test-isolation=none tests/worker.test.mjs` on Node 24, perform the full project type/build checks in a complete checkout, and verify the active release version before deployment. The repository's existing deploy workflow is a no-op; a commit is not a release. The unrelated broken gateway and its production-shared development/staging resources remain outside this root-worker fix.

No assets, DNS, Access policy, secret, workflow instance, or deployment was changed by this commit.
