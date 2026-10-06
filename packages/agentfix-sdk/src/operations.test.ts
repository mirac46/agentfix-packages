import { describe, expect, it } from 'vitest';
import { normalizeBaseUrl, pickRagSection, resolveAgentFixRequest } from './operations';

describe('resolveAgentFixRequest', () => {
  it('maps RAG query to the v1 retrieval endpoint', () => {
    const request = resolveAgentFixRequest({
      resource: 'rag',
      operation: 'query',
      fields: { query: 'Calisma saatleri', limit: 6 },
    });
    expect(request.method).toBe('POST');
    expect(request.path).toBe('/v1/rag/query');
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
    expect(request.path).toBe('/v1/ingest/conversation');
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
    expect(chat.path).toBe('/v1/chat/12/messages');
    const email = resolveAgentFixRequest({
      resource: 'email',
      operation: 'reply',
      fields: { id: '9', message: 'Yanit' },
    });
    expect(email.path).toBe('/v1/email/threads/9/reply');
  });

  it('maps RAG section reads onto the context endpoint', () => {
    const about = resolveAgentFixRequest({ resource: 'rag', operation: 'getAbout', fields: {} });
    const services = resolveAgentFixRequest({
      resource: 'rag',
      operation: 'getServices',
      fields: {},
    });
    expect(about).toEqual({ method: 'GET', path: '/v1/rag/context' });
    expect(services).toEqual({ method: 'GET', path: '/v1/rag/context' });
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

describe('normalizeBaseUrl', () => {
  it('defaults to the API host and moves legacy site addresses there', () => {
    expect(normalizeBaseUrl('')).toBe('https://api.agentfix.com.tr');
    expect(normalizeBaseUrl(undefined)).toBe('https://api.agentfix.com.tr');
    expect(normalizeBaseUrl('https://agentfix.com.tr')).toBe('https://api.agentfix.com.tr');
    expect(normalizeBaseUrl('https://www.agentfix.com.tr/api/v1/')).toBe('https://api.agentfix.com.tr');
    expect(normalizeBaseUrl('https://api.agentfix.com.tr/v1')).toBe('https://api.agentfix.com.tr');
  });

  it('keeps self-hosted addresses and their sub-paths', () => {
    expect(normalizeBaseUrl('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(normalizeBaseUrl('https://crm.example.com/agentfix/api')).toBe('https://crm.example.com/agentfix');
  });
});

describe('current v1 contract', () => {
  const resolve = (resource: string, operation: string, fields: Record<string, unknown> = {}) =>
    resolveAgentFixRequest({ resource, operation, fields });

  it('maps message buffer collect and complete under ingest', () => {
    expect(
      resolve('messageBatches', 'collect', {
        channel: 'whatsapp',
        conversationId: '905551112233',
        externalId: 'wamid.1',
        text: 'Merhaba',
        sentAt: '',
      }),
    ).toEqual({
      method: 'POST',
      path: '/v1/ingest/message-batches/collect',
      body: { channel: 'whatsapp', conversationId: '905551112233', externalId: 'wamid.1', text: 'Merhaba' },
    });
    expect(resolve('messageBatches', 'complete', { batchId: 'b', claimToken: 'c' })).toEqual({
      method: 'POST',
      path: '/v1/ingest/message-batches/complete',
      body: { batchId: 'b', claimToken: 'c' },
    });
  });

  it('maps automation CRM contact and note bodies to the strict schemas', () => {
    expect(resolve('crm', 'upsertContact', { name: 'Ayşe', phone: '+905551112233', email: '' })).toEqual({
      method: 'POST',
      path: '/v1/ingest/crm-contact',
      body: { name: 'Ayşe', phone: '+905551112233', source: 'n8n' },
    });
    expect(resolve('crm', 'addNote', { contactKey: 'lead:4', text: 'Fiyat sordu', externalId: 'n8n-1' })).toEqual({
      method: 'POST',
      path: '/v1/ingest/crm-note',
      body: { contactKey: 'lead:4', text: 'Fiyat sordu', externalId: 'n8n-1' },
    });
  });

  it('maps platform channel calls with the channel id in the path', () => {
    expect(resolve('platformChannel', 'health', { channelId: 7 }).path).toBe('/v1/platform/channels/7/health');
    expect(
      resolve('platformChannel', 'sendEvent', {
        channelId: 7,
        externalId: 'e1',
        eventType: 'message.received',
        eventData: '{"text":"Selam","from":"+90555"}',
      }),
    ).toEqual({
      method: 'POST',
      path: '/v1/platform/channels/7/events',
      body: { externalId: 'e1', type: 'message.received', data: { text: 'Selam', from: '+90555' } },
    });
    expect(resolve('platformChannel', 'completeEvent', { channelId: 7, eventId: 'u-1', reply: 'Tamam' })).toEqual({
      method: 'POST',
      path: '/v1/platform/channels/7/events/u-1/complete',
      body: { reply: 'Tamam' },
    });
    expect(
      resolve('platformChannel', 'replyBatch', {
        channelId: 7,
        batchId: 'b',
        claimToken: 'c',
        reply: 'Yanıt',
        handoff: false,
      }),
    ).toEqual({
      method: 'POST',
      path: '/v1/platform/channels/7/message-batches/reply',
      body: { batchId: 'b', claimToken: 'c', reply: 'Yanıt' },
    });
    expect(resolve('platformChannel', 'knowledge', { channelId: 7, question: 'Saat?', mode: 'search' }).body).toEqual({
      question: 'Saat?',
      mode: 'search',
    });
  });

  it('refuses platform channel calls without a channel id', () => {
    expect(() => resolve('platformChannel', 'health', {})).toThrow(/Kanal kimliği/);
  });

  it('sends the body fields the panel endpoints actually read', () => {
    expect(resolve('chat', 'send', { id: '12', message: 'Merhaba' }).body).toEqual({ message: 'Merhaba' });
    expect(resolve('email', 'reply', { id: '9', message: 'Yanıt' }).body).toEqual({ bodyText: 'Yanıt' });
    expect(
      resolve('offers', 'create', {
        customerId: '5',
        title: 'İmplant',
        amount: 1000,
        items: '[{"name":"İmplant","quantity":1,"unit_price":1000}]',
      }).body,
    ).toEqual({
      customer_id: 5,
      title: 'İmplant',
      amount: 1000,
      items: [{ name: 'İmplant', quantity: 1, unit_price: 1000 }],
    });
    expect(resolve('services', 'getPackages', { category: 'konusma-paketleri' }).qs).toEqual({
      category: 'konusma-paketleri',
    });
    expect(() => resolve('services', 'getPackages', { category: '' })).toThrow(/Paket kategorisi/);
    expect(resolve('rag', 'pricing', { category: 'billing' })).toEqual({
      method: 'GET',
      path: '/v1/rag/pricing',
      qs: { category: 'billing' },
    });
  });

  it('rejects malformed JSON fields before sending', () => {
    expect(() => resolve('offers', 'create', { items: '[{' })).toThrow(/Geçersiz JSON/);
  });

  it('does not resolve inherited object keys as operations', () => {
    expect(() => resolve('toString', 'call')).toThrow(/Unsupported/);
    expect(() => resolve('account', 'constructor')).toThrow(/Unsupported/);
  });
});
