import type { Workflow, Ai, R2Bucket } from '@cloudflare/workers-types';
import type { AuthContext } from './api.js';
import type { AccessContext } from './access.js';

export type QueueJobMessage = {
  /** Discriminates the job variant (e.g. 'sync_user', 'send_email'). */
  type: string;
  payload: Record<string, unknown>;
};

export type Bindings = {
  DB:                D1Database;
  CACHE:             KVNamespace;
  INFRA_SECRETS:     KVNamespace;
  ENGINE:            Workflow;
  PURCHASE_WORKFLOW: Workflow;
  STORAGE:           R2Bucket;
  AI:                Ai;
  ENVIRONMENT:       string;
  USE_MOCK:          string;
  JWT_SECRET:        string;
  CORS_ORIGINS?:     string;
  HF_API_TOKEN?:     string;
  ODDS_API_KEY?:     string;
  DISCORD_WEBHOOK?:  string;
  /** Service binding → saas-admin-template-customer-workflow */
  WORKFLOW:          Fetcher;
  /** Service binding → banproof-email-router */
  EMAIL_ROUTER:      Fetcher;
  /** direct email binding */
  SEND_EMAIL?:       { send: (msg: any) => Promise<void> };
  /** Analytics Engine */
  ANALYTICS?:        { write: (data: any) => void };
  /** Queue producer → goldshore-jobs */
  QUEUE:             Queue<QueueJobMessage>;

  // Cloudflare Access / SSO
  CF_ACCESS_AUDIENCE?:      string;
  CF_ZERO_EDGE_PUBLIC_KEY?: string;
  TRUSTED_ADMIN_IPS?:       string;
};

export type Variables = {
  auth?:          AuthContext;
  poaScore?:      number;
  accessContext?: AccessContext;
  // userId is set by tollBooth but seemingly unused downstream as a Hono variable
  userId?:        string;
};

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
  correlationId?: string;
  triggeredBy?: string;
};
