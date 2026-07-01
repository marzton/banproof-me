import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from 'cloudflare:workers'

// ============================================================================
// Types
// ============================================================================

export interface Env {
  ASSETS: Fetcher
  GS_CONFIG: KVNamespace
  PLATFORM_DB: D1Database
  AUDIT_DB: D1Database
  MEDIA_STORE: R2Bucket
  CONTENT_WORKFLOW: Workflow
  GS_EVENTS: Queue<QueueJobMessage>
  EMAIL_ROUTER?: Fetcher
  SEND_EMAIL?: SendEmail
  ANALYTICS?: AnalyticsEngineDataset
  ENV: string
  POA_TOKEN?: string
  AUDIT_TOKEN?: string
  OPENAI_API_KEY?: string
  DISCORD_WEBHOOK?: string
}

type QueueJobMessage = {
  type: 'tier_upgraded' | 'send_email' | 'sync_user' | string
  payload: Record<string, unknown>
}

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

// ============================================================================
// ContentProcessingWorkflow — durable AI/sentiment processing pipeline
// ============================================================================

export class ContentProcessingWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(
    event: WorkflowEvent<WorkflowParams>,
    step: WorkflowStep
  ): Promise<WorkflowResult> {
    const { jobId, contentType, payload } = event.payload

    // Step 1: Ingest and validate content
    const ingested = await step.do('ingest', async () => {
      return {
        jobId,
        contentType,
        ingestedAt: new Date().toISOString(),
        size: payload?.length ?? 0,
      }
    })

    // Step 2: AI sentiment analysis via OpenAI
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

    // Step 3: Write Proof of Agency record to AUDIT_DB
    await step.do('poa-record', async () => {
      await this.env.AUDIT_DB.prepare(
        `INSERT OR IGNORE INTO worker_audit (id, ts, worker, action, result, detail)
         VALUES (?, datetime('now'), 'banproof-me', 'poa_record', 'ok', ?)`
      ).bind(jobId, JSON.stringify({ ingested, analysis })).run()
    })

    return { jobId, ingested, analysis }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': 'https://banproof.me',
  'Vary': 'Origin',
}

function handleCorsPreFlight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://banproof.me',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

// ============================================================================
// Route Handlers
// ============================================================================

async function handleContactForm(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return handleCorsPreFlight()
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405, CORS_HEADERS)
  }

  let fd: FormData
  try {
    fd = await request.formData()
  } catch {
    return json({ ok: false, error: 'Invalid form data' }, 400, CORS_HEADERS)
  }

  const name = (fd.get('name') ?? '').toString().trim()
  const email = (fd.get('email') ?? '').toString().trim()
  const message = (fd.get('message') ?? '').toString().trim()
  const formType = (fd.get('formType') ?? 'contact-inquiry').toString()

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

  try {
    await env.PLATFORM_DB.prepare(
      `INSERT INTO lead_submissions (id, form_type, name, email, message, status, received_at, ip_address)
       VALUES (?, ?, ?, ?, ?, 'new', datetime('now'), ?)`
    ).bind(id, formType, name, email, message, ip).run()
  } catch (e) {
    console.error('[contact] DB insert failed:', e)
  }

  return json({ ok: true, submissionId: id }, 200, CORS_HEADERS)
}

async function handlePoASubmit(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return handleCorsPreFlight()
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405, CORS_HEADERS)
  }

  let body: Partial<WorkflowParams>
  try {
    body = await request.json<Partial<WorkflowParams>>()
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400, CORS_HEADERS)
  }

  if (!body.contentType) {
    return json({ ok: false, error: 'Missing required field: contentType' }, 422, CORS_HEADERS)
  }

  const jobId = body.jobId ?? crypto.randomUUID()

  try {
    const instance = await env.CONTENT_WORKFLOW.create({
      id: jobId,
      params: { ...body, jobId } as WorkflowParams,
    })

    return json(
      { ok: true, jobId: instance.id, status: await instance.status() },
      202,
      CORS_HEADERS
    )
  } catch (error) {
    console.error('[poa/submit] Workflow create failed:', error)
    return json({ ok: false, error: 'Failed to start workflow' }, 500, CORS_HEADERS)
  }
}

async function handlePoAStatus(jobId: string, env: Env): Promise<Response> {
  try {
    const instance = await env.CONTENT_WORKFLOW.get(jobId)
    return json({ ok: true, jobId, status: await instance.status() }, 200, CORS_HEADERS)
  } catch {
    return json({ ok: false, error: 'Job not found' }, 404, CORS_HEADERS)
  }
}

// ============================================================================
// Main fetch handler
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname, method } = url

    // Preflight
    if (method === 'OPTIONS') return handleCorsPreFlight()

    // Health check
    if (pathname === '/health') {
      return json({ ok: true, service: 'banproof-me', env: env.ENV }, 200, CORS_HEADERS)
    }

    // Contact form
    if (pathname === '/api/contact') {
      return handleContactForm(request, env)
    }

    // Proof of Agency submit
    if (pathname === '/api/poa/submit') {
      return handlePoASubmit(request, env)
    }

    // Proof of Agency status
    const poaMatch = pathname.match(/^\/api\/poa\/([a-zA-Z0-9_-]+)$/)
    if (poaMatch && method === 'GET') {
      return handlePoAStatus(poaMatch[1], env)
    }

    // Serve static site via ASSETS binding for all other routes
    return env.ASSETS.fetch(request)
  },
}
