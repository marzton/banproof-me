import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleTierUpgraded } from './tierUpgraded.js';

describe('jobs/handleTierUpgraded', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips webhook call when DISCORD_WEBHOOK is not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await handleTierUpgraded({ userId: 'user-1', targetTier: 'pro' }, {} as any);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a formatted webhook payload when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = { DISCORD_WEBHOOK: 'https://discord.test/webhook' } as any;

    await handleTierUpgraded({ userId: 'user-1', targetTier: 'agency' }, env);

    expect(fetchMock).toHaveBeenCalledWith(
      env.DISCORD_WEBHOOK,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('user-1'),
      }),
    );
  });

  it('throws when webhook request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('error', { status: 500 })));
    const env = { DISCORD_WEBHOOK: 'https://discord.test/webhook' } as any;

    await expect(
      handleTierUpgraded({ userId: 'user-1', targetTier: 'pro' }, env),
    ).rejects.toThrow('Discord webhook failed with status 500');
  });
});
