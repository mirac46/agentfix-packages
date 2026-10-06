export interface AgentFixErrorOptions {
  status?: number | null;
  code?: string | null;
  details?: unknown;
  response?: unknown;
}

export class AgentFixError extends Error {
  public readonly status: number | null;
  public readonly code: string | null;
  public readonly details: unknown;
  public readonly response: unknown;

  constructor(message: string, options: AgentFixErrorOptions = {}) {
    super(message);
    this.name = 'AgentFixError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.details = options.details;
    this.response = options.response;
  }
}

export class AgentFixAuthError extends AgentFixError {
  constructor(message = 'Yetkisiz erişim — apiToken hatalı veya eksik.', options: AgentFixErrorOptions = {}) {
    super(message, { status: 401, code: 'UNAUTHORIZED', ...options });
    this.name = 'AgentFixAuthError';
  }
}

export class AgentFixNotFoundError extends AgentFixError {
  constructor(message = 'Kaynak bulunamadı.', options: AgentFixErrorOptions = {}) {
    super(message, { status: 404, code: 'NOT_FOUND', ...options });
    this.name = 'AgentFixNotFoundError';
  }
}

export class AgentFixValidationError extends AgentFixError {
  constructor(message: string, response?: unknown, options: AgentFixErrorOptions = {}) {
    super(message, { status: 400, code: 'BAD_REQUEST', response, ...options });
    this.name = 'AgentFixValidationError';
  }
}

export interface AgentFixApiErrorInfo {
  status: number;
  message: string;
  code: string | null;
  details?: unknown;
}

/** API hata gövdesi `{ error, code, details? }`; düz metin ya da eski `{ message }` da okunur. */
export function parseApiError(status: number, data: unknown): AgentFixApiErrorInfo {
  const fallback = `AgentFix API isteği başarısız (HTTP ${status}).`;
  if (data === null || typeof data !== 'object') {
    const text = typeof data === 'string' && data.trim() && !data.trim().startsWith('<') ? data.trim() : '';
    return { status, message: text.slice(0, 500) || fallback, code: null };
  }
  const rec = data as { error?: unknown; message?: unknown; code?: unknown; details?: unknown };
  const message =
    (typeof rec.error === 'string' && rec.error) || (typeof rec.message === 'string' && rec.message) || fallback;
  const code = typeof rec.code === 'string' && rec.code ? rec.code : null;
  return rec.details === undefined ? { status, message, code } : { status, message, code, details: rec.details };
}

export function toAgentFixError(status: number, data: unknown): AgentFixError {
  const info = parseApiError(status, data);
  const options: AgentFixErrorOptions = { status, details: info.details, response: data };
  if (info.code) options.code = info.code;
  if (status === 401 || status === 403) return new AgentFixAuthError(info.message, options);
  if (status === 404) return new AgentFixNotFoundError(info.message, options);
  if (status === 400 || status === 422) return new AgentFixValidationError(info.message, data, options);
  return new AgentFixError(info.message, options);
}
