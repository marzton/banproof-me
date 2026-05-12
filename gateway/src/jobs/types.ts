import type { Bindings } from '../types/env.js';

export type JobHandler<T = any> = (
  payload: T,
  env: Bindings,
) => Promise<void>;

export interface TierUpgradedPayload {
  userId: string;
  targetTier: string;
  correlationId?: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
  correlationId?: string;
  triggeredBy?: string;
}

export interface SyncUserPayload {
  userId: string;
  correlationId?: string;
}
