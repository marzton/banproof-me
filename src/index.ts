import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from 'cloudflare:workers'

<<<<<<< HEAD
=======
type ContentProcessingParams = {
  contentId?: string
  source?: string
}

export class ContentProcessingWorkflow extends WorkflowEntrypoint {
  async run(
    event: WorkflowEvent<ContentProcessingParams>,
    step: WorkflowStep,
  ): Promise<{ status: string; contentId: string | null }> {
    const payload = await step.do('capture-payload', async () => {
      return {
        contentId: event.payload?.contentId ?? null,
        source: event.payload?.source ?? 'unknown',
      }
    })

    await step.do('mark-complete', async () => {
      console.log('content-processing-workflow completed', payload)
      return true
    })

    return {
      status: 'completed',
      contentId: payload.contentId,
    }
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
/**
 * banproof-me — Proof of Agency gateway + content processing
 *
 * Routes:
 *   GET  /health            → status check
 *   GET  /*                 → serve public site via ASSETS binding
 *   POST /api/contact       → contact form → PLATFORM_DB + AUDIT_DB
 *   POST /api/poa/submit    → submit content for AI analysis workflow
 *   GET  /api/poa/:id       → get workflow status
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Env {
  // Static assets
<<<<<<< HEAD
  ASSETS: Fetcher

  // KV
  GS_CONFIG: KVNamespace

  // D1
  PLATFORM_DB: D1Database
  AUDIT_DB: D1Database

  // R2
  MEDIA_STORE: R2Bucket

  // Workflow
  CONTENT_WORKFLOW: Workflow

  // Queue (producer)
  GS_EVENTS: Queue<QueueJobMessage>

  // Service bindings (optional — not guaranteed in all environments)
  EMAIL_ROUTER?: Fetcher

  // Email binding
  SEND_EMAIL?: SendEmail

  // Analytics Engine
  ANALYTICS?: AnalyticsEngineDataset

  // Env vars
  ENV: string
  POA_TOKEN: string
  AUDIT_TOKEN: string
  OPENAI_API_KEY?: string
  DISCORD_WEBHOOK?: string
}

/** Shape of messages pushed to / consumed from the goldshore-jobs queue */
type QueueJobMessage = {
  type: 'tier_upgraded' | 'send_email' | 'sync_user' | string
  payload: Record<string, unknown>
=======
  ASSETS: Fetcher;

  // KV
  GS_CONFIG: KVNamespace;

  // D1
  PLATFORM_DB: D1Database;
  AUDIT_DB: D1Database;

  // R2
  MEDIA_STORE: R2Bucket;

  // Workflow
  CONTENT_WORKFLOW: Workflow;

  // Queue (producer)
  GS_EVENTS: Queue<QueueJobMessage>;

  // Service bindings (optional — not guaranteed in all environments)
  EMAIL_ROUTER?: Fetcher;
  SEND_EMAIL?: { send: (msg: any) => Promise<void> };
  ANALYTICS?: { write: (data: any) => void };

  // Email binding
  SEND_EMAIL?: SendEmail;

  // Analytics Engine — typed as AnalyticsEngineDataset, not a custom type
  ANALYTICS?: AnalyticsEngineDataset;

  // Env vars
  ENV: string;
  POA_TOKEN: string;
  AUDIT_TOKEN: string;
  OPENAI_API_KEY?: string;
  DISCORD_WEBHOOK?: string;
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
}

/** Shape of messages pushed to / consumed from the goldshore-jobs queue */
type QueueJobMessage = {
  type: 'tier_upgraded' | 'send_email' | 'sync_user' | string;
  payload: Record<string, unknown>;
};

type WorkflowParams = {
  jobId: string
  contentType: 'media' | 'text' | 'sentiment'
  sourceKey?: string
  payload?: string
  submittedBy?: string
}

type SentimentResult = {
  sentiment: 'positive' | 'neutral' | 'negative'
  score: number
  summary: string
}

type WorkflowResult = {
  jobId: string
  ingested: Record<string, unknown>
  analysis: SentimentResult | { score: null; reason: string }
}

// ---------------------------------------------------------------------------
// Workflow — durable AI/sentiment processing pipeline
// ---------------------------------------------------------------------------

<<<<<<< HEAD
=======
type SentimentResult = {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  summary: string;
};

// ---------------------------------------------------------------------------
// Workflow — durable AI/sentiment processing pipeline
// ---------------------------------------------------------------------------

>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
export class ContentProcessingWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(
    event: WorkflowEvent<WorkflowParams>,
    step: WorkflowStep
  ): Promise<WorkflowResult> {
    const { jobId, contentType, payload } = event.payload

<<<<<<< HEAD
=======
    // Step 1: Ingest and validate content
    // Step 1: Ingest and validate
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
    const ingested = await step.do('ingest', async () => {
      return {
        jobId,
        contentType,
        ingestedAt: new Date().toISOString(),
        size: payload?.length ?? 0,
      }
    })

    const analysis = await step.do<SentimentResult | { score: null; reason: string }>(
      'ai-analysis',
      {
        retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
        timeout: '2 minutes',
      },
      async () => {
        if (!this.env.OPENAI_API_KEY) return { score: null, reason: 'no_api_key' }

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You are a content sentiment analyzer. Respond with JSON only: {"sentiment":"positive|neutral|negative","score":0.0-1.0,"summary":"brief"}',
              },
              { role: 'user', content: payload ?? 'No content provided.' },
            ],
            max_tokens: 200,
            response_format: { type: 'json_object' },
          }),
        })

        if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)

        const data = await res.json<{ choices?: Array<{ message?: { content?: string } }> }>()
        const content = data?.choices?.[0]?.message?.content
        if (typeof content !== 'string') {
          throw new Error('OpenAI response missing content')
        }

        let parsed: unknown
        try {
          parsed = JSON.parse(content)
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          throw new Error(`OpenAI response was not valid JSON: ${reason}`)
        }

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('OpenAI response shape invalid')
        }

        const sentiment = (parsed as { sentiment?: unknown }).sentiment
        const score = (parsed as { score?: unknown }).score
        const summary = (parsed as { summary?: unknown }).summary

        if (
          (sentiment !== 'positive' && sentiment !== 'neutral' && sentiment !== 'negative') ||
          typeof score !== 'number' ||
          typeof summary !== 'string'
        ) {
          throw new Error('OpenAI response fields invalid')
        }

        return { sentiment, score, summary }
      }
    )

<<<<<<< HEAD
=======
    // Step 3: Write Proof of Agency record to D1
    // Step 2: AI sentiment analysis via OpenAI
    const analysis = await step.do<SentimentResult | { score: null; reason: string }>(
      'ai-analysis',
      {
        retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
        timeout: '2 minutes',
      },
      async () => {
        if (!this.env.OPENAI_API_KEY) return { score: null, reason: 'no_api_key' };

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You are a content sentiment analyzer. Respond with JSON only: {"sentiment":"positive|neutral|negative","score":0.0-1.0,"summary":"brief"}',
              },
              { role: 'user', content: payload ?? 'No content provided.' },
            ],
            max_tokens: 200,
            response_format: { type: 'json_object' },
          }),
        });

        if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);

        const data = await res.json<{ choices: Array<{ message: { content: string } }> }>();
        return JSON.parse(data.choices[0].message.content) as SentimentResult;
      }
    );

    // Step 3: Write Proof of Agency record to AUDIT_DB
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
    await step.do('poa-record', async () => {
      await this.env.AUDIT_DB.prepare(
        `INSERT OR IGNORE INTO worker_audit (id, ts, worker, action, result, detail)
         VALUES (?, datetime('now'), 'banproof-me', 'poa_record', 'ok', ?)`
      )
        .bind(jobId, JSON.stringify({ ingested, analysis }))
        .run()
    })

    return { jobId, ingested, analysis }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

<<<<<<< HEAD
function json(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
=======
function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
<<<<<<< HEAD
  })
=======
  });
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': 'https://banproof.me',
<<<<<<< HEAD
  Vary: 'Origin',
}
=======
  'Vary': 'Origin',
};
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22

function handleCorsPreFlight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
<<<<<<< HEAD
      ...CORS_HEADERS,
=======
      'Access-Control-Allow-Origin': 'https://banproof.me',
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
<<<<<<< HEAD
  })
=======
  });
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleContactForm(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return handleCorsPreFlight()
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405, CORS_HEADERS)
  }

<<<<<<< HEAD
  let fd: FormData
  try {
    fd = await request.formData()
  } catch {
    return json({ ok: false, error: 'Invalid form data' }, 400, CORS_HEADERS)
  }

  const name = (fd.get('name') ?? '').toString().trim()
  const email = (fd.get('email') ?? '').toString().trim()
  const message = (fd.get('message') ?? '').toString().trim()
  const formType = (fd.get('formType') ?? 'armsway-inquiry').toString()

  if (!name || !email || !message) {
    return json(
      { ok: false, error: 'Missing required fields: name, email, message' },
      422,
      CORS_HEADERS
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'Invalid email address' }, 422, CORS_HEADERS)
  }

  const id = crypto.randomUUID()
  const ip = request.headers.get('CF-Connecting-IP') ?? null

=======
  let fd: FormData;
  try { fd = await request.formData(); }
  catch { return json({ ok: false, error: 'Invalid form data' }, 400); }
  if (request.method === 'OPTIONS') return handleCorsPreFlight();
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405, CORS_HEADERS);

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return json({ ok: false, error: 'Invalid form data' }, 400, CORS_HEADERS);
  }

  const name    = (fd.get('name')     ?? '').toString().trim();
  const email   = (fd.get('email')    ?? '').toString().trim();
  const message = (fd.get('message')  ?? '').toString().trim();
  const formType = (fd.get('formType') ?? 'armsway-inquiry').toString();

  if (!name || !email || !message) return json({ ok: false, error: 'Missing required fields' }, 422);
  if (!name || !email || !message) {
    return json({ ok: false, error: 'Missing required fields: name, email, message' }, 422, CORS_HEADERS);
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'Invalid email address' }, 422, CORS_HEADERS);
  }

  const id = crypto.randomUUID();
  const ip = request.headers.get('CF-Connecting-IP') ?? null;

>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
  try {
    await env.PLATFORM_DB.prepare(
      `INSERT INTO lead_submissions (id, form_type, name, email, message, status, received_at, ip_address)
       VALUES (?, ?, ?, ?, ?, 'new', datetime('now'), ?)`
<<<<<<< HEAD
    )
      .bind(id, formType, name, email, message, ip)
      .run()
  } catch (error) {
    console.error('[contact] DB insert failed:', error)
  }

=======
    ).bind(id, formType, name, email, message, ip).run();
  } catch (e) {
    console.error('[contact] DB insert failed:', e);
    // Non-fatal — still return success to avoid leaking internal errors
  }

  // Emit analytics event (non-blocking — do NOT await)
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
  env.ANALYTICS?.writeDataPoint({
    doubles: [1],
    blobs: [formType, 'contact_form_submit'],
    indexes: [email],
<<<<<<< HEAD
  })

  return json({ ok: true, submissionId: id }, 200, CORS_HEADERS)
=======
  });

  return json({ ok: true, submissionId: id }, 200, CORS_HEADERS);
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
}

async function handlePoASubmit(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return handleCorsPreFlight()
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405, CORS_HEADERS)
  }

<<<<<<< HEAD
  let body: Partial<WorkflowParams>
  try {
    body = await request.json<Partial<WorkflowParams>>()
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400, CORS_HEADERS)
  }

  if (!body.contentType) {
    return json(
      { ok: false, error: 'Missing required field: contentType' },
      422,
      CORS_HEADERS
    )
  }

  const jobId = body.jobId ?? crypto.randomUUID()
=======
  const jobId = body.jobId ?? crypto.randomUUID();
  const instance = await env.CONTENT_WORKFLOW.create({ id: jobId, params: { ...body, jobId } });
  return json({ ok: true, jobId: instance.id, status: await instance.status() });
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405, CORS_HEADERS);

  let body: Partial<WorkflowParams>;
  try {
    body = await request.json<Partial<WorkflowParams>>();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400, CORS_HEADERS);
  }

  if (!body.contentType) {
    return json({ ok: false, error: 'Missing required field: contentType' }, 422, CORS_HEADERS);
  }

  const jobId = body.jobId ?? crypto.randomUUID();
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22

  try {
    const instance = await env.CONTENT_WORKFLOW.create({
      id: jobId,
      params: { ...body, jobId } as WorkflowParams,
<<<<<<< HEAD
    })

    return json(
      { ok: true, jobId: instance.id, status: await instance.status() },
      202,
      CORS_HEADERS
    )
  } catch (error) {
    console.error('[poa/submit] Workflow create failed:', error)
    return json({ ok: false, error: 'Failed to start workflow' }, 500, CORS_HEADERS)
=======
    });

    return json({ ok: true, jobId: instance.id, status: await instance.status() }, 202, CORS_HEADERS);
  } catch (e) {
    console.error('[poa/submit] Workflow create failed:', e);
    return json({ ok: false, error: 'Failed to start workflow' }, 500, CORS_HEADERS);
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
  }
}

async function handlePoAStatus(jobId: string, env: Env): Promise<Response> {
  try {
<<<<<<< HEAD
    const instance = await env.CONTENT_WORKFLOW.get(jobId)
    return json({ ok: true, jobId, status: await instance.status() }, 200, CORS_HEADERS)
  } catch {
    return json({ ok: false, error: 'Job not found' }, 404, CORS_HEADERS)
=======
    const instance = await env.CONTENT_WORKFLOW.get(jobId);
    return json({ ok: true, jobId, status: await instance.status() }, 200, CORS_HEADERS);
  } catch {
    return json({ ok: false, error: 'Job not found' }, 404, CORS_HEADERS);
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
  }
}

// ---------------------------------------------------------------------------
// Main fetch handler + queue consumer
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/health') {
      return new Response('ok', { status: 200 })
    }

    return new Response('banproof-me worker online', {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  },
}
  async fetch(request: Request, env: Env): Promise<Response> {
<<<<<<< HEAD
    const url = new URL(request.url)
    const { pathname, method } = url

    if (method === 'OPTIONS') return handleCorsPreFlight()
=======
    const url = new URL(request.url);
    const { pathname, method } = url;

    // CORS headers for API routes
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://banproof.me',
      'Vary': 'Origin',
    };
    // Preflight
    if (method === 'OPTIONS') return handleCorsPreFlight();
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22

    // Health
    if (pathname === '/health') {
<<<<<<< HEAD
      return json({ ok: true, service: 'banproof-me', env: env.ENV }, 200, CORS_HEADERS)
    }

    if (pathname === '/api/contact') {
      return handleContactForm(request, env)
    }

    if (pathname === '/api/poa/submit') {
      return handlePoASubmit(request, env)
    }

    const poaMatch = pathname.match(/^\/api\/poa\/([a-zA-Z0-9_-]+)$/)
    if (poaMatch && method === 'GET') {
      return handlePoAStatus(poaMatch[1], env)
    }

    return env.ASSETS.fetch(request)
=======
      return json({ ok: true, service: 'banproof-me', env: env.ENV }, 200, corsHeaders);
    }

    // API routes
    if (pathname === '/api/contact') {
      return handleContactForm(request, env);
    }

    if (pathname === '/api/poa/submit' && request.method === 'POST') return handlePoASubmit(request, env);
    if (pathname === '/api/poa/submit') {
      return handlePoASubmit(request, env);
    }

    const poaMatch = pathname.match(/^\/api\/poa\/([a-zA-Z0-9_-]+)$/);
    if (poaMatch && method === 'GET') {
      return handlePoAStatus(poaMatch[1], env);
    }

    // Serve static site for all other routes
    // Fallthrough → static SPA
    return env.ASSETS.fetch(request);
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
  },

  async queue(batch: MessageBatch<QueueJobMessage>, env: Env): Promise<void> {
    await Promise.allSettled(
      batch.messages.map(async (message) => {
<<<<<<< HEAD
        const { type, payload } = message.body
        try {
          const correlationId =
            typeof payload?.correlationId === 'string'
              ? payload.correlationId
              : undefined
          console.log(`[queue] Processing job: ${type}`, { correlationId })

          env.ANALYTICS?.writeDataPoint({
            doubles: [1],
            blobs: [type, JSON.stringify(payload)],
            indexes: [type],
          })

          switch (type) {
            case 'tier_upgraded': {
              if (env.DISCORD_WEBHOOK) {
                const userId =
                  typeof payload.userId === 'string' ? payload.userId : 'unknown'
                const targetTier =
                  typeof payload.targetTier === 'string' ? payload.targetTier : 'unknown'
                await fetch(env.DISCORD_WEBHOOK, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    content: `🚀 **Tier Upgrade** | User \`${userId}\` is now **${targetTier}**!`,
                  }),
                })
              }
              break
            }

            case 'send_email': {
              if (!env.EMAIL_ROUTER) {
                throw new Error('EMAIL_ROUTER service binding is not configured')
              }
              await env.EMAIL_ROUTER.fetch('https://email-router.internal/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              })
              break
=======
        try {
          const { type, payload } = message.body;
          console.log(`[Queue] Processing job: ${type}`, payload);

          // Record event in analytics
          if (env.ANALYTICS) {
            env.ANALYTICS.write({
              doubles: [1],
              blobs: [type, JSON.stringify(payload)],
            });
          }

          switch (type) {
            case 'tier_upgraded':
              if (env.DISCORD_WEBHOOK) {
                await fetch(env.DISCORD_WEBHOOK, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    content: `🚀 **Tier Upgrade** | User \`${payload.userId}\` is now **${payload.targetTier}**!`,
                  }),
                });
              }
              break;

            case 'send_email':
              if (!env.EMAIL_ROUTER) {
                throw new Error('EMAIL_ROUTER binding is missing');
              }
              await env.EMAIL_ROUTER.fetch('https://email-router.internal/send', {
    for (const message of batch.messages) {
      const { type, payload } = message.body;

      try {
        const { type, payload } = message.body;
        const correlationId =
          typeof payload?.correlationId === 'string' ? payload.correlationId : undefined;
        console.log(`[Queue] Processing job: ${type}`, { correlationId });

        // Record event in analytics
        if (env.ANALYTICS) {
          env.ANALYTICS.writeDataPoint({
            doubles: [1],
            blobs: [type, JSON.stringify(payload)],
          });
        }
        console.log(`[queue] Processing: ${type}`, payload);

        // Emit analytics (non-blocking)
        env.ANALYTICS?.writeDataPoint({
          doubles: [1],
          blobs: [type, JSON.stringify(payload)],
          indexes: [type],
        });

        switch (type) {
          case 'tier_upgraded': {
            if (env.DISCORD_WEBHOOK) {
              await fetch(env.DISCORD_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              break;

            case 'sync_user':
              // Logic for user synchronization could go here
              break;

            default:
              console.warn(`[Queue] Unhandled job type: ${type}`);
          }

          message.ack();
        } catch (err) {
          console.error('[Queue] Error processing message:', err);
          message.retry();
        }
      })
    );
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
            }

<<<<<<< HEAD
            case 'sync_user': {
              const userId =
                typeof payload.userId === 'string' ? payload.userId : 'unknown'
              console.log(`[queue] sync_user for userId=${userId}`)
              break
=======
          case 'send_email':
          }

          case 'send_email': {
            if (!env.EMAIL_ROUTER) {
              throw new Error('EMAIL_ROUTER service binding is not configured');
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
            }

            default:
              console.warn(`[queue] Unhandled job type: ${type}`)
          }

<<<<<<< HEAD
          message.ack()
        } catch (error) {
          console.error(`[queue] Error processing message type="${type}":`, error)
          message.retry()
        }
      })
    )
=======
          default:
            console.warn(`[Queue] Unhandled job type: ${type}`);
          }

          case 'sync_user': {
            // Placeholder: implement user sync logic here
            console.log(`[queue] sync_user for userId=${payload.userId}`);
            break;
          }

          default:
            console.warn(`[queue] Unhandled job type: ${type}`);
        }

        message.ack();
      } catch (err) {
        console.error(`[queue] Error processing message type="${type}":`, err);
        message.retry();
      }
    }
>>>>>>> origin/codex/fix-wrangler.toml-configuration-errors-2026-05-22
  },
} satisfies ExportedHandler<Env>
