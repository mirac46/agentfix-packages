import {
  AgentFixAuthError,
  AgentFixError,
  AgentFixNotFoundError,
  AgentFixValidationError,
} from './errors';
import { pickRagSection, resolveAgentFixRequest, type ResolvedRequest } from './operations';

export interface AgentFixClientConfig {
  baseUrl: string;
  apiToken: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
  fetch?: typeof fetch;
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const rec = data as { error?: unknown; message?: unknown };
    if (typeof rec.error === 'string' && rec.error) return rec.error;
    if (typeof rec.message === 'string' && rec.message) return rec.message;
  }
  return fallback;
}

function mapStatus(status: number, data: unknown): AgentFixError {
  const message = errorMessage(data, 'AgentFix API isteği başarısız.');
  if (status === 401 || status === 403) return new AgentFixAuthError(message);
  if (status === 404) return new AgentFixNotFoundError(message);
  if (status === 400 || status === 422) return new AgentFixValidationError(message, data);
  return new AgentFixError(message, { status, response: data });
}

export class AgentFix {
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AgentFixClientConfig) {
    if (!config.baseUrl) throw new Error('AgentFix: baseUrl gerekli.');
    if (!config.apiToken) throw new Error('AgentFix: apiToken gerekli.');
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiToken = config.apiToken;
    this.timeoutMs = config.timeoutMs ?? 30_000;
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
      if (!res.ok) throw mapStatus(res.status, data);
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
