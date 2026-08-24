export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ResolvedRequest {
  method: HttpMethod;
  path: string;
  qs?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown>;
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

export function resolveAgentFixRequest(input: {
  resource: string;
  operation: string;
  fields: Record<string, unknown>;
}): ResolvedRequest {
  const { resource, operation, fields } = input;
  const id = String(fields.id ?? '').trim();

  if (resource === 'account' && operation === 'me') {
    return { method: 'GET', path: '/api/v1/me' };
  }

  if (resource === 'rag') {
    if (operation === 'context') return { method: 'GET', path: '/api/v1/rag/context' };
    if (operation === 'query') {
      return {
        method: 'POST',
        path: '/api/v1/rag/query',
        body: compact({ query: fields.query, limit: fields.limit }),
      };
    }
    if (operation === 'chat') {
      return {
        method: 'POST',
        path: '/api/v1/rag/chat',
        body: compact({
          message: fields.message,
          history: fields.history,
          systemPrompt: fields.systemPrompt,
        }),
      };
    }
    if (operation === 'sync') {
      return {
        method: 'POST',
        path: '/api/v1/rag/sync',
        body: compact({
          about: fields.about,
          services: fields.services,
          faqs: fields.faqs,
          persona: fields.persona,
          document: fields.document,
        }),
      };
    }
  }

  if (resource === 'ingest') {
    const payload = compact({
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
    if (operation === 'customer') return { method: 'POST', path: '/api/v1/ingest/customer', body: payload };
    if (operation === 'appointment') return { method: 'POST', path: '/api/v1/ingest/appointment', body: payload };
    if (operation === 'callNote') return { method: 'POST', path: '/api/v1/ingest/call-note', body: payload };
    if (operation === 'conversation') return { method: 'POST', path: '/api/v1/ingest/conversation', body: payload };
  }

  if (resource === 'customers') {
    if (operation === 'getAll') {
      return {
        method: 'GET',
        path: '/api/v1/customers',
        qs: compact({
          search: fields.search as string | undefined,
          status: fields.status as string | undefined,
          page: fields.page as number | undefined,
          limit: fields.limit as number | undefined,
        }),
      };
    }
    if (operation === 'get') return { method: 'GET', path: `/api/v1/customers/${id}` };
    if (operation === 'create') {
      return {
        method: 'POST',
        path: '/api/v1/customers',
        body: compact({
          name: fields.name,
          email: fields.email,
          phone: fields.phone,
          company: fields.company,
          notes: fields.notes,
          source: fields.source,
          status: fields.status,
        }),
      };
    }
    if (operation === 'update') {
      return {
        method: 'PUT',
        path: `/api/v1/customers/${id}`,
        body: compact({
          name: fields.name,
          email: fields.email,
          phone: fields.phone,
          notes: fields.notes,
          status: fields.status,
        }),
      };
    }
  }

  if (resource === 'appointments') {
    if (operation === 'getAll') {
      return {
        method: 'GET',
        path: '/api/v1/appointments',
        qs: compact({
          status: fields.status as string | undefined,
          customer_id: fields.customerId as string | undefined,
          page: fields.page as number | undefined,
          limit: fields.limit as number | undefined,
        }),
      };
    }
    if (operation === 'create') {
      return {
        method: 'POST',
        path: '/api/v1/appointments',
        body: compact({
          customer_id: fields.customerId,
          title: fields.title,
          description: fields.description,
          scheduled_at: fields.scheduledAt,
          duration: fields.duration,
          location: fields.location,
          notes: fields.notes,
        }),
      };
    }
    if (operation === 'complete') return { method: 'POST', path: `/api/v1/appointments/${id}/complete` };
    if (operation === 'cancel') return { method: 'POST', path: `/api/v1/appointments/${id}/cancel` };
  }

  if (resource === 'calls') {
    if (operation === 'getAll') {
      return {
        method: 'GET',
        path: '/api/v1/calls',
        qs: compact({
          status: fields.status as string | undefined,
          page: fields.page as number | undefined,
          per_page: fields.limit as number | undefined,
        }),
      };
    }
    if (operation === 'createNote') {
      return {
        method: 'POST',
        path: '/api/v1/ingest/call-note',
        body: compact({
          name: fields.name,
          phone: fields.phone,
          customer_id: fields.customerId,
          notes: fields.notes,
          transcript: fields.transcript,
        }),
      };
    }
  }

  if (resource === 'offers') {
    if (operation === 'getAll') {
      return {
        method: 'GET',
        path: '/api/v1/offers',
        qs: compact({
          status: fields.status as string | undefined,
          customer_id: fields.customerId as string | undefined,
          page: fields.page as number | undefined,
          limit: fields.limit as number | undefined,
        }),
      };
    }
    if (operation === 'create') {
      return {
        method: 'POST',
        path: '/api/v1/offers',
        body: compact({
          customer_id: fields.customerId,
          title: fields.title,
          amount: fields.amount,
          notes: fields.notes,
        }),
      };
    }
  }

  if (resource === 'whatsapp' && operation === 'sendMessage') {
    return {
      method: 'POST',
      path: '/api/v1/whatsapp/messages',
      body: compact({
        accountId: fields.accountId,
        number: fields.phone,
        text: fields.message,
      }),
    };
  }

  if (resource === 'dashboard' && operation === 'get') {
    return { method: 'GET', path: '/api/v1/dashboard' };
  }

  if (resource === 'chat') {
    if (operation === 'getAll') return { method: 'GET', path: '/api/v1/chat' };
    if (operation === 'send') {
      return {
        method: 'POST',
        path: `/api/v1/chat/${String(fields.id ?? '').trim()}/messages`,
        body: compact({ content: fields.message, text: fields.message }),
      };
    }
  }

  if (resource === 'email') {
    if (operation === 'listThreads') {
      return {
        method: 'GET',
        path: '/api/v1/email/threads',
        qs: compact({
          accountId: fields.accountId as number | undefined,
          limit: fields.limit as number | undefined,
        }),
      };
    }
    if (operation === 'reply') {
      return {
        method: 'POST',
        path: `/api/v1/email/threads/${String(fields.id ?? '').trim()}/reply`,
        body: compact({ text: fields.message }),
      };
    }
  }

  if (resource === 'services' && operation === 'getPackages') {
    return {
      method: 'GET',
      path: '/api/v1/services/packages',
      qs: compact({ category: fields.status as string | undefined }),
    };
  }

  throw new Error(`Unsupported AgentFix operation: ${resource}.${operation}`);
}
