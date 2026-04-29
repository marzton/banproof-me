// ============================================================
// banproof-core — Gatekeeper Worker (Cloudflare Workers)
// ============================================================

import { Hono }        from 'hono';
import { cors }        from 'hono/cors';
import type { Workflow, MessageBatch, Ai, EmailMessage } from '@cloudflare/workers-types';
import { BanproofEngine } from './engine.js';
import { SubscriptionPurchaseWorkflow, type SubscriptionPurchaseParams } from './workflows/subscriptionPurchase.js';
import { rateLimiter }   from './middleware/rateLimiter.js';
import { auditLogger }   from './middleware/auditLogger.js';
import { authMiddleware } from './middleware/auth.js';
import { tollBoothMiddleware } from './middleware/tollBooth.js';
import { accessControlMiddleware } from './middleware/accessControl.js';
import { enforceRBAC } from './middleware/zeroEdgeSSO.js';
import authRoutes      from './routes/auth.js';
import adminRoutes     from './routes/admin.js';
import type { AccessContext } from './types/access.js';
import { SentimentWorkflow } from './workflows/sentimentWorkflow.js';
import adminEmailRoutes from './routes/adminEmail.js';

// ── Bindings type ─────────────────────────────────────────────
type Bindings = {
  DB:               D1Database;
  CACHE:            KVNamespace;
  INFRA_SECRETS:    KVNamespace;
  ENGINE:           Workflow;
  PURCHASE_WORKFLOW: Workflow;
  STORAGE:          R2Bucket;
  AI:               Ai;
  ENVIRONMENT:      string;
  USE_MOCK:         string;
  JWT_SECRET:       string;
  CORS_ORIGINS?:    string;
  HF_API_TOKEN?:    string;
  ODDS_API_KEY?:    string;
  DISCORD_WEBHOOK?: string;
  /** Service binding → saas-admin-template-customer-workflow */
  WORKFLOW:         Fetcher;
  /** Service binding → banproof-email-router */
  EMAIL_ROUTER:     Fetcher;
  /** Queue producer → goldshore-jobs */
  QUEUE:            Queue<QueueJobMessage>;
};

type Variables = {
  auth: import('./types/api.js').AuthContext;
  poaScore?: number;
  accessContext?: AccessContext;
};

// ── Queue message schema ──────────────────────────────────────
type QueueJobMessage = {
  /** Discriminates the job variant (e.g. 'sync_user', 'send_email'). */
  type: string;
  payload: Record<string, unknown>;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ── CORS middleware ───────────────────────────────────────────
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      const allowList = c.env.CORS_ORIGINS
        ? c.env.CORS_ORIGINS.split(',').map((o) => o.trim())
        : ['https://banproof.me', 'http://localhost:5500', 'http://localhost:8788'];
      return allowList.includes(origin) ? origin : null;
    },
    allowMethods:  ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders:  ['Content-Type', 'Authorization', 'X-User-Id', 'X-User-Tier'],
    credentials:   true,
  }),
);

// ── GET /api/health ───────────────────────────────────────────
app.get('/api/health', async (c) => {
  let database = false;
  try {
    await c.env.DB.prepare('SELECT 1').first();
    database = true;
  } catch {
    // D1 not reachable
  }

  const workflow = typeof c.env.ENGINE?.create === 'function';

  return c.json({
    status:   'ok',
    database,
    workflow,
    mock:     c.env.USE_MOCK !== 'false',
    ts:       new Date().toISOString(),
  });
});

// ── Auth routes (/auth/*) ─────────────────────────────────────
app.route('/auth', authRoutes);

// ── Admin routes (/admin/*) ───────────────────────────────────
app.route('/admin', adminRoutes);
app.route('/api/admin', adminEmailRoutes);


// ── POST /api/paywall/purchase/complete ─────────────────────
app.post('/api/paywall/purchase/complete', async (c) => {
  const body = await c.req
    .json<SubscriptionPurchaseParams>()
    .catch(() => null);

  if (!body) {
    return c.json({ error: 'Invalid JSON payload.' }, 400);
  }

  if (!body.userId || typeof body.userId !== 'string') {
    return c.json({ error: 'userId (string) is required.' }, 400);
  }

  if (!['free', 'pro', 'agency'].includes(body.targetTier)) {
    return c.json({ error: 'targetTier must be one of: free, pro, agency.' }, 400);
  }

  if (!body.paymentEvent || typeof body.paymentEvent !== 'object') {
    return c.json({ error: 'paymentEvent metadata is required.' }, 400);
  }

  if (typeof body.paymentEvent.eventId !== 'string' || !body.paymentEvent.eventId) {
    return c.json({ error: 'paymentEvent.eventId (string) is required.' }, 400);
  }

  if (typeof body.paymentEvent.provider !== 'string' || !body.paymentEvent.provider) {
    return c.json({ error: 'paymentEvent.provider (string) is required.' }, 400);
  }

  const instance = await c.env.PURCHASE_WORKFLOW.create({
    params: {
      userId: body.userId,
      targetTier: body.targetTier,
      paymentEvent: body.paymentEvent,
      notify: body.notify,
    },
  });

  return c.json({ ok: true, workflowId: instance.id }, 202);
});

// ── POST /api/pro/analyze ─────────────────────────────────────
// Triggers a BanproofEngine workflow instance.
// Requires valid JWT auth AND passes through the Toll Booth.
app.post(
  '/api/pro/analyze',
  authMiddleware,
  tollBoothMiddleware,
  rateLimiter,
  auditLogger,
  async (c) => {
    const body = await c.req.json<{
      query: string;
    }>().catch(() => null);

    if (!body || typeof body.query !== 'string') {
      return c.json({ error: 'query (string) is required.' }, 400);
    }

    const auth = c.get('auth');
    if (!auth?.userId) {
      return c.json({ error: 'Missing or invalid user identity' }, 401);
    }

    const instance = await c.env.ENGINE.create({
      params: {
        query: body.query,
        userId: auth.userId,
        useMock: c.env.USE_MOCK === 'true'
      },
    });

    return c.json({
      workflowId: instance.id,
      poaScore: c.get('poaScore')
    }, 202);
  },
);

// ── POST /api/access/sentiment ──────────────────────────────
// Access-Controlled sentiment-only endpoint.
app.post(
  '/api/access/sentiment',
  accessControlMiddleware,
  async (c) => {
    const body = await c.req.json<{ query: string }>().catch(() => null);
    if (!body || typeof body.query !== 'string' || !body.query.trim()) {
      return c.json({ error: 'query (string) is required.' }, 400);
    }

    const accessContext = c.get('accessContext');
    if (!accessContext || !enforceRBAC(accessContext, 'pro')) {
      const status = !accessContext || accessContext.method === 'public' ? 401 : 403;
      return c.json(
        { error: "Access denied: 'pro' role required" },
        status,
      );
    }

    const workflow = new SentimentWorkflow(c.env);
    const execution = await workflow.execute(body.query.trim());
    const workflowId = `sentiment-${crypto.randomUUID()}`;

    return c.json(
      {
        workflowId,
        sentiment: execution.sentiment,
        source: execution.sourceMode,
        access: {
          tierUsed: accessContext.identity.tierLevel,
          authMethod: accessContext.method,
          minTierRequired: 'pro',
        },
      },
      202,
    );
  },
);

// ── Fallback ──────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Route not found.' }, 404));
app.onError((err, c) => {
  console.error('[banproof-core]', err);
  return c.json({ error: 'Internal server error.' }, 500);
});

// ── Exports ───────────────────────────────────────────────────
export { BanproofEngine, SubscriptionPurchaseWorkflow };

export default {
  fetch: app.fetch.bind(app),

  // ── Email handler: Cloudflare Email Routing ────────────────
  async email(
    message: EmailMessage,
    env: Bindings,
    _ctx: ExecutionContext,
  ): Promise<void> {
    if (!env.EMAIL_ROUTER || typeof env.EMAIL_ROUTER.fetch !== 'function') {
      message.setReject('550 Email router is not configured.');
      return;
    }

    const correlationId = crypto.randomUUID();
    const raw = await new Response(message.raw).text();

    try {
      const response = await env.EMAIL_ROUTER.fetch('https://email-router.internal/inbound-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          correlationId,
          from: message.from,
          to: message.to,
          headers: [...message.headers],
          raw,
        }),
      });

      if (!response.ok) {
        message.setReject(`550 Email dispatch failed (${response.status}).`);
      }
    } catch {
      message.setReject('550 Email dispatch failed.');
    }
  },

  // ── Queue consumer: goldshore-jobs ─────────────────────────
  async queue(
    batch: MessageBatch<QueueJobMessage>,
    env: Bindings,
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        const { type, payload } = message.body;

        switch (type) {
          case 'tier_upgraded': {
            console.log(`[Queue] tier_upgraded:`, payload);
            if (env.DISCORD_WEBHOOK) {
              const discordResponse = await fetch(env.DISCORD_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content: `🚀 **Tier Upgrade** | User \`${payload.userId}\` is now **${payload.targetTier}**!`,
                }),
              });

              if (!discordResponse.ok) {
                const errorBody = await discordResponse.text();
                throw new Error(
                  `Discord webhook failed with ${discordResponse.status} ${discordResponse.statusText}${errorBody ? `: ${errorBody}` : ''}`,
                );
              }
            }
            break;
          }

          case 'send_email': {
            if (!env.EMAIL_ROUTER) {
              throw new Error('EMAIL_ROUTER binding is missing');
            }
            await env.EMAIL_ROUTER.fetch('https://email-router.internal/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            break;
          }

          case 'sync_user': {
            console.log(`[Queue] sync_user job:`, payload);
            break;
          }

          default:
            console.warn(`[Queue] Unknown job type: ${type}`);
        }

        message.ack();
      } catch (err) {
        console.error('[Queue] Job processing failed:', err);
        message.retry();
      }
    }
  },
};
