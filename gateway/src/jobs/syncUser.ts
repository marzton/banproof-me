import type { JobHandler, SyncUserPayload } from './types.js';

export const handleSyncUser: JobHandler<SyncUserPayload> = async (
  _payload,
  _env,
) => {
  // Logic for user synchronization could go here
  console.log('[Queue] sync_user job received');
};
