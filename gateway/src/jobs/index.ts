import type { Bindings } from '../types/env.js';
import { handleTierUpgraded } from './tierUpgraded.js';
import { handleSendEmail } from './sendEmail.js';
import { handleSyncUser } from './syncUser.js';
import type { JobHandler } from './types.js';

const HANDLERS: Record<string, JobHandler> = {
  tier_upgraded: handleTierUpgraded,
  send_email: handleSendEmail,
  sync_user: handleSyncUser,
};

export async function handleJob(
  type: string,
  payload: any,
  env: Bindings,
): Promise<void> {
  const handler = HANDLERS[type];

  if (!handler) {
    console.warn(`[Queue] Unknown job type: ${type}`);
    return;
  }

  await handler(payload, env);
}
