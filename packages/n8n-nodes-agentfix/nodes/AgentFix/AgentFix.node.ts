import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  JsonObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeApiError } from 'n8n-workflow';
import { normalizeBaseUrl, parseApiError, pickRagSection, resolveAgentFixRequest } from 'agentfix-sdk';

const PLATFORM_CHANNEL = 'platformChannel';

/** execute() bu adlardaki parametreleri okur; her alan tanımı burada da olmalı. */
export const FIELD_NAMES = [
  'query', 'message', 'name', 'phone', 'email', 'title', 'scheduledAt',
  'notes', 'transcript', 'id', 'customerId', 'accountId', 'limit', 'summary',
  'duration', 'location', 'description', 'status', 'source', 'systemPrompt',
  'category', 'amount', 'items', 'channel', 'conversationId', 'externalId', 'text',
  'sentAt', 'batchId', 'claimToken', 'contactKey', 'eventType', 'eventData', 'eventId',
  'reply', 'handoff', 'question', 'mode', 'history',
] as const;

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
    credentials: [
      {
        name: 'agentFixApi',
        required: true,
        displayOptions: { hide: { resource: [PLATFORM_CHANNEL] } },
      },
      {
        name: 'agentFixPlatformChannelApi',
        required: true,
        displayOptions: { show: { resource: [PLATFORM_CHANNEL] } },
      },
    ],
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
          { name: 'Mesaj Tamponu (Message Buffer)', value: 'messageBatches' },
          { name: 'CRM Otomasyonu (CRM Automation)', value: 'crm' },
          { name: 'Platform Kanalı (Platform Channel)', value: PLATFORM_CHANNEL },
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
          { name: 'Canlı Fiyatlar (Live Pricing)', value: 'pricing', action: 'Güncel katalog fiyatlarını getir (Fetch live catalog prices)' },
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
        displayOptions: { show: { resource: ['messageBatches'] } },
        options: [
          { name: 'Mesajları Topla (Collect)', value: 'collect', action: 'Art arda gelen mesajları tek grupta topla (Collect consecutive messages into one batch)' },
          { name: 'Grubu Tamamla (Complete)', value: 'complete', action: 'İşlenen mesaj grubunu kapat (Close a processed message batch)' },
        ],
        default: 'collect',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['crm'] } },
        options: [
          { name: 'Kişi Bul veya Oluştur (Upsert Contact)', value: 'upsertContact', action: 'Telefon ya da e-postayla kişi anahtarı al (Get a contact key by phone or email)' },
          { name: 'Not Ekle (Add Note)', value: 'addNote', action: 'Kişiye otomasyon notu yaz (Write an automation note to a contact)' },
        ],
        default: 'upsertContact',
      },
      {
        displayName: 'İşlem (Operation)',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: [PLATFORM_CHANNEL] } },
        options: [
          { name: 'Durum (Health)', value: 'health', action: 'Kanal anahtarını doğrula (Verify the channel key)' },
          { name: 'Olay Gönder (Send Event)', value: 'sendEvent', action: 'Kanala gelen olayı ilet (Send an inbound channel event)' },
          { name: 'Olayı Yanıtla (Complete Event)', value: 'completeEvent', action: 'Olaya yanıt yaz ve kapat (Reply to and close an event)' },
          { name: 'Bilgi Sor (Knowledge)', value: 'knowledge', action: 'Kanal bilgi bankasına sor (Ask the channel knowledge base)' },
          { name: 'Mesajları Topla (Collect Messages)', value: 'collectMessages', action: 'Kanal mesajlarını tek grupta topla (Collect channel messages into one batch)' },
          { name: 'Grubu Tamamla (Complete Batch)', value: 'completeBatch', action: 'Kanal mesaj grubunu kapat (Close a channel message batch)' },
          { name: 'Gruba Yanıt Gönder (Reply to Batch)', value: 'replyBatch', action: 'Mesaj grubuna yanıtı kanaldan gönder (Send the batch reply through the channel)' },
        ],
        default: 'health',
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
            resource: ['ingest', 'customers', 'calls', 'crm'],
            operation: ['customer', 'conversation', 'create', 'update', 'createNote', 'callNote', 'upsertContact'],
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
            resource: ['ingest', 'customers', 'calls', 'whatsapp', 'crm'],
            operation: ['customer', 'appointment', 'callNote', 'conversation', 'create', 'update', 'createNote', 'sendMessage', 'upsertContact'],
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
            resource: ['ingest', 'customers', 'crm'],
            operation: ['customer', 'conversation', 'create', 'update', 'upsertContact'],
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
        displayName: 'Tutar (Amount)',
        name: 'amount',
        type: 'number',
        default: 0,
        displayOptions: show('offers', ['create']),
      },
      {
        displayName: 'Kalemler (Items)',
        name: 'items',
        type: 'json',
        default: '[{"name": "", "quantity": 1, "unit_price": 0}]',
        description: 'En az bir kalem: name, quantity, unit_price (At least one item: name, quantity, unit_price).',
        displayOptions: show('offers', ['create']),
      },
      {
        displayName: 'Kategori (Category)',
        name: 'category',
        type: 'string',
        default: '',
        description: 'Bilgi bankasında boşsa tümü; hizmet paketlerinde zorunlu: konusma-paketleri, kurulum-ucretleri, bakim-ucretleri (Optional for RAG; required for service packages).',
        displayOptions: {
          show: {
            resource: ['rag', 'services'],
            operation: ['query', 'chat', 'pricing', 'getPackages'],
          },
        },
      },
      {
        displayName: 'Kanal Türü (Channel)',
        name: 'channel',
        type: 'options',
        options: [
          { name: 'WhatsApp', value: 'whatsapp' },
          { name: 'Messenger', value: 'messenger' },
          { name: 'Instagram', value: 'instagram' },
          { name: 'Web Sohbet (Web Chat)', value: 'web_chat' },
        ],
        default: 'whatsapp',
        description: 'Platform kanalında kanal türüyle aynı olmalı (Must match the channel kind on platform channels).',
        displayOptions: {
          show: { resource: ['messageBatches', PLATFORM_CHANNEL], operation: ['collect', 'collectMessages'] },
        },
      },
      {
        displayName: 'Konuşma Kimliği (Conversation ID)',
        name: 'conversationId',
        type: 'string',
        default: '',
        required: true,
        description: 'Aynı kişiden gelen mesajları gruplayan anahtar, ör. telefon (Key that groups one sender, e.g. phone).',
        displayOptions: {
          show: { resource: ['messageBatches', PLATFORM_CHANNEL], operation: ['collect', 'collectMessages'] },
        },
      },
      {
        displayName: 'Dış Kimlik (External ID)',
        name: 'externalId',
        type: 'string',
        default: '',
        required: true,
        description: 'Tekrarı önleyen benzersiz kimlik; platform kanalında olay kimliği (Unique ID for idempotency; event ID on platform channels).',
        displayOptions: {
          show: {
            resource: ['messageBatches', 'crm', PLATFORM_CHANNEL],
            operation: ['collect', 'addNote', 'sendEvent', 'collectMessages'],
          },
        },
      },
      {
        displayName: 'Metin (Text)',
        name: 'text',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['messageBatches', 'crm', PLATFORM_CHANNEL],
            operation: ['collect', 'addNote', 'collectMessages'],
          },
        },
      },
      {
        displayName: 'Gönderim Zamanı (Sent At)',
        name: 'sentAt',
        type: 'string',
        default: '',
        placeholder: '2026-10-07T10:00:00+03:00',
        description: 'Saat dilimli ISO tarih; boşsa sunucu zamanı (ISO date with offset; server time when empty).',
        displayOptions: {
          show: { resource: ['messageBatches', PLATFORM_CHANNEL], operation: ['collect', 'collectMessages'] },
        },
      },
      {
        displayName: 'Grup Kimliği (Batch ID)',
        name: 'batchId',
        type: 'string',
        default: '',
        required: true,
        description: 'Topla işleminin döndürdüğü batchId (batchId returned by Collect).',
        displayOptions: {
          show: {
            resource: ['messageBatches', PLATFORM_CHANNEL],
            operation: ['complete', 'completeBatch', 'replyBatch'],
          },
        },
      },
      {
        displayName: 'Sahiplik Anahtarı (Claim Token)',
        name: 'claimToken',
        type: 'string',
        default: '',
        required: true,
        description: 'Topla işleminin döndürdüğü claimToken (claimToken returned by Collect).',
        displayOptions: {
          show: {
            resource: ['messageBatches', PLATFORM_CHANNEL],
            operation: ['complete', 'completeBatch', 'replyBatch'],
          },
        },
      },
      {
        displayName: 'Kişi Anahtarı (Contact Key)',
        name: 'contactKey',
        type: 'string',
        default: '',
        required: true,
        description: 'Kişi Bul veya Oluştur işleminin döndürdüğü contactKey (contactKey returned by Upsert Contact).',
        displayOptions: show('crm', ['addNote']),
      },
      {
        displayName: 'Kaynak (Source)',
        name: 'source',
        type: 'options',
        options: [
          { name: 'n8n', value: 'n8n' },
          { name: 'WhatsApp', value: 'whatsapp' },
          { name: 'API', value: 'api' },
          { name: 'Ajan (Agent)', value: 'agent' },
        ],
        default: 'n8n',
        displayOptions: show('crm', ['upsertContact']),
      },
      {
        displayName: 'Olay Türü (Event Type)',
        name: 'eventType',
        type: 'options',
        options: [
          { name: 'Mesaj Geldi (Message Received)', value: 'message.received' },
          { name: 'Çağrı Bitti (Call Completed)', value: 'call.completed' },
          { name: 'Teslim Durumu (Delivery Updated)', value: 'delivery.updated' },
        ],
        default: 'message.received',
        displayOptions: show(PLATFORM_CHANNEL, ['sendEvent']),
      },
      {
        displayName: 'Olay Verisi (Event Data)',
        name: 'eventData',
        type: 'json',
        default: '{"text": "", "from": "", "conversationId": ""}',
        description: 'text, from, fromName, to, subject, conversationId, providerMessageId, status, durationSeconds, history',
        displayOptions: show(PLATFORM_CHANNEL, ['sendEvent']),
      },
      {
        displayName: 'Olay Kimliği (Event ID)',
        name: 'eventId',
        type: 'string',
        default: '',
        required: true,
        description: 'Olay Gönder yanıtındaki eventId (eventId from the Send Event response).',
        displayOptions: show(PLATFORM_CHANNEL, ['completeEvent']),
      },
      {
        displayName: 'Yanıt (Reply)',
        name: 'reply',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        required: true,
        displayOptions: show(PLATFORM_CHANNEL, ['completeEvent', 'replyBatch']),
      },
      {
        displayName: 'İnsana Devret (Handoff)',
        name: 'handoff',
        type: 'boolean',
        default: false,
        description: 'Yanıttan sonra konuşmayı ekibe devreder (Hands the conversation to the team after replying).',
        displayOptions: show(PLATFORM_CHANNEL, ['replyBatch']),
      },
      {
        displayName: 'Soru (Question)',
        name: 'question',
        type: 'string',
        default: '',
        required: true,
        displayOptions: show(PLATFORM_CHANNEL, ['knowledge']),
      },
      {
        displayName: 'Mod (Mode)',
        name: 'mode',
        type: 'options',
        options: [
          { name: 'Yanıt Üret (Answer)', value: 'answer' },
          { name: 'Yalnız Ara (Search)', value: 'search' },
        ],
        default: 'answer',
        displayOptions: show(PLATFORM_CHANNEL, ['knowledge']),
      },
      {
        displayName: 'Geçmiş (History)',
        name: 'history',
        type: 'json',
        default: '[]',
        description: 'En çok 12 adet {"role": "user" | "assistant", "content": "..."} (Up to 12 messages).',
        displayOptions: {
          show: { resource: ['rag', PLATFORM_CHANNEL], operation: ['chat', 'knowledge'] },
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

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      try {
        const resource = this.getNodeParameter('resource', itemIndex) as string;
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const credentialName = resource === PLATFORM_CHANNEL ? 'agentFixPlatformChannelApi' : 'agentFixApi';
        const credentials = await this.getCredentials(credentialName, itemIndex);
        const fields: Record<string, unknown> = {};
        for (const name of FIELD_NAMES) {
          try {
            fields[name] = this.getNodeParameter(name, itemIndex);
          } catch {
            // optional field missing for this operation
          }
        }
        if (resource === PLATFORM_CHANNEL) fields.channelId = credentials.channelId;

        const resolved = resolveAgentFixRequest({ resource, operation, fields });
        const response = (await this.helpers.httpRequestWithAuthentication.call(this, credentialName, {
          method: resolved.method,
          url: `${normalizeBaseUrl(credentials.baseUrl)}${resolved.path}`,
          qs: resolved.qs,
          body: resolved.body,
          json: true,
          returnFullResponse: true,
          ignoreHttpStatusErrors: true,
        })) as { statusCode: number; body: unknown };

        if (response.statusCode >= 400) {
          const info = parseApiError(response.statusCode, response.body);
          const errorBody: JsonObject = { error: info.message, code: info.code, status: info.status };
          if (info.details !== undefined) errorBody.details = info.details as JsonObject;
          throw new NodeApiError(this.getNode(), errorBody, {
            message: info.message,
            description: info.code ? `AgentFix hata kodu (error code): ${info.code}` : undefined,
            httpCode: String(info.status),
            itemIndex,
          });
        }

        const sliced = resource === 'rag' ? pickRagSection(response.body, operation) : response.body;
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
          const apiError = error instanceof NodeApiError ? error : null;
          const code = apiError?.errorResponse?.code;
          returnData.push({
            json: {
              error: error instanceof Error ? error.message : String(error),
              code: typeof code === 'string' ? code : null,
              status: apiError?.httpCode ? Number(apiError.httpCode) : null,
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }
        if (error instanceof NodeApiError) throw error;
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
