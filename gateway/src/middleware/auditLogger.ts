// ============================================================
// Audit Logger Middleware — non-blocking D1 writes
// Logs every POST /api/pro/analyze request to audit_log.
// ============================================================

import type { MiddlewareHandler } from 'hono';
import type { AuditAction } from '../types/api.js';
import type { Bindings } from '../types/env.js';

export const auditLogger: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  await next();

  const db = c.env.DB;
  if (!db) return;

  const userId = c.req.header('X-User-Id') ?? 'anonymous';
  const tier   = c.req.header('X-User-Tier') ?? 'free';
  const action: AuditAction = 'AI_ANALYSIS';

  // Collect light metadata — body has already been consumed by the handler
  const metadata = {
    method: c.req.method,
    path:   new URL(c.req.url).pathname,
    status: c.res.status,
  };

  // Fire-and-forget — do NOT await so the client response is unaffected
  c.executionCtx?.waitUntil(
    db
      .prepare(
        `INSERT INTO audit_log (user_id, tier, action, metadata) VALUES (?, ?, ?, ?)`,
      )
      .bind(userId, tier, action, JSON.stringify(metadata))
      .run()
      .catch(() => { /* swallow errors — non-critical path */ }),
  );
};
