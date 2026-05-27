import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSentimentResult = {
  score: 0.77,
  label: 'BULLISH',
  confidence: 0.77,
  source: 'MOCK_HF',
};

vi.mock('../mocks/huggingface.js', () => ({
  mockSentiment: vi.fn(() => mockSentimentResult),
}));

import { SentimentWorkflow } from './sentimentWorkflow.js';

describe('workflows/SentimentWorkflow', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns mock sentiment when USE_MOCK is enabled', async () => {
    const workflow = new SentimentWorkflow({ USE_MOCK: 'true' });

    const result = await workflow.execute('BTC looks strong');

    expect(result).toEqual({
      sentiment: mockSentimentResult,
      sourceMode: 'mock',
    });
  });

  it('uses live API and maps POS labels to BULLISH', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([[
      { label: 'POSITIVE', score: 0.91 },
    ]]), { status: 200 })));
    const workflow = new SentimentWorkflow({ USE_MOCK: 'false', HF_API_TOKEN: 'token' });

    const result = await workflow.execute('I am optimistic');

    expect(result.sourceMode).toBe('live');
    expect(result.sentiment.label).toBe('BULLISH');
    expect(result.sentiment.score).toBe(0.91);
    expect(result.sentiment.source).toBe('REAL_HF');
  });

  it('maps non-POS labels to BEARISH and handles empty model responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([[
      { label: 'NEGATIVE', score: 0.66 },
    ]]), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 })));
    const workflow = new SentimentWorkflow({ USE_MOCK: 'false' });

    const first = await workflow.execute('this looks weak');
    const second = await workflow.execute('no data');

    expect(first.sentiment.label).toBe('BEARISH');
    expect(first.sentiment.score).toBe(0.66);
    expect(second.sentiment.label).toBe('BEARISH');
    expect(second.sentiment.score).toBe(0.5);
  });

  it('throws when live API responds with non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', {
      status: 503,
      statusText: 'Service Unavailable',
    })));
    const workflow = new SentimentWorkflow({ USE_MOCK: 'false' });

    await expect(workflow.execute('hello')).rejects.toThrow('HuggingFace API error: 503 Service Unavailable');
  });
});
