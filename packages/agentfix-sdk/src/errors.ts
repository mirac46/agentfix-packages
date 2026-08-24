export class AgentFixError extends Error {
  public readonly status: number | null;
  public readonly code: string | null;
  public readonly response: unknown;

  constructor(
    message: string,
    options: {
      status?: number | null;
      code?: string | null;
      response?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'AgentFixError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.response = options.response;
  }
}

export class AgentFixAuthError extends AgentFixError {
  constructor(message = 'Yetkisiz erişim — apiToken hatalı veya eksik.') {
    super(message, { status: 401, code: 'UNAUTHORIZED' });
    this.name = 'AgentFixAuthError';
  }
}

export class AgentFixNotFoundError extends AgentFixError {
  constructor(message = 'Kaynak bulunamadı.') {
    super(message, { status: 404, code: 'NOT_FOUND' });
    this.name = 'AgentFixNotFoundError';
  }
}

export class AgentFixValidationError extends AgentFixError {
  constructor(message: string, response?: unknown) {
    super(message, { status: 400, code: 'BAD_REQUEST', response });
    this.name = 'AgentFixValidationError';
  }
}
