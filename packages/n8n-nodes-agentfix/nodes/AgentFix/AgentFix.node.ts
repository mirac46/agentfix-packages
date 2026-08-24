import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  JsonObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeApiError } from 'n8n-workflow';
import { pickRagSection, resolveAgentFixRequest } from 'agentfix-sdk';

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
    icon: { light: 'file:agentfix.png', dark: 'file:agentfix.dark.png' },
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'AgentFix bilgi bankası, hasta, randevu ve ajan yazma API (RAG, patients, appointments, agent ingest)',
    defaults: { name: 'AgentFix' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: 'agentFixApi', required: true }],
    properties: [
      {
        displayName: 'Kaynak (Resource)',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Hesap (Account)', value: 'account' },
          { name: 'Bilgi Bankası (RAG)', value: 'rag' },
          { name: 'Ajan Yazımı (Ingest)', value: 'ingest' },
          { name: 'Hasta / Müşteri (Customer / Patient)', value: 'customers' },
          { name: 'Randevu (Appointment)', value: 'appointments' },
          { name: 'Çağrı (Call)', value: 'calls' },
          { name: 'Teklif (Offer)', value: 'offers' },
          { name: 'WhatsApp (WhatsApp)', value: 'whatsapp' },
          { name: 'Sohbet (Chat)', value: 'chat' },
          { name: 'E-posta (Email)', value: 'email' },
          { name: 'Hizmet Paketleri (Services)', value: 'services' },
          { name: 'Pano (Dashboard)', value: 'dashboard' },
        ],
        default: 'rag',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['account'] } },
        options: [{ name: 'Mevcut Kullanıcıyı Getir (Get Current User)', value: 'me', action: 'API token doğrula (Verify API token)' }],
        default: 'me',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['rag'] } },
        options: [
          { name: 'Hakkımızda Getir (Get About Us)', value: 'getAbout', action: 'Şirket hakkımızda bölümünü getir (Get company about section)' },
          { name: 'Hizmetleri Getir (Get Services)', value: 'getServices', action: 'Hizmet kataloğunu getir (Get services catalog)' },
          { name: 'SSS Getir (Get FAQs)', value: 'getFaqs', action: 'Sık sorulan soruları getir (Get frequently asked questions)' },
          { name: 'Persona Getir (Get Persona)', value: 'getPersona', action: 'Asistan kişiliğini getir (Get assistant persona)' },
          { name: 'Belgeleri Getir (Get Documents)', value: 'getDocuments', action: 'Özel bilgi belgelerini getir (Get custom knowledge documents)' },
          { name: 'Tüm Bağlamı Getir (Get All Context)', value: 'context', action: 'Derlenmiş bilgi bankasını getir (Get compiled RAG context)' },
          { name: 'Sorgula (Query)', value: 'query', action: 'Bilgi parçalarında ara (Search knowledge chunks)' },
          { name: 'Sohbet Et (Chat)', value: 'chat', action: 'Bilgi bankası asistanına sor (Ask the RAG assistant)' },
          { name: 'Senkronize Et (Sync)', value: 'sync', action: 'Bilgi bankasını güncelle (Update knowledge base)' },
        ],
        default: 'getServices',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['ingest'] } },
        options: [
          { name: 'Hasta Yaz (Upsert Patient)', value: 'customer', action: 'Ajandan hasta yaz (Write patient from agent)' },
          { name: 'Randevu Oluştur (Create Appointment)', value: 'appointment', action: 'Ajandan randevu yaz (Write appointment from agent)' },
          { name: 'Çağrı Notu Kaydet (Save Call Note)', value: 'callNote', action: 'Görüşme özetini kaydet (Write conversation summary)' },
          { name: 'Görüşmeyi Kaydet (Save Conversation)', value: 'conversation', action: 'Hasta, randevu ve notu birlikte yaz (Write patient appointment and notes together)' },
        ],
        default: 'conversation',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['customers'] } },
        options: [
          { name: 'Listele (Get Many)', value: 'getAll', action: 'Hastaları listele (List patients)' },
          { name: 'Getir (Get)', value: 'get', action: 'Hastayı getir (Get a patient)' },
          { name: 'Oluştur (Create)', value: 'create', action: 'Hasta oluştur (Create a patient)' },
          { name: 'Güncelle (Update)', value: 'update', action: 'Hastayı güncelle (Update a patient)' },
        ],
        default: 'getAll',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['appointments'] } },
        options: [
          { name: 'Listele (Get Many)', value: 'getAll', action: 'Randevuları listele (List appointments)' },
          { name: 'Oluştur (Create)', value: 'create', action: 'Randevu oluştur (Create an appointment)' },
          { name: 'Tamamla (Complete)', value: 'complete', action: 'Randevuyu tamamlandı işaretle (Mark appointment completed)' },
          { name: 'İptal Et (Cancel)', value: 'cancel', action: 'Randevuyu iptal et (Cancel an appointment)' },
        ],
        default: 'getAll',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['calls'] } },
        options: [
          { name: 'Listele (Get Many)', value: 'getAll', action: 'Çağrıları listele (List calls)' },
          { name: 'Not Kaydet (Save Note)', value: 'createNote', action: 'Çağrı notu kaydet (Save a call note)' },
        ],
        default: 'getAll',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['offers'] } },
        options: [
          { name: 'Listele (Get Many)', value: 'getAll', action: 'Teklifleri listele (List offers)' },
          { name: 'Oluştur (Create)', value: 'create', action: 'Teklif oluştur (Create an offer)' },
        ],
        default: 'getAll',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['whatsapp'] } },
        options: [{ name: 'Mesaj Gönder (Send Message)', value: 'sendMessage', action: 'WhatsApp mesajı gönder (Send a WhatsApp message)' }],
        default: 'sendMessage',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['chat'] } },
        options: [
          { name: 'Listele (Get Many)', value: 'getAll', action: 'Sohbetleri listele (List chats)' },
          { name: 'Mesaj Gönder (Send Message)', value: 'send', action: 'Sohbet mesajı gönder (Send a chat message)' },
        ],
        default: 'getAll',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['email'] } },
        options: [
          { name: 'Konuları Listele (List Threads)', value: 'listThreads', action: 'E-posta konularını listele (List email threads)' },
          { name: 'Yanıtla (Reply)', value: 'reply', action: 'E-posta konusunu yanıtla (Reply to an email thread)' },
        ],
        default: 'listThreads',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['services'] } },
        options: [{ name: 'Paketleri Getir (Get Packages)', value: 'getPackages', action: 'Hizmet paketlerini listele (List service packages)' }],
        default: 'getPackages',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['dashboard'] } },
        options: [{ name: 'Getir (Get)', value: 'get', action: 'Pano istatistiklerini getir (Get dashboard stats)' }],
        default: 'get',
      },
      {
        displayName: 'Sorgu (Query)',
        name: 'query',
        type: 'string',
        default: '',
        required: true,
        displayOptions: show('rag', ['query']),
      },
      {
        displayName: 'Mesaj (Message)',
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
        displayName: 'Ad Soyad (Name)',
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
        displayName: 'Telefon (Phone)',
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
        displayName: 'E-posta (Email)',
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
        displayName: 'Başlık (Title)',
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
        displayName: 'Tarih / Saat (Scheduled At)',
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
        displayName: 'Notlar (Notes)',
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
        displayName: 'Transkript (Transcript)',
        name: 'transcript',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        displayOptions: show('ingest', ['callNote', 'conversation']),
      },
      {
        displayName: 'Kimlik (ID)',
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
        displayName: 'Hasta Kimliği (Customer ID)',
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
        displayName: 'Hesap Kimliği (Account ID)',
        name: 'accountId',
        type: 'number',
        default: 0,
        displayOptions: show('whatsapp', ['sendMessage']),
      },
      {
        displayName: 'Limit (Limit)',
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

        const sliced = resource === 'rag' ? pickRagSection(response, operation) : response;
        const payload = Array.isArray(sliced) ? sliced : [sliced];
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
