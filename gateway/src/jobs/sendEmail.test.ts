import { describe, expect, it, vi } from 'vitest';
import { handleSendEmail } from './sendEmail.js';

describe('jobs/handleSendEmail', () => {
  it('calls EMAIL_ROUTER with the expected request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const env = { EMAIL_ROUTER: { fetch: fetchMock } } as any;
    const payload = { to: 'test@example.com', subject: 'Hi', body: 'Hello' };

    await handleSendEmail(payload, env);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://email-router.internal/send',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
  });

  it('throws when EMAIL_ROUTER is missing', async () => {
    await expect(
      handleSendEmail({ to: 'x', subject: 'y', body: 'z' }, {} as any),
    ).rejects.toThrow('EMAIL_ROUTER binding is missing or invalid');
  });

  it('throws with upstream response details on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('bad request body', {
      status: 400,
      statusText: 'Bad Request',
    }));
    const env = { EMAIL_ROUTER: { fetch: fetchMock } } as any;

    await expect(
      handleSendEmail({ to: 'x', subject: 'y', body: 'z' }, env),
    ).rejects.toThrow('EMAIL_ROUTER request failed with 400 Bad Request: bad request body');
  });
});
