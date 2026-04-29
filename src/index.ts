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
