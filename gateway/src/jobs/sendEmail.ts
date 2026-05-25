import type { JobHandler, SendEmailPayload } from './types.js';

export const handleSendEmail: JobHandler<SendEmailPayload> = async (
  payload,
  env,
) => {
  if (!env.EMAIL_ROUTER || typeof env.EMAIL_ROUTER.fetch !== 'function') {
    throw new Error('EMAIL_ROUTER binding is missing or invalid');
  }

  const response = await env.EMAIL_ROUTER.fetch('https://email-router.internal/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `EMAIL_ROUTER request failed with ${response.status} ${response.statusText}${errorBody ? `: ${errorBody}` : ''}`,
    );
  }
};
