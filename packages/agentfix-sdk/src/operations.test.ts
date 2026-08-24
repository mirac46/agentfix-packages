import { describe, expect, it } from 'vitest';
import { pickRagSection, resolveAgentFixRequest } from './operations';

describe('resolveAgentFixRequest', () => {
  it('maps RAG query to the v1 retrieval endpoint', () => {
    const request = resolveAgentFixRequest({
      resource: 'rag',
      operation: 'query',
      fields: { query: 'Calisma saatleri', limit: 6 },
    });
    expect(request.method).toBe('POST');
    expect(request.path).toBe('/api/v1/rag/query');
    expect(request.body).toEqual({ query: 'Calisma saatleri', limit: 6 });
  });

  it('maps conversation ingest so agents can write patients and appointments', () => {
    const request = resolveAgentFixRequest({
      resource: 'ingest',
      operation: 'conversation',
      fields: {
        name: 'Ayse Yilmaz',
        phone: '+905551112233',
        title: 'Kontrol',
        scheduledAt: '2026-09-01T10:00:00+03:00',
        notes: 'AI gorusmesi',
      },
    });
    expect(request.method).toBe('POST');
    expect(request.path).toBe('/api/v1/ingest/conversation');
    expect(request.body?.name).toBe('Ayse Yilmaz');
    expect(request.body?.source).toBe('n8n');
    expect(request.body?.scheduled_at).toBe('2026-09-01T10:00:00+03:00');
  });

  it('maps chat send and email reply onto panel v1 paths', () => {
    const chat = resolveAgentFixRequest({
      resource: 'chat',
      operation: 'send',
      fields: { id: '12', message: 'Merhaba' },
    });
    expect(chat.path).toBe('/api/v1/chat/12/messages');
    const email = resolveAgentFixRequest({
      resource: 'email',
      operation: 'reply',
      fields: { id: '9', message: 'Yanit' },
    });
    expect(email.path).toBe('/api/v1/email/threads/9/reply');
  });

  it('maps RAG section reads onto the context endpoint', () => {
    const about = resolveAgentFixRequest({ resource: 'rag', operation: 'getAbout', fields: {} });
    const services = resolveAgentFixRequest({
      resource: 'rag',
      operation: 'getServices',
      fields: {},
    });
    expect(about).toEqual({ method: 'GET', path: '/api/v1/rag/context' });
    expect(services).toEqual({ method: 'GET', path: '/api/v1/rag/context' });
  });

  it('picks Hakkımızda and Hizmetler out of the compiled context payload', () => {
    const payload = {
      data: { about: { companyName: 'Klinik' }, services: [{ name: 'Implant' }] },
      updatedAt: '2026-08-24',
    };
    expect(pickRagSection(payload, 'getAbout')).toEqual({
      section: 'about',
      data: { companyName: 'Klinik' },
      updatedAt: '2026-08-24',
    });
    expect(pickRagSection(payload, 'getServices')).toEqual({
      section: 'services',
      data: [{ name: 'Implant' }],
      updatedAt: '2026-08-24',
    });
    expect(pickRagSection(payload, 'query')).toEqual(payload);
  });

  it('rejects unknown operations instead of calling a random path', () => {
    expect(() =>
      resolveAgentFixRequest({ resource: 'admin', operation: 'wipe', fields: {} }),
    ).toThrow(/Unsupported AgentFix operation/);
  });
});
