import { toAgentFixError } from './errors';
import {
  normalizeBaseUrl,
  pickRagSection,
  resolveAgentFixRequest,
  type ResolvedRequest,
} from './operations';

export interface AgentFixClientConfig {
  /** Varsayılan https://api.agentfix.com.tr; eski agentfix.com.tr adresi API alan adına çevrilir. */
  baseUrl?: string;
  /** Kullanıcı API anahtarı; platform kanal uçlarında kanal anahtarı. */
  apiToken: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
  fetch?: typeof fetch;
}

export interface MessageBufferInput {
  channel: 'whatsapp' | 'messenger' | 'instagram' | 'web_chat';
  conversationId: string;
  externalId: string;
  text: string;
  sentAt?: string;
}

export interface BatchClaim {
  batchId: string;
  claimToken: string;
}

export class AgentFix {
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AgentFixClientConfig) {
    if (!config.apiToken) throw new Error('AgentFix: apiToken gerekli.');
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.apiToken = config.apiToken;
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.defaultHeaders = config.defaultHeaders ?? {};
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async request<T = unknown>(input: ResolvedRequest): Promise<T> {
    const url = new URL(`${this.baseUrl}${input.path}`);
    if (input.qs) {
      for (const [key, value] of Object.entries(input.qs)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method: input.method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
          'X-API-Key': this.apiToken,
          ...this.defaultHeaders,
        },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: controller.signal,
      });
      const text = await res.text();
      let data: unknown = text;
      if (text) {
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          data = text;
        }
      }
      if (!res.ok) throw toAgentFixError(res.status, data);
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  call<T = unknown>(resource: string, operation: string, fields: Record<string, unknown> = {}) {
    return this.request<T>(resolveAgentFixRequest({ resource, operation, fields }));
  }

  me<T = unknown>() {
    return this.call<T>('account', 'me');
  }

  health<T = unknown>() {
    return this.call<T>('health', 'get');
  }

  readonly rag = {
    context: <T = unknown>() => this.call<T>('rag', 'context'),
    about: async <T = unknown>() =>
      pickRagSection(await this.call('rag', 'getAbout'), 'getAbout') as T,
    services: async <T = unknown>() =>
      pickRagSection(await this.call('rag', 'getServices'), 'getServices') as T,
    faqs: async <T = unknown>() => pickRagSection(await this.call('rag', 'getFaqs'), 'getFaqs') as T,
    persona: async <T = unknown>() =>
      pickRagSection(await this.call('rag', 'getPersona'), 'getPersona') as T,
    documents: async <T = unknown>() =>
      pickRagSection(await this.call('rag', 'getDocuments'), 'getDocuments') as T,
    query: <T = unknown>(fields: { query: string; limit?: number }) =>
      this.call<T>('rag', 'query', fields),
    chat: <T = unknown>(fields: { message: string; history?: unknown; systemPrompt?: string }) =>
      this.call<T>('rag', 'chat', fields),
    sync: <T = unknown>(fields: Record<string, unknown>) => this.call<T>('rag', 'sync', fields),
    pricing: <T = unknown>(category?: string) => this.call<T>('rag', 'pricing', { category }),
  };

  /** Art arda gelen mesajları tek yanıtta toplar; collect bekleme süresi kadar açık kalır. */
  readonly messageBatches = {
    collect: <T = unknown>(fields: MessageBufferInput) => this.call<T>('messageBatches', 'collect', { ...fields }),
    complete: <T = unknown>(fields: BatchClaim) => this.call<T>('messageBatches', 'complete', { ...fields }),
  };

  readonly crm = {
    upsertContact: <T = unknown>(fields: { name?: string; phone?: string; email?: string; source?: string }) =>
      this.call<T>('crm', 'upsertContact', fields),
    addNote: <T = unknown>(fields: { contactKey: string; text: string; externalId: string }) =>
      this.call<T>('crm', 'addNote', fields),
  };

  /** Platform kanal uçları kanal anahtarıyla çağrılır: apiToken yerine kanal anahtarını verin. */
  readonly platformChannel = {
    health: <T = unknown>(channelId: number) => this.call<T>('platformChannel', 'health', { channelId }),
    sendEvent: <T = unknown>(channelId: number, fields: { externalId: string; type: string; data: Record<string, unknown> }) =>
      this.call<T>('platformChannel', 'sendEvent', { channelId, externalId: fields.externalId, eventType: fields.type, eventData: fields.data }),
    completeEvent: <T = unknown>(channelId: number, eventId: string, reply: string) =>
      this.call<T>('platformChannel', 'completeEvent', { channelId, eventId, reply }),
    knowledge: <T = unknown>(channelId: number, fields: { question: string; mode?: 'search' | 'answer'; history?: unknown }) =>
      this.call<T>('platformChannel', 'knowledge', { channelId, ...fields }),
    collectMessages: <T = unknown>(channelId: number, fields: MessageBufferInput) =>
      this.call<T>('platformChannel', 'collectMessages', { channelId, ...fields }),
    completeBatch: <T = unknown>(channelId: number, fields: BatchClaim) =>
      this.call<T>('platformChannel', 'completeBatch', { channelId, ...fields }),
    replyBatch: <T = unknown>(channelId: number, fields: BatchClaim & { reply: string; handoff?: boolean }) =>
      this.call<T>('platformChannel', 'replyBatch', { channelId, ...fields }),
  };

  readonly ingest = {
    customer: <T = unknown>(fields: Record<string, unknown>) =>
      this.call<T>('ingest', 'customer', fields),
    appointment: <T = unknown>(fields: Record<string, unknown>) =>
      this.call<T>('ingest', 'appointment', fields),
    callNote: <T = unknown>(fields: Record<string, unknown>) =>
      this.call<T>('ingest', 'callNote', fields),
    conversation: <T = unknown>(fields: Record<string, unknown>) =>
      this.call<T>('ingest', 'conversation', fields),
  };

  readonly customers = {
    list: <T = unknown>(fields: Record<string, unknown> = {}) =>
      this.call<T>('customers', 'getAll', fields),
    get: <T = unknown>(id: string) => this.call<T>('customers', 'get', { id }),
    create: <T = unknown>(fields: Record<string, unknown>) =>
      this.call<T>('customers', 'create', fields),
    update: <T = unknown>(id: string, fields: Record<string, unknown>) =>
      this.call<T>('customers', 'update', { ...fields, id }),
  };

  readonly appointments = {
    list: <T = unknown>(fields: Record<string, unknown> = {}) =>
      this.call<T>('appointments', 'getAll', fields),
    create: <T = unknown>(fields: Record<string, unknown>) =>
      this.call<T>('appointments', 'create', fields),
    complete: <T = unknown>(id: string) => this.call<T>('appointments', 'complete', { id }),
    cancel: <T = unknown>(id: string) => this.call<T>('appointments', 'cancel', { id }),
  };

  readonly calls = {
    list: <T = unknown>(fields: Record<string, unknown> = {}) =>
      this.call<T>('calls', 'getAll', fields),
    createNote: <T = unknown>(fields: Record<string, unknown>) =>
      this.call<T>('calls', 'createNote', fields),
  };

  readonly offers = {
    list: <T = unknown>(fields: Record<string, unknown> = {}) =>
      this.call<T>('offers', 'getAll', fields),
    create: <T = unknown>(fields: Record<string, unknown>) =>
      this.call<T>('offers', 'create', fields),
  };

  readonly whatsapp = {
    sendMessage: <T = unknown>(fields: { accountId?: number; phone: string; message: string }) =>
      this.call<T>('whatsapp', 'sendMessage', fields),
  };

  readonly chat = {
    list: <T = unknown>() => this.call<T>('chat', 'getAll'),
    send: <T = unknown>(id: string, message: string) =>
      this.call<T>('chat', 'send', { id, message }),
  };

  readonly email = {
    listThreads: <T = unknown>(fields: Record<string, unknown> = {}) =>
      this.call<T>('email', 'listThreads', fields),
    reply: <T = unknown>(id: string, message: string) =>
      this.call<T>('email', 'reply', { id, message }),
  };

  readonly services = {
    getPackages: <T = unknown>(fields: Record<string, unknown> = {}) =>
      this.call<T>('services', 'getPackages', fields),
  };

  readonly dashboard = {
    get: <T = unknown>() => this.call<T>('dashboard', 'get'),
  };
}
