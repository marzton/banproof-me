// ============================================================
// @goldshore/identity — Session-based auth middleware
//
// Checks the Bearer token / session cookie against the KV
// cache, falling back to the D1 sessions table on a miss.
// Sets c.var.user for downstream handlers.
//
// Usage (any worker whose Bindings extends IdentityEnv):
//   app.use('/api/protected/*', authMiddleware);
//   app.use('/api/pro/*',       authMiddleware, requirePro);
//   app.use('/api/admin/*',     authMiddleware, requireAdmin);
// ============================================================

import { MiddlewareHandler } from 'hono';
import { getCookie }         from 'hono/cookie';
import type { IdentityEnv, IdentityVariables, User } from '../types.js';

const SESSION_TTL = 300; // KV cache TTL in seconds (5 min)

export const authMiddleware: MiddlewareHandler<{
  Bindings: IdentityEnv;
  Variables: IdentityVariables;
}> = async (c, next) => {
  const authHeader   = c.req.header('Authorization');
  const sessionToken =
    authHeader?.replace('Bearer ', '') ?? getCookie(c, 'session') ?? null;

  if (!sessionToken) {
    return c.json({ error: 'Authentication required.' }, 401);
  }

  // 1. Check KV cache
  const cached = await c.env.CACHE.get<
    Pick<User, 'id' | 'email' | 'plan_tier' | 'subscription_status'>
  >(`session:${sessionToken}`, 'json');

  if (cached) {
    if (
      cached.subscription_status === 'past_due' ||
      cached.subscription_status === 'canceled'
    ) {
      return c.json(
        { error: 'Subscription inactive.', plan: cached.plan_tier },
        402,
      );
    }
    c.set('user', cached);
    return next();
  }

  // 2. Fall back to D1 sessions table
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.plan_tier, u.subscription_status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
        AND s.expires_at > CURRENT_TIMESTAMP
      LIMIT 1`,
  )
    .bind(sessionToken)
    .first<Pick<User, 'id' | 'email' | 'plan_tier' | 'subscription_status'>>();

  if (!row) {
    return c.json({ error: 'Invalid or expired session.' }, 401);
  }

  if (
    row.subscription_status === 'past_due' ||
    row.subscription_status === 'canceled'
  ) {
    return c.json(
      { error: 'Subscription inactive.', plan: row.plan_tier },
      402,
    );
  }

  // 3. Populate KV cache
  await c.env.CACHE.put(
    `session:${sessionToken}`,
    JSON.stringify(row),
    { expirationTtl: SESSION_TTL },
  );

  c.set('user', row);
  return next();
};

// ── Tier guards ───────────────────────────────────────────────

export const requirePro: MiddlewareHandler<{
  Bindings: IdentityEnv;
  Variables: IdentityVariables;
}> = async (c, next) => {
  if (c.var.user.plan_tier === 'free') {
    return c.json(
      { error: 'Pro subscription required.', upgrade: '/pricing' },
      403,
    );
  }
  return next();
};

export const requireAdmin: MiddlewareHandler<{
  Bindings: IdentityEnv;
  Variables: IdentityVariables;
}> = async (c, next) => {
  if (c.var.user.plan_tier !== 'admin') {
    return c.json({ error: 'Admin access required.' }, 403);
  }
  return next();
};
