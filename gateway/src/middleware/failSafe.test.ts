import { describe, expect, it, vi } from 'vitest';
import { failSafeMiddleware } from './failSafe.js';

function createContext(path: string, env: Record<string, unknown> = {}) {
  return {
    req: { path },
    env,
    json: vi.fn((payload, status) => new Response(JSON.stringify(payload), { status })),
  } as any;
}

describe('middleware/failSafe', () => {
  it('passes through when downstream succeeds', async () => {
    const c = createContext('/api/public');
    const next = vi.fn().mockResolvedValue(undefined);

    const result = await failSafeMiddleware(c, next);

    expect(next).toHaveBeenCalledOnce();
    expect(c.json).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('fails closed for stripe or billing paths', async () => {
    const c = createContext('/api/stripe/webhook');
    const next = vi.fn().mockRejectedValue(new Error('boom'));

    const response = await failSafeMiddleware(c, next);
    const body = await (response as Response).json() as any;

    expect((response as Response).status).toBe(500);
    expect(body).toEqual({ ok: false, error: 'Internal Server Error - Security Abort' });
  });

  it('returns sanitized graceful response in production', async () => {
    const c = createContext('/api/public', { ENVIRONMENT: 'production' });
    const next = vi.fn().mockRejectedValue(new Error('sensitive details'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await failSafeMiddleware(c, next);
    const body = await (response as Response).json() as any;

    expect((response as Response).status).toBe(200);
    expect(body).toEqual({
      ok: false,
      warning: 'Service degraded but running.',
      error: 'Internal Server Error',
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('exposes error details in non-production environments', async () => {
    const c = createContext('/api/public', { ENV: 'staging' });
    const next = vi.fn().mockRejectedValue('failure object');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await failSafeMiddleware(c, next);
    const body = await (response as Response).json() as any;

    expect((response as Response).status).toBe(200);
    expect(body.error).toBe('failure object');
    errorSpy.mockRestore();
  });
});
