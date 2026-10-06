import { describe, expect, it, vi } from 'vitest';
import { NodeApiError, type INodeProperties } from 'n8n-workflow';
import { supportedOperations } from 'agentfix-sdk';
import { AgentFix, FIELD_NAMES } from '../nodes/AgentFix/AgentFix.node';
import { AgentFixApi } from '../credentials/AgentFixApi.credentials';
import { AgentFixPlatformChannelApi } from '../credentials/AgentFixPlatformChannelApi.credentials';

const description = new AgentFix().description;
const properties = description.properties as INodeProperties[];

function optionValues(property: INodeProperties): string[] {
  return (property.options ?? []).map((option) => String((option as { value: unknown }).value));
}

describe('AgentFix node description', () => {
  it('only offers operations the SDK can resolve', () => {
    const supported = supportedOperations();
    const resources = optionValues(properties.find((p) => p.name === 'resource')!);
    for (const resource of resources) {
      const operationProp = properties.find(
        (p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes(resource),
      );
      expect(operationProp, `operation list for ${resource}`).toBeDefined();
      for (const operation of optionValues(operationProp!)) {
        expect(supported[resource] ?? [], `${resource}.${operation}`).toContain(operation);
      }
    }
  });

  it('covers the message buffer, CRM automation and platform channel families', () => {
    const resources = optionValues(properties.find((p) => p.name === 'resource')!);
    expect(resources).toEqual(expect.arrayContaining(['messageBatches', 'crm', 'platformChannel']));
  });

  it('reads every declared field in execute()', () => {
    const declared = properties.map((p) => p.name).filter((name) => name !== 'resource' && name !== 'operation');
    for (const name of declared) expect(FIELD_NAMES as readonly string[]).toContain(name);
  });

  it('points credentials at the API host and the /v1 prefix', () => {
    const api = new AgentFixApi();
    expect(api.properties.find((p) => p.name === 'baseUrl')?.default).toBe('https://api.agentfix.com.tr');
    expect(api.test.request.url).toBe('/v1/me');
    expect(new AgentFixPlatformChannelApi().test.request.url).toBe(
      '=/v1/platform/channels/{{$credentials.channelId}}/health',
    );
  });
});

type Params = Record<string, unknown>;

function context(params: Params, response: { statusCode: number; body: unknown }, continueOnFail = false) {
  const http = vi.fn(async () => response);
  const getCredentials = vi.fn(async (name: string) =>
    name === 'agentFixPlatformChannelApi'
      ? { baseUrl: 'https://api.agentfix.com.tr', channelId: 7, channelKey: 'afp_test' }
      : { baseUrl: 'https://agentfix.com.tr', apiToken: 'af_test' },
  );
  const ctx = {
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name: string) => {
      if (!(name in params)) throw new Error(`Could not get parameter ${name}`);
      return params[name];
    },
    getCredentials,
    getNode: () => ({ id: '1', name: 'AgentFix', type: 'agentFix', typeVersion: 1, position: [0, 0], parameters: {} }),
    continueOnFail: () => continueOnFail,
    helpers: { httpRequestWithAuthentication: http },
  };
  return { ctx, http, getCredentials };
}

describe('AgentFix node execute', () => {
  it('sends legacy credentials to the API host with the v1 path', async () => {
    const { ctx, http } = context(
      { resource: 'messageBatches', operation: 'collect', channel: 'whatsapp', conversationId: 'c1', externalId: 'm1', text: 'Selam', sentAt: '' },
      { statusCode: 200, body: { batchId: 'b', shouldProcess: true } },
    );
    const out = await new AgentFix().execute.call(ctx as never);
    expect(http).toHaveBeenCalledWith('agentFixApi', expect.objectContaining({
      method: 'POST',
      url: 'https://api.agentfix.com.tr/v1/ingest/message-batches/collect',
      body: { channel: 'whatsapp', conversationId: 'c1', externalId: 'm1', text: 'Selam' },
    }));
    expect(out[0][0].json).toEqual({ batchId: 'b', shouldProcess: true });
  });

  it('uses the channel credential and its channel id for platform channel calls', async () => {
    const { ctx, http, getCredentials } = context(
      { resource: 'platformChannel', operation: 'replyBatch', batchId: 'b', claimToken: 'c', reply: 'Tamam', handoff: true },
      { statusCode: 200, body: { sent: true } },
    );
    await new AgentFix().execute.call(ctx as never);
    expect(getCredentials).toHaveBeenCalledWith('agentFixPlatformChannelApi', 0);
    expect(http).toHaveBeenCalledWith('agentFixPlatformChannelApi', expect.objectContaining({
      url: 'https://api.agentfix.com.tr/v1/platform/channels/7/message-batches/reply',
      body: { batchId: 'b', claimToken: 'c', reply: 'Tamam', handoff: true },
    }));
  });

  it('surfaces the API error code through NodeApiError', async () => {
    const { ctx } = context(
      { resource: 'crm', operation: 'addNote', contactKey: 'x', text: 'Not', externalId: 'e' },
      { statusCode: 422, body: { error: 'Geçersiz kişi anahtarı.', code: 'INVALID_CONTACT_KEY' } },
    );
    const error = await new AgentFix().execute.call(ctx as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NodeApiError);
    expect(error).toMatchObject({ httpCode: '422', message: 'Geçersiz kişi anahtarı.' });
    expect((error as NodeApiError).description).toContain('INVALID_CONTACT_KEY');
  });

  it('returns code and status as item data when continueOnFail is on', async () => {
    const { ctx } = context(
      { resource: 'messageBatches', operation: 'complete', batchId: 'b', claimToken: 'c' },
      { statusCode: 409, body: { error: 'Mesaj grubu bu akışa ait değil.', code: 'MESSAGE_BATCH_CONFLICT' } },
      true,
    );
    const out = await new AgentFix().execute.call(ctx as never);
    expect(out[0][0].json).toEqual({
      error: 'Mesaj grubu bu akışa ait değil.',
      code: 'MESSAGE_BATCH_CONFLICT',
      status: 409,
    });
  });
});
