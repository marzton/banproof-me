import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from 'cloudflare:workers'

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
/**
 * banproof-me — Proof of Agency gateway + content processing
 * 
 * Routes:
 *   GET  /health         → status
 *   GET  /               → serve public site via ASSETS binding
 *   POST /api/contact    → contact form → PLATFORM_DB + AUDIT_DB
 *   POST /api/poa/submit → submit content for AI analysis workflow
 *   GET  /api/poa/:id    → get workflow status
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

export interface Env {
  ASSETS: Fetcher;
  GS_CONFIG: KVNamespace;
  PLATFORM_DB: D1Database;
  AUDIT_DB: D1Database;
  MEDIA_STORE: R2Bucket;
  CONTENT_WORKFLOW: Workflow;
  GS_EVENTS: Queue;
  ENV: string;
  POA_TOKEN: string;
  AUDIT_TOKEN: string;
  OPENAI_API_KEY: string;
}

type WorkflowParams = {
  jobId: string;
  contentType: 'media' | 'text' | 'sentiment';
  sourceKey?: string;
  payload?: string;
  submittedBy?: string;
};

/**
 * ContentProcessingWorkflow — durable AI/sentiment processing pipeline
 * Steps: ingest → AI analysis → sentiment score → audit record
 */
export class ContentProcessingWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { jobId, contentType, payload } = event.payload;

    // Step 1: Ingest and validate content
    const ingested = await step.do('ingest', async () => {
      return {
        jobId,
        contentType,
        ingestedAt: new Date().toISOString(),
        size: payload?.length ?? 0,
      };
    });

    // Step 2: AI analysis (OpenAI or Workers AI)
    const analysis = await step.do('ai-analysis', { retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' } }, async () => {
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
            { role: 'system', content: 'You are a content sentiment analyzer. Respond with JSON only: {"sentiment":"positive|neutral|negative","score":0.0-1.0,"summary":"brief"}' },
            { role: 'user', content: payload ?? 'No content provided.' },
          ],
          max_tokens: 200,
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
      const data = await res.json<{ choices: Array<{ message: { content: string } }> }>();
      return JSON.parse(data.choices[0].message.content);
    });

    // Step 3: Write Proof of Agency record to D1
    await step.do('poa-record', async () => {
      await this.env.AUDIT_DB.prepare(
        `INSERT OR IGNORE INTO worker_audit (id, ts, worker, action, result, detail)
         VALUES (?, datetime('now'), 'banproof-me', 'poa_record', 'ok', ?)`
      ).bind(jobId, JSON.stringify({ ingested, analysis })).run();
    });

    return { jobId, ingested, analysis };
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function handleContactForm(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  let fd: FormData;
  try { fd = await request.formData(); }
  catch { return json({ ok: false, error: 'Invalid form data' }, 400); }

  const name = (fd.get('name') ?? '').toString().trim();
  const email = (fd.get('email') ?? '').toString().trim();
  const message = (fd.get('message') ?? '').toString().trim();
  const formType = (fd.get('formType') ?? 'armsway-inquiry').toString();

  if (!name || !email || !message) return json({ ok: false, error: 'Missing required fields' }, 422);

  const id = crypto.randomUUID();
  try {
    await env.PLATFORM_DB.prepare(
      `INSERT INTO lead_submissions (id, form_type, name, email, message, status, received_at, ip_address)
       VALUES (?, ?, ?, ?, ?, 'new', datetime('now'), ?)`
    ).bind(id, formType, name, email, message, request.headers.get('CF-Connecting-IP') ?? null).run();
  } catch (e) {
    console.error('DB insert failed:', e);
  }

  return json({ ok: true, submissionId: id });
}

async function handlePoASubmit(request: Request, env: Env): Promise<Response> {
  let body: WorkflowParams;
  try { body = await request.json<WorkflowParams>(); }
  catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

  const jobId = body.jobId ?? crypto.randomUUID();
  const instance = await env.CONTENT_WORKFLOW.create({ id: jobId, params: { ...body, jobId } });
  return json({ ok: true, jobId: instance.id, status: await instance.status() });
}

async function handlePoAStatus(jobId: string, env: Env): Promise<Response> {
  try {
    const instance = await env.CONTENT_WORKFLOW.get(jobId);
    return json({ ok: true, jobId, status: await instance.status() });
  } catch {
    return json({ ok: false, error: 'Job not found' }, 404);
  }
}

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
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS headers for API routes
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://banproof.me',
      'Vary': 'Origin',
    };

    if (pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'banproof-me', env: env.ENV }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (pathname === '/api/contact') return handleContactForm(request, env);

    if (pathname === '/api/poa/submit' && request.method === 'POST') return handlePoASubmit(request, env);

    const poaMatch = pathname.match(/^\/api\/poa\/([^/]+)$/);
    if (poaMatch && request.method === 'GET') return handlePoAStatus(poaMatch[1], env);

    // Serve static site for all other routes
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
