import { describe, expect, it, vi } from 'vitest';
import { AgentFix } from './client';
import { AgentFixAuthError, AgentFixError, parseApiError } from './errors';

describe('AgentFix client', () => {
  it('sends Bearer token and posts RAG query', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.agentfix.com.tr/v1/rag/query');
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

  it('requires apiToken', () => {
    expect(() => new AgentFix({ baseUrl: 'https://x', apiToken: '' })).toThrow(/apiToken/);
  });

  it('keeps the API error code and details from { error, code, details }', async () => {
    const body = { error: 'Mesaj grubu bu akışa ait değil.', code: 'MESSAGE_BATCH_CONFLICT', details: { batchId: 'b' } };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(body), { status: 409, headers: { 'Content-Type': 'application/json' } }),
    );
    const af = new AgentFix({ apiToken: 'tok', fetch: fetchMock as unknown as typeof fetch });
    const error = await af.messageBatches.complete({ batchId: 'b', claimToken: 'c' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AgentFixError);
    expect(error).toMatchObject({ status: 409, code: 'MESSAGE_BATCH_CONFLICT', details: { batchId: 'b' } });
    expect((error as Error).message).toBe(body.error);
  });

  it('keeps the server code on auth errors', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'Kanal anahtarı geçersiz.', code: 'INVALID_CHANNEL_KEY' }), { status: 401 }),
    );
    const af = new AgentFix({ apiToken: 'bad', fetch: fetchMock as unknown as typeof fetch });
    await expect(af.platformChannel.health(3)).rejects.toMatchObject({ status: 401, code: 'INVALID_CHANNEL_KEY' });
  });

  it('parses error bodies without leaking HTML pages', () => {
    expect(parseApiError(422, { error: 'query is required' })).toEqual({
      status: 422,
      message: 'query is required',
      code: null,
    });
    expect(parseApiError(502, '<html>Bad gateway</html>').message).toBe('AgentFix API isteği başarısız (HTTP 502).');
  });
});
