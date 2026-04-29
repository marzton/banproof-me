// ============================================================
// Access Control Middleware — Test Suite
// Tests Zero-Edge SSO + agent-token fallback + RBAC
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { accessControlMiddleware } from '../src/middleware/accessControl.js';
import { enforceRBAC } from '../src/middleware/zeroEdgeSSO.js';
import type { ZeroEdgeIdentity, AccessContext } from '../src/types/access.js';
import type { Bindings, Variables } from '../src/types/env.js';

// ── Mock zeroEdgeSSO module ───────────────────────────────────
vi.mock('../src/middleware/zeroEdgeSSO.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/middleware/zeroEdgeSSO.js')>();
  return {
    ...original,
    validateZeroEdgeJWT: vi.fn(),
  };
});

import { validateZeroEdgeJWT } from '../src/middleware/zeroEdgeSSO.js';

// ── Test helpers ──────────────────────────────────────────────
const VALID_TOKEN  = 'secret_agent_key_2026'; // PoA agent token
const TRUSTED_IP   = '100.100.100.1';
const UNTRUSTED_IP = '203.0.113.99';

const BASE_ENV = {
  CF_ACCESS_AUDIENCE:      'https://banproof-core.marzton.workers.dev',
  CF_ZERO_EDGE_PUBLIC_KEY: 'MOCK_KEY',
  TRUSTED_ADMIN_IPS:       `${TRUSTED_IP},127.0.0.1,::1`,
};

function buildApp() {
  const app = new Hono<{ Variables: { accessContext: AccessContext } }>();

  app.use('*', accessControlMiddleware as any);

  // Protected routes
  app.post('/api/pro/analyze', (c) => c.json({ ok: true }));
  app.post('/api/access/sentiment', (c) => {
    const accessContext = c.get('accessContext');
    if (!accessContext || !enforceRBAC(accessContext, 'pro')) {
      const status = !accessContext || accessContext.method === 'public' ? 401 : 403;
      return c.json({ error: "Access denied: 'pro' role required" }, status);
    }
    return c.json({
      workflowId: 'sentiment-test-workflow',
      source: 'mock',
      access: {
        tierUsed: accessContext.identity.tierLevel,
        minTierRequired: 'pro',
      },
    }, 202);
  });
  app.get('/admin/dashboard',  (c) => c.json({ ok: true }));
  app.post('/admin/config',    (c) => c.json({ ok: true }));
  // Public route
  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  return app;
}

function doFetch(
  app: Hono<{ Bindings: Bindings; Variables: Variables }>,
  request: Request,
  envOverrides: Partial<Bindings> = {},
) {
  return app.fetch(request, { ...BASE_ENV, ...envOverrides } as any);
}

function makeIdentity(overrides: Partial<ZeroEdgeIdentity> = {}): ZeroEdgeIdentity {
  return {
    userId:    'user-123',
    email:     'user@banproof.me',
    role:      'pro',
    tierLevel: 'pro',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function jwtRequest(
  path: string,
  method = 'GET',
  ip = TRUSTED_IP,
  extraHeaders: Record<string, string> = {},
) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      'Cf-Access-Jwt-Assertion': 'mock.jwt.token',
      'CF-Connecting-IP': ip,
      ...extraHeaders,
    },
  });
}

function agentRequest(
  path: string,
  method = 'GET',
  ip = TRUSTED_IP,
) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      'Authorization':   `Bearer ${VALID_TOKEN}`,
      'CF-Connecting-IP': ip,
    },
  });
}

function publicRequest(path: string, method = 'GET', ip = TRUSTED_IP) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'CF-Connecting-IP': ip },
  });
}

// ── Test suite ────────────────────────────────────────────────

describe('accessControlMiddleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows GET /api/health without any authentication', async () => {
    const app = buildApp();
    const res = await doFetch(app, publicRequest('/api/health'));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('allows OPTIONS on a protected route without auth (CORS preflight)', async () => {
    const app = buildApp();
    const req = new Request('http://localhost/api/pro/analyze', {
      method: 'OPTIONS',
      headers: { 'CF-Connecting-IP': TRUSTED_IP },
    });
    const res = await doFetch(app, req);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('allows POST /api/pro/analyze with valid JWT + pro tier', async () => {
    vi.mocked(validateZeroEdgeJWT).mockResolvedValue(makeIdentity({ role: 'pro', tierLevel: 'pro' }));
    const app = buildApp();
    const res = await doFetch(app, jwtRequest('/api/pro/analyze', 'POST'));
    expect(res.status).toBe(200);
  });

  it('rejects POST /api/access/sentiment for free-tier JWT (403)', async () => {
    vi.mocked(validateZeroEdgeJWT).mockResolvedValue(makeIdentity({ role: 'public', tierLevel: 'free' }));
    const app = buildApp();
    const res = await doFetch(app, jwtRequest('/api/access/sentiment', 'POST'));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: "Access denied: 'pro' role required" });
  });

  it('denies POST /admin/config with admin role + untrusted IP (403)', async () => {
    vi.mocked(validateZeroEdgeJWT).mockResolvedValue(makeIdentity({ role: 'admin', tierLevel: 'agency' }));
    const app = buildApp();
    const res = await doFetch(app, jwtRequest('/admin/config', 'POST', UNTRUSTED_IP));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/whitelist/i);
  });

  it('attaches accessContext to request when using Zero-Edge SSO', async () => {
    const identity = makeIdentity({ role: 'pro', tierLevel: 'pro' });
    vi.mocked(validateZeroEdgeJWT).mockResolvedValue(identity);
    const app = buildApp();
    app.post('/api/pro/context-check', (c) => {
      const ctx = c.get('accessContext');
      return c.json({ method: ctx?.method, role: ctx?.identity.role });
    });

    const res = await doFetch(app as any, jwtRequest('/api/pro/context-check', 'POST'));
    expect(res.status).toBe(200);
    const body = await res.json() as { method: string; role: string };
    expect(body.method).toBe('zero-edge-sso');
    expect(body.role).toBe('pro');
  });

  it('attaches accessContext with method agent-token when using Bearer auth', async () => {
    const app = buildApp();

    app.post('/api/pro/context-check', (c) => {
      const ctx = c.get('accessContext');
      return c.json({ method: ctx?.method });
    });

    const res = await doFetch(app as any, agentRequest('/api/pro/context-check', 'POST', TRUSTED_IP));
    expect(res.status).toBe(200);
    const body = await res.json() as { method: string };
    expect(body.method).toBe('agent-token');
  });
});
