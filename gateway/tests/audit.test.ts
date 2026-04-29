import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import audit from '../src/audit.js';

describe('Audit Handler', () => {
  const makeKV = (getStub = vi.fn()) => ({
    get: getStub,
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace);

  const makeCtx = () => ({
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext);

  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it('returns 404 for incorrect path', async () => {
    const req = new Request('http://localhost/not-audit');
    const env = { INFRA_SECRETS: makeKV() } as any;
    const res = await audit.fetch(req, env, makeCtx());

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Audit endpoint is /run-audit');
  });

  it('returns 500 when GH_PAT is missing in KV', async () => {
    const req = new Request('http://localhost/run-audit');
    const kvGet = vi.fn().mockResolvedValue(null);
    const env = { INFRA_SECRETS: makeKV(kvGet) } as any;

    const res = await audit.fetch(req, env, makeCtx());

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('CRITICAL ERR: GH_PAT not found in KV Namespace.');
    expect(kvGet).toHaveBeenCalledWith('GH_PAT');
  });

  it('returns 200 and audit report on happy path', async () => {
    const req = new Request('http://localhost/run-audit');
    const kvGet = vi.fn().mockResolvedValue('mock-gh-pat');
    const env = { INFRA_SECRETS: makeKV(kvGet) } as any;

    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/user/repos')) {
        return new Response(JSON.stringify([{ name: 'repo1' }, { name: 'repo2' }]), { status: 200 });
      }
      if (url.includes('/user')) {
        return new Response(JSON.stringify({ login: 'testuser' }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const res = await audit.fetch(req, env, makeCtx());

    expect(res.status).toBe(200);
    const report = await res.json() as any;
    expect(report.github.accountStatus).toBe('Authenticated as testuser');
    expect(report.github.repoCount).toBe(2);
    expect(report.cloudflare.status).toContain('Cloudflare API token not yet bound');
  });

  it('returns 500 with error message when an exception occurs (Audit Execution Failed)', async () => {
    const req = new Request('http://localhost/run-audit');
    // Mock KV to throw an error
    const kvGet = vi.fn().mockRejectedValue(new Error('KV connection failed'));
    const env = { INFRA_SECRETS: makeKV(kvGet) } as any;

    const res = await audit.fetch(req, env, makeCtx());

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Audit Execution Failed: KV connection failed');
  });

  it('handles GitHub API failures gracefully in report', async () => {
    const req = new Request('http://localhost/run-audit');
    const kvGet = vi.fn().mockResolvedValue('mock-gh-pat');
    const env = { INFRA_SECRETS: makeKV(kvGet) } as any;

    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }));

    const res = await audit.fetch(req, env, makeCtx());

    expect(res.status).toBe(200);
    const report = await res.json() as any;
    expect(report.github.accountStatus).toBe('Auth Failed');
    expect(report.github.repoCount).toBe(0);
  });
});
