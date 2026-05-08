import type { Context, Next } from 'hono';

export const failSafeMiddleware = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (err) {
    const path = c.req.path;
    // Fail closed for Stripe-related routes
    if (path.includes('stripe') || path.includes('billing')) {
      return c.json({ ok: false, error: 'Internal Server Error - Security Abort' }, 500);
    }
    // Return a sanitized server error for public routes while logging details internally
    console.error('Graceful degradation on public route:', err);
    const runtimeEnv = (c.env as { ENVIRONMENT?: string; ENV?: string } | undefined);
    const environment = runtimeEnv?.ENVIRONMENT ?? runtimeEnv?.ENV ?? 'production';
    const exposeDetailedErrors = environment !== 'production';
    const errorMessage = exposeDetailedErrors ? String(err) : 'Internal Server Error';
    return c.json({ ok: false, warning: 'Service degraded but running.', error: errorMessage }, 200);
  }
};
