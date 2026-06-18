import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./tierUpgraded.js', () => ({
  handleTierUpgraded: vi.fn(),
}));
vi.mock('./sendEmail.js', () => ({
  handleSendEmail: vi.fn(),
}));
vi.mock('./syncUser.js', () => ({
  handleSyncUser: vi.fn(),
}));

import { handleJob } from './index.js';
import { handleTierUpgraded } from './tierUpgraded.js';
import { handleSendEmail } from './sendEmail.js';
import { handleSyncUser } from './syncUser.js';

describe('jobs/handleJob', () => {
  const env = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches tier_upgraded jobs to handleTierUpgraded', async () => {
    const payload = { userId: 'u1', targetTier: 'pro' };
    await handleJob('tier_upgraded', payload, env);
    expect(handleTierUpgraded).toHaveBeenCalledWith(payload, env);
  });

  it('dispatches send_email jobs to handleSendEmail', async () => {
    const payload = { to: 'a@b.com', subject: 'x', body: 'y' };
    await handleJob('send_email', payload, env);
    expect(handleSendEmail).toHaveBeenCalledWith(payload, env);
  });

  it('dispatches sync_user jobs to handleSyncUser', async () => {
    const payload = { userId: 'u1' };
    await handleJob('sync_user', payload, env);
    expect(handleSyncUser).toHaveBeenCalledWith(payload, env);
  });

  it('warns and returns for unknown job types', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await handleJob('unknown_job', { any: 'payload' }, env);
    expect(warnSpy).toHaveBeenCalledWith('[Queue] Unknown job type: unknown_job');
    expect(handleTierUpgraded).not.toHaveBeenCalled();
    expect(handleSendEmail).not.toHaveBeenCalled();
    expect(handleSyncUser).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
