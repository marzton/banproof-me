import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index.js';
import type { QueueJobMessage } from '../src/types/env.js';
import type { MessageBatch } from '@cloudflare/workers-types';

describe('Queue Consumer', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      ANALYTICS: {
        write: vi.fn(),
      },
      DISCORD_WEBHOOK: 'https://discord.com/api/webhooks/123',
      EMAIL_ROUTER: {
        fetch: vi.fn().mockResolvedValue(new Response('ok')),
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok')) as any;
  });

  const createBatch = (messages: any[]): MessageBatch<QueueJobMessage> => {
    return {
      messages: messages.map(m => ({
        body: m.body,
        ack: vi.fn(),
        retry: vi.fn(),
        id: 'msg-id',
        timestamp: new Date(),
      } as any)),
      queue: 'test-queue',
    } as any;
  };

  it('handles tier_upgraded job and calls discord webhook', async () => {
    const batch = createBatch([
      { body: { type: 'tier_upgraded', payload: { userId: 'user-1', targetTier: 'pro' } } }
    ]);
    await worker.queue(batch, mockEnv);

    expect(globalThis.fetch).toHaveBeenCalledWith(mockEnv.DISCORD_WEBHOOK, expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('user-1'),
    }));
    expect(batch.messages[0].ack).toHaveBeenCalled();
  });

  it('handles send_email job and calls EMAIL_ROUTER', async () => {
    const payload = { to: 'test@example.com', subject: 'hi', body: 'hello' };
    const batch = createBatch([
      { body: { type: 'send_email', payload } }
    ]);
    await worker.queue(batch, mockEnv);

    expect(mockEnv.EMAIL_ROUTER.fetch).toHaveBeenCalledWith('https://email-router.internal/send', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(payload),
    }));
    expect(batch.messages[0].ack).toHaveBeenCalled();
  });

  it('handles sync_user job (no-op)', async () => {
    const batch = createBatch([
      { body: { type: 'sync_user', payload: { userId: 'user-1' } } }
    ]);
    await worker.queue(batch, mockEnv);

    expect(batch.messages[0].ack).toHaveBeenCalled();
  });

  it('warns on unknown job type', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const batch = createBatch([
      { body: { type: 'unknown_job', payload: {} } }
    ]);
    await worker.queue(batch, mockEnv);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown job type: unknown_job'));
    expect(batch.messages[0].ack).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('retries on handler error', async () => {
    mockEnv.EMAIL_ROUTER.fetch.mockRejectedValue(new Error('fetch failed'));
    const batch = createBatch([
      { body: { type: 'send_email', payload: {} } }
    ]);
    await worker.queue(batch, mockEnv);

    expect(batch.messages[0].retry).toHaveBeenCalled();
  });

  it('retries if EMAIL_ROUTER is missing for send_email', async () => {
    delete mockEnv.EMAIL_ROUTER;
    const batch = createBatch([
      { body: { type: 'send_email', payload: {} } }
    ]);
    await worker.queue(batch, mockEnv);

    expect(batch.messages[0].retry).toHaveBeenCalled();
  });
});
