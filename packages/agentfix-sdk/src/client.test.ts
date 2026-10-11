import { describe, expect, it, vi } from 'vitest';
import { AgentFix } from './client';
import {
  AgentFixAuthError,
  AgentFixError,
  AgentFixNotFoundError,
  AgentFixValidationError,
  parseApiError,
} from './errors';

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

  it('reads contact context with the channel key and an encoded contact', async () => {
    const context = { contact: '+905551112233', channelKind: 'whatsapp', user: null, lead: null, recentRequests: [] };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.agentfix.com.tr/v1/platform/channels/3/contacts/%2B905551112233/context');
      expect(init?.method).toBe('GET');
      expect(init?.body).toBeUndefined();
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer afp_test');
      return new Response(JSON.stringify(context), { status: 200 });
    });
    const af = new AgentFix({ apiToken: 'afp_test', fetch: fetchMock as unknown as typeof fetch });
    await expect(af.platformChannel.contactContext(3, '+905551112233')).resolves.toEqual(context);
  });

  it('posts only filled lead fields and returns the created flag', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.agentfix.com.tr/v1/platform/channels/3/contacts/c-1/lead');
      expect(JSON.parse(String(init?.body))).toEqual({ organization: 'Diş Kliniği', needs: { staffCount: 6 } });
      return new Response(JSON.stringify({ lead: { id: 9 }, created: true }), { status: 201 });
    });
    const af = new AgentFix({ apiToken: 'afp_test', fetch: fetchMock as unknown as typeof fetch });
    const result = await af.platformChannel.upsertLead(3, 'c-1', {
      name: '',
      organization: 'Diş Kliniği',
      needs: { staffCount: 6 },
    });
    expect(result).toEqual({ lead: { id: 9 }, created: true });
  });

  it('maps contact endpoint errors to typed errors with the server code', async () => {
    const respond = (status: number, body: unknown) =>
      vi.fn(async () => new Response(JSON.stringify(body), { status }));
    const client = (fetchMock: ReturnType<typeof respond>) =>
      new AgentFix({ apiToken: 'afp_test', fetch: fetchMock as unknown as typeof fetch });

    const notFound = client(respond(404, { error: 'Kişi bulunamadı.', code: 'CONTACT_NOT_FOUND' }));
    await expect(notFound.platformChannel.contactContext(3, 'x')).rejects.toSatisfy(
      (e: unknown) => e instanceof AgentFixNotFoundError && e.code === 'CONTACT_NOT_FOUND' && e.status === 404,
    );

    const invalid = client(
      respond(422, { error: 'Geçersiz alan.', code: 'VALIDATION_FAILED', details: { field: 'email' } }),
    );
    await expect(invalid.platformChannel.upsertLead(3, 'x', { email: 'bozuk' })).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof AgentFixValidationError &&
        e.code === 'VALIDATION_FAILED' &&
        e.status === 422 &&
        JSON.stringify(e.details) === '{"field":"email"}',
    );

    const badKey = client(respond(401, { error: 'Kanal anahtarı geçersiz.', code: 'INVALID_CHANNEL_KEY' }));
    await expect(badKey.platformChannel.upsertLead(3, 'x')).rejects.toSatisfy(
      (e: unknown) => e instanceof AgentFixAuthError && e.code === 'INVALID_CHANNEL_KEY',
    );
  });
});
