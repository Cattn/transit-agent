import { describe, it, expect, vi, afterEach } from 'vitest';
import { createApiClient, sections } from './index.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sections', () => {
  it('lists section ids in order', () => {
    expect(sections.map((s) => s.id)).toEqual(['flight', 'commute', 'biking', 'agent']);
  });
});

describe('createApiClient', () => {
  it('strips trailing slash from the base url', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'ok', service: 't' })));
    vi.stubGlobal('fetch', fetchMock);
    await createApiClient('http://x/').health();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('http://x/api/health');
  });

  it('rejects on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    await expect(createApiClient('http://x').health()).rejects.toThrow(/500/);
  });
});
