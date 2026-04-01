// ============================================================
// banproof-core — Gatekeeper Worker (Cloudflare Workers)
// ============================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Workflow } from '@cloudflare/workers-types';
import type { IdentityVariables } from '@goldshore/identity';
import { authMiddleware, requirePro } from '@goldshore/identity';
import { BanproofEngine } from './engine.js';

// ── Bindings type ─────────────────────────────────────────────
// Extends IdentityEnv (DB + CACHE) with the Workflow binding.
type Bindings = {
  DB:     D1Database;
  CACHE:  KVNamespace;
  ENGINE: Workflow;
};

const app = new Hono<{ Bindings: Bindings; Variables: IdentityVariables }>();

// ── CORS middleware ───────────────────────────────────────────
app.use(
  '/api/*',
  cors({
    origin: ['https://banproof.me', 'http://localhost:5500'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ── GET /api/health ───────────────────────────────────────────
// Verifies D1 connectivity and that the Workflow binding exists.
app.get('/api/health', async (c) => {
  let database = false;
  try {
    await c.env.DB.prepare('SELECT 1').first();
    database = true;
  } catch {
    // D1 not reachable
  }

  const workflow = typeof c.env.ENGINE?.create === 'function';

  return c.json({ status: 'ok', database, workflow });
});

// ── POST /api/pro/analyze ─────────────────────────────────────
// Auth-gated: requires a valid session with Pro (or Admin) tier.
// Triggers a BanproofEngine workflow instance.
app.post('/api/pro/analyze', authMiddleware, requirePro, async (c) => {
  let query: string;
  try {
    ({ query } = await c.req.json<{ query: string }>());
  } catch {
    return c.json({ error: 'Invalid JSON in request body.' }, 400);
  }

  if (!query) {
    return c.json({ error: 'query is required.' }, 400);
  }

  const userId = c.var.user.id;

  const instance = await c.env.ENGINE.create({
    params: { query, userId },
  });

  return c.json({ workflowId: instance.id }, 202);
});

// ── Exports ───────────────────────────────────────────────────
export { BanproofEngine };
export default app;
