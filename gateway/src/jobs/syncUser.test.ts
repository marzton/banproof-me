import { describe, expect, it, vi } from 'vitest';
import { handleSyncUser } from './syncUser.js';

describe('jobs/handleSyncUser', () => {
  it('logs receipt of sync_user jobs', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await handleSyncUser({ userId: 'user-1' }, {} as any);

    expect(logSpy).toHaveBeenCalledWith('[Queue] sync_user job received');
    logSpy.mockRestore();
  });
});
