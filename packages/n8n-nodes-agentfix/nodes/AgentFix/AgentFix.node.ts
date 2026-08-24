import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  JsonObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeApiError } from 'n8n-workflow';
import { resolveAgentFixRequest } from 'agentfix-sdk';

function show(resource: string, operations: string[]) {
  return {
    show: {
      resource: [resource],
      operation: operations,
    },
  };
}

export class AgentFix implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'AgentFix',
    name: 'agentFix',
    icon: 'file:agentfix.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'AgentFix RAG, hasta, randevu ve ajan ingest API',
    defaults: { name: 'AgentFix' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: 'agentFixApi', required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Account', value: 'account' },
          { name: 'RAG', value: 'rag' },
          { name: 'Ingest (Agent Write)', value: 'ingest' },
          { name: 'Customer / Patient', value: 'customers' },
          { name: 'Appointment', value: 'appointments' },
          { name: 'Call', value: 'calls' },
          { name: 'Offer', value: 'offers' },
          { name: 'WhatsApp', value: 'whatsapp' },
          { name: 'Chat', value: 'chat' },
          { name: 'Email', value: 'email' },
          { name: 'Services', value: 'services' },
          { name: 'Dashboard', value: 'dashboard' },
        ],
        default: 'rag',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['account'] } },
        options: [{ name: 'Get Current User', value: 'me', action: 'Verify API token' }],
        default: 'me',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['rag'] } },
        options: [
          { name: 'Get Context', value: 'context', action: 'Get compiled RAG context' },
          { name: 'Query', value: 'query', action: 'Search knowledge chunks' },
          { name: 'Chat', value: 'chat', action: 'Ask the RAG assistant' },
          { name: 'Sync', value: 'sync', action: 'Update knowledge base' },
        ],
        default: 'query',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['ingest'] } },
        options: [
          { name: 'Upsert Patient', value: 'customer', action: 'Write patient from agent' },
          { name: 'Create Appointment', value: 'appointment', action: 'Write appointment from agent' },
          { name: 'Save Call Note', value: 'callNote', action: 'Write conversation summary' },
          { name: 'Save Conversation', value: 'conversation', action: 'Write patient appointment and notes together' },
        ],
        default: 'conversation',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['customers'] } },
        options: [
          { name: 'Get Many', value: 'getAll', action: 'List patients' },
          { name: 'Get', value: 'get', action: 'Get a patient' },
          { name: 'Create', value: 'create', action: 'Create a patient' },
          { name: 'Update', value: 'update', action: 'Update a patient' },
        ],
        default: 'getAll',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['appointments'] } },
        options: [
          { name: 'Get Many', value: 'getAll', action: 'List appointments' },
          { name: 'Create', value: 'create', action: 'Create an appointment' },
          { name: 'Complete', value: 'complete', action: 'Mark appointment completed' },
          { name: 'Cancel', value: 'cancel', action: 'Cancel an appointment' },
        ],
        default: 'getAll',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['calls'] } },
        options: [
          { name: 'Get Many', value: 'getAll', action: 'List calls' },
          { name: 'Save Note', value: 'createNote', action: 'Save a call note' },
        ],
        default: 'getAll',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['offers'] } },
        options: [
          { name: 'Get Many', value: 'getAll', action: 'List offers' },
          { name: 'Create', value: 'create', action: 'Create an offer' },
        ],
        default: 'getAll',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['whatsapp'] } },
        options: [{ name: 'Send Message', value: 'sendMessage', action: 'Send a WhatsApp message' }],
        default: 'sendMessage',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['chat'] } },
        options: [
          { name: 'Get Many', value: 'getAll', action: 'List chats' },
          { name: 'Send Message', value: 'send', action: 'Send a chat message' },
        ],
        default: 'getAll',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['email'] } },
        options: [
          { name: 'List Threads', value: 'listThreads', action: 'List email threads' },
          { name: 'Reply', value: 'reply', action: 'Reply to an email thread' },
        ],
        default: 'listThreads',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['services'] } },
        options: [{ name: 'Get Packages', value: 'getPackages', action: 'List service packages' }],
        default: 'getPackages',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['dashboard'] } },
        options: [{ name: 'Get', value: 'get', action: 'Get dashboard stats' }],
        default: 'get',
      },
      {
        displayName: 'Query',
        name: 'query',
        type: 'string',
        default: '',
        required: true,
        displayOptions: show('rag', ['query']),
      },
      {
        displayName: 'Message',
        name: 'message',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['rag', 'whatsapp', 'chat', 'email'],
            operation: ['chat', 'sendMessage', 'send', 'reply'],
          },
        },
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['ingest', 'customers', 'calls'],
            operation: ['customer', 'conversation', 'create', 'update', 'createNote', 'callNote'],
          },
        },
      },
      {
        displayName: 'Phone',
        name: 'phone',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['ingest', 'customers', 'calls', 'whatsapp'],
            operation: ['customer', 'appointment', 'callNote', 'conversation', 'create', 'update', 'createNote', 'sendMessage'],
          },
        },
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['ingest', 'customers'],
            operation: ['customer', 'conversation', 'create', 'update'],
          },
        },
      },
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['ingest', 'appointments', 'offers'],
            operation: ['appointment', 'conversation', 'create'],
          },
        },
      },
      {
        displayName: 'Scheduled At',
        name: 'scheduledAt',
        type: 'dateTime',
        default: '',
        displayOptions: {
          show: {
            resource: ['ingest', 'appointments'],
            operation: ['appointment', 'conversation', 'create'],
          },
        },
      },
      {
        displayName: 'Notes',
        name: 'notes',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        displayOptions: {
          show: {
            resource: ['ingest', 'customers', 'appointments', 'calls', 'offers'],
            operation: ['customer', 'appointment', 'callNote', 'conversation', 'create', 'update', 'createNote'],
          },
        },
      },
      {
        displayName: 'Transcript',
        name: 'transcript',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        displayOptions: show('ingest', ['callNote', 'conversation']),
      },
      {
        displayName: 'ID',
        name: 'id',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['customers', 'appointments', 'chat', 'email'],
            operation: ['get', 'update', 'complete', 'cancel', 'send', 'reply'],
          },
        },
      },
      {
        displayName: 'Customer ID',
        name: 'customerId',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['ingest', 'appointments', 'offers', 'calls', 'customers'],
            operation: ['appointment', 'conversation', 'create', 'getAll', 'createNote'],
          },
        },
      },
      {
        displayName: 'Account ID',
        name: 'accountId',
        type: 'number',
        default: 0,
        displayOptions: show('whatsapp', ['sendMessage']),
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 20,
        displayOptions: {
          show: {
            resource: ['rag', 'customers', 'appointments', 'calls', 'offers'],
            operation: ['query', 'getAll'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('agentFixApi');
    const baseUrl = String(credentials.baseUrl || 'https://agentfix.com.tr').replace(/\/$/, '');

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      try {
        const resource = this.getNodeParameter('resource', itemIndex) as string;
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const fields: Record<string, unknown> = {};
        for (const name of [
          'query', 'message', 'name', 'phone', 'email', 'title', 'scheduledAt',
          'notes', 'transcript', 'id', 'customerId', 'accountId', 'limit', 'summary',
          'duration', 'location', 'description', 'status', 'source', 'systemPrompt',
        ]) {
          try {
            fields[name] = this.getNodeParameter(name, itemIndex);
          } catch {
            // optional field missing for this operation
          }
        }

        const resolved = resolveAgentFixRequest({ resource, operation, fields });
        const response = await this.helpers.httpRequestWithAuthentication.call(this, 'agentFixApi', {
          method: resolved.method,
          url: `${baseUrl}${resolved.path}`,
          qs: resolved.qs,
          body: resolved.body,
          json: true,
        });

        const payload = Array.isArray(response) ? response : [response];
        for (const entry of payload) {
          const json: IDataObject =
            entry !== null && typeof entry === 'object' && !Array.isArray(entry)
              ? (entry as IDataObject)
              : { data: entry as IDataObject[string] };
          returnData.push({ json, pairedItem: { item: itemIndex } });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error instanceof Error ? error.message : String(error) },
            pairedItem: { item: itemIndex },
          });
          continue;
        }
        const jsonError: JsonObject =
          error !== null && typeof error === 'object'
            ? (error as JsonObject)
            : { message: String(error) };
        throw new NodeApiError(this.getNode(), jsonError, { itemIndex });
      }
    }

    return [returnData];
  }
}
