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
    // Fail open (graceful degradation) for public routes
    console.error('Graceful degradation on public route:', err);
    const exposeDetailedErrors = process.env.NODE_ENV !== 'production';
    const errorMessage = exposeDetailedErrors ? String(err) : 'Internal Server Error';
    return c.json({ ok: false, warning: 'Service degraded but running.', error: errorMessage }, 200);
  }
};
