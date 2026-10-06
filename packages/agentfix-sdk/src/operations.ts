export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ResolvedRequest {
  method: HttpMethod;
  path: string;
  qs?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown>;
}

export const DEFAULT_BASE_URL = 'https://api.agentfix.com.tr';

// Kanonik sürüm öneki. `/api/v1` uyumluluk adresi olarak çalışmaya devam eder,
// ama ana alan adı (agentfix.com.tr) `/v1` yolunu sunmaz.
export const API_PREFIX = '/v1';

const LEGACY_HOSTS = new Set(['agentfix.com.tr', 'www.agentfix.com.tr']);

/**
 * Kayıtlı eski adresleri API alan adına taşır: 0.1.x kimlik bilgileri
 * `https://agentfix.com.tr` ile kaydedildi ve sonda `/api` ya da `/api/v1`
 * bırakılmış olabilir. Kendi kurulumunu kullananların adresine dokunulmaz.
 */
export function normalizeBaseUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw.replace(/\/+$/, '');
  }
  if (LEGACY_HOSTS.has(url.hostname.toLowerCase())) url.hostname = 'api.agentfix.com.tr';
  const path = url.pathname.replace(/\/+$/, '').replace(/(\/api)?(\/v1)?$/, '');
  return `${url.origin}${path}`;
}

export function compact<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined && entry !== null && entry !== '') {
      out[key] = entry;
    }
  }
  return out as T;
}

// n8n alanları JSON'u metin olarak verebilir; dizi/nesne bekleyen uçlara
// ayrıştırılmış hâli gider.
function json(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(`Geçersiz JSON alanı: ${trimmed.slice(0, 40)}`);
  }
}

function required(value: unknown, label: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} gerekli.`);
  return text;
}

function segment(value: unknown, label: string): string {
  return encodeURIComponent(required(value, label));
}

function positive(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

type Fields = Record<string, unknown>;
type Resolver = (fields: Fields) => ResolvedRequest;

const v1 = (path: string): string => `${API_PREFIX}${path}`;

const ingestPayload = (fields: Fields) =>
  compact({
    name: fields.name,
    phone: fields.phone,
    email: fields.email,
    notes: fields.notes,
    source: fields.source || 'n8n',
    customer_id: fields.customerId,
    title: fields.title,
    scheduled_at: fields.scheduledAt,
    duration: fields.duration,
    location: fields.location,
    description: fields.description,
    status: fields.status,
    transcript: fields.transcript,
    summary: fields.summary,
  });

const bufferInput = (fields: Fields) =>
  compact({
    channel: fields.channel,
    conversationId: fields.conversationId,
    externalId: fields.externalId,
    text: fields.text ?? fields.message,
    sentAt: fields.sentAt,
  });

const batchClaim = (fields: Fields) => compact({ batchId: fields.batchId, claimToken: fields.claimToken });

const channelPath = (fields: Fields, path: string): string =>
  v1(`/platform/channels/${segment(fields.channelId, 'Kanal kimliği')}${path}`);

const ragContext: Resolver = () => ({ method: 'GET', path: v1('/rag/context') });

const OPERATIONS: Record<string, Record<string, Resolver>> = {
  account: {
    me: () => ({ method: 'GET', path: v1('/me') }),
  },
  health: {
    get: () => ({ method: 'GET', path: v1('/health') }),
  },
  rag: {
    context: ragContext,
    getAbout: ragContext,
    getServices: ragContext,
    getFaqs: ragContext,
    getPersona: ragContext,
    getDocuments: ragContext,
    query: (f) => ({
      method: 'POST',
      path: v1('/rag/query'),
      body: compact({ query: f.query, limit: f.limit, category: f.category }),
    }),
    chat: (f) => ({
      method: 'POST',
      path: v1('/rag/chat'),
      body: compact({
        message: f.message,
        history: json(f.history),
        systemPrompt: f.systemPrompt,
        category: f.category,
      }),
    }),
    sync: (f) => ({
      method: 'POST',
      path: v1('/rag/sync'),
      body: compact({
        about: json(f.about),
        services: json(f.services),
        faqs: json(f.faqs),
        persona: json(f.persona),
        document: json(f.document),
      }),
    }),
    pricing: (f) => ({ method: 'GET', path: v1('/rag/pricing'), qs: compact({ category: str(f.category) }) }),
  },
  ingest: {
    customer: (f) => ({ method: 'POST', path: v1('/ingest/customer'), body: ingestPayload(f) }),
    appointment: (f) => ({ method: 'POST', path: v1('/ingest/appointment'), body: ingestPayload(f) }),
    callNote: (f) => ({ method: 'POST', path: v1('/ingest/call-note'), body: ingestPayload(f) }),
    conversation: (f) => ({ method: 'POST', path: v1('/ingest/conversation'), body: ingestPayload(f) }),
  },
  messageBatches: {
    collect: (f) => ({ method: 'POST', path: v1('/ingest/message-batches/collect'), body: bufferInput(f) }),
    complete: (f) => ({ method: 'POST', path: v1('/ingest/message-batches/complete'), body: batchClaim(f) }),
  },
  crm: {
    upsertContact: (f) => ({
      method: 'POST',
      path: v1('/ingest/crm-contact'),
      body: compact({ name: f.name, phone: f.phone, email: f.email, source: f.source || 'n8n' }),
    }),
    addNote: (f) => ({
      method: 'POST',
      path: v1('/ingest/crm-note'),
      body: compact({ contactKey: f.contactKey, text: f.text ?? f.notes, externalId: f.externalId }),
    }),
  },
  platformChannel: {
    health: (f) => ({ method: 'GET', path: channelPath(f, '/health') }),
    sendEvent: (f) => ({
      method: 'POST',
      path: channelPath(f, '/events'),
      body: compact({ externalId: f.externalId, type: f.eventType, data: json(f.eventData) ?? {} }),
    }),
    completeEvent: (f) => ({
      method: 'POST',
      path: channelPath(f, `/events/${segment(f.eventId, 'Olay kimliği')}/complete`),
      body: compact({ reply: f.reply }),
    }),
    knowledge: (f) => ({
      method: 'POST',
      path: channelPath(f, '/knowledge'),
      body: compact({ question: f.question ?? f.query, mode: f.mode, history: json(f.history) }),
    }),
    collectMessages: (f) => ({ method: 'POST', path: channelPath(f, '/message-batches/collect'), body: bufferInput(f) }),
    completeBatch: (f) => ({ method: 'POST', path: channelPath(f, '/message-batches/complete'), body: batchClaim(f) }),
    replyBatch: (f) => ({
      method: 'POST',
      path: channelPath(f, '/message-batches/reply'),
      body: compact({ ...batchClaim(f), reply: f.reply, handoff: f.handoff === true ? true : undefined }),
    }),
  },
  customers: {
    getAll: (f) => ({
      method: 'GET',
      path: v1('/customers'),
      qs: compact({ search: str(f.search), status: str(f.status), page: positive(f.page), limit: positive(f.limit) }),
    }),
    get: (f) => ({ method: 'GET', path: v1(`/customers/${segment(f.id, 'Kimlik')}`) }),
    create: (f) => ({
      method: 'POST',
      path: v1('/customers'),
      body: compact({
        name: f.name,
        email: f.email,
        phone: f.phone,
        company: f.company,
        notes: f.notes,
        source: f.source,
        status: f.status,
      }),
    }),
    update: (f) => ({
      method: 'PUT',
      path: v1(`/customers/${segment(f.id, 'Kimlik')}`),
      body: compact({ name: f.name, email: f.email, phone: f.phone, notes: f.notes, status: f.status }),
    }),
  },
  appointments: {
    getAll: (f) => ({
      method: 'GET',
      path: v1('/appointments'),
      qs: compact({
        status: str(f.status),
        customer_id: str(f.customerId),
        page: positive(f.page),
        limit: positive(f.limit),
      }),
    }),
    create: (f) => ({
      method: 'POST',
      path: v1('/appointments'),
      body: compact({
        customer_id: f.customerId,
        title: f.title,
        description: f.description,
        scheduled_at: f.scheduledAt,
        duration: f.duration,
        location: f.location,
        notes: f.notes,
      }),
    }),
    complete: (f) => ({ method: 'POST', path: v1(`/appointments/${segment(f.id, 'Kimlik')}/complete`) }),
    cancel: (f) => ({ method: 'POST', path: v1(`/appointments/${segment(f.id, 'Kimlik')}/cancel`) }),
  },
  calls: {
    getAll: (f) => ({
      method: 'GET',
      path: v1('/calls'),
      qs: compact({ status: str(f.status), page: positive(f.page), limit: positive(f.limit) }),
    }),
    createNote: (f) => ({
      method: 'POST',
      path: v1('/ingest/call-note'),
      body: compact({
        name: f.name,
        phone: f.phone,
        customer_id: f.customerId,
        notes: f.notes,
        transcript: f.transcript,
      }),
    }),
  },
  offers: {
    getAll: (f) => ({
      method: 'GET',
      path: v1('/offers'),
      qs: compact({
        status: str(f.status),
        customer_id: str(f.customerId),
        page: positive(f.page),
        limit: positive(f.limit),
      }),
    }),
    // Uç katı şemalı: customer_id sayı, en az bir kalem zorunlu.
    create: (f) => ({
      method: 'POST',
      path: v1('/offers'),
      body: compact({
        customer_id: positive(f.customerId),
        title: f.title,
        description: f.description,
        amount: f.amount,
        tax: f.tax,
        discount: f.discount,
        items: json(f.items),
        notes: f.notes,
        valid_until: f.validUntil,
      }),
    }),
  },
  whatsapp: {
    sendMessage: (f) => ({
      method: 'POST',
      path: v1('/whatsapp/messages'),
      body: compact({ accountId: positive(f.accountId), number: f.phone, text: f.message }),
    }),
  },
  chat: {
    getAll: () => ({ method: 'GET', path: v1('/chat') }),
    send: (f) => ({
      method: 'POST',
      path: v1(`/chat/${segment(f.id, 'Kimlik')}/messages`),
      body: compact({ message: f.message }),
    }),
  },
  email: {
    listThreads: (f) => ({
      method: 'GET',
      path: v1('/email/threads'),
      qs: compact({ accountId: positive(f.accountId), limit: positive(f.limit) }),
    }),
    reply: (f) => ({
      method: 'POST',
      path: v1(`/email/threads/${segment(f.id, 'Kimlik')}/reply`),
      body: compact({ bodyText: f.message }),
    }),
  },
  services: {
    getPackages: (f) => ({
      method: 'GET',
      path: v1('/services/packages'),
      // Uç kategorisiz isteği 404 PACKAGE_NOT_FOUND ile reddeder.
      qs: { category: required(f.category, 'Paket kategorisi') },
    }),
  },
  dashboard: {
    get: () => ({ method: 'GET', path: v1('/dashboard') }),
  },
};

/** Desteklenen kaynak → işlem listesi; düğüm tanımı bununla denetlenir. */
export function supportedOperations(): Record<string, string[]> {
  return Object.fromEntries(Object.entries(OPERATIONS).map(([resource, ops]) => [resource, Object.keys(ops)]));
}

export function resolveAgentFixRequest(input: {
  resource: string;
  operation: string;
  fields: Fields;
}): ResolvedRequest {
  const ops = Object.hasOwn(OPERATIONS, input.resource) ? OPERATIONS[input.resource] : undefined;
  const resolver = ops && Object.hasOwn(ops, input.operation) ? ops[input.operation] : undefined;
  if (!resolver) throw new Error(`Unsupported AgentFix operation: ${input.resource}.${input.operation}`);
  return resolver(input.fields);
}

const RAG_SECTION_KEYS = {
  getAbout: 'about',
  getServices: 'services',
  getFaqs: 'faqs',
  getPersona: 'persona',
  getDocuments: 'customDocuments',
} as const;

export function pickRagSection(payload: unknown, operation: string): unknown {
  const key = RAG_SECTION_KEYS[operation as keyof typeof RAG_SECTION_KEYS];
  if (!key) return payload;
  const rec = payload !== null && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const data =
    rec.data !== null && typeof rec.data === 'object' ? (rec.data as Record<string, unknown>) : rec;
  return {
    section: key,
    data: data[key] ?? null,
    updatedAt: rec.updatedAt ?? null,
  };
}
