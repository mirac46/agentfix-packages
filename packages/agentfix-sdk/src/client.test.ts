import { describe, expect, it, vi } from 'vitest';
import { AgentFix } from './client';
import { AgentFixAuthError } from './errors';

describe('AgentFix client', () => {
  it('sends Bearer token and posts RAG query', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://agentfix.com.tr/api/v1/rag/query');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok_test');
      expect(JSON.parse(String(init?.body))).toEqual({ query: 'saat', limit: 3 });
      return new Response(JSON.stringify({ chunks: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const af = new AgentFix({
      baseUrl: 'https://agentfix.com.tr/',
      apiToken: 'tok_test',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(af.rag.query({ query: 'saat', limit: 3 })).resolves.toEqual({ chunks: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('maps 401 to AgentFixAuthError', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'TOKEN_INVALID', code: 'TOKEN_INVALID' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const af = new AgentFix({
      baseUrl: 'https://agentfix.com.tr',
      apiToken: 'bad',
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(af.me()).rejects.toBeInstanceOf(AgentFixAuthError);
  });

  it('requires baseUrl and apiToken', () => {
    expect(() => new AgentFix({ baseUrl: '', apiToken: 'x' })).toThrow(/baseUrl/);
    expect(() => new AgentFix({ baseUrl: 'https://x', apiToken: '' })).toThrow(/apiToken/);
  });
});
