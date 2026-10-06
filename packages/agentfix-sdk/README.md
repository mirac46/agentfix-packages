# agentfix-sdk

Resmi AgentFix TypeScript SDK — RAG, hasta/CRM, randevu, ingest ve panel API.

## Kurulum

```bash
npm install agentfix-sdk
```

## Hızlı başlangıç

```ts
import { AgentFix } from 'agentfix-sdk';

const af = new AgentFix({
  apiToken: process.env.AGENTFIX_API_TOKEN!,
});

const me = await af.me();
const hits = await af.rag.query({ query: 'Çalışma saatleri', limit: 6 });
await af.ingest.conversation({
  name: 'Ayşe Yılmaz',
  phone: '+905551112233',
  title: 'Kontrol muayenesi',
  scheduledAt: '2026-09-01T10:00:00+03:00',
  notes: 'AI görüşmesinden randevu',
});
```

Token: kullanıcı paneli → API Erişimi. İzinler: `rag:read`, `rag:write`, `customers:write`, `appointments:write`.

## API

| Alan | Metodlar |
|---|---|
| Account | `me()` |
| RAG | `rag.context()` `rag.query()` `rag.chat()` `rag.sync()` |
| Ingest | `ingest.customer()` `ingest.appointment()` `ingest.callNote()` `ingest.conversation()` |
| Customers | `customers.list()` `customers.get()` `customers.create()` `customers.update()` |
| Appointments | `appointments.list()` `appointments.create()` `appointments.complete()` `appointments.cancel()` |
| Calls | `calls.list()` `calls.createNote()` |
| Offers | `offers.list()` `offers.create()` |
| WhatsApp | `whatsapp.sendMessage()` |
| Chat | `chat.list()` `chat.send()` |
| Email | `email.listThreads()` `email.reply()` |
| Services | `services.getPackages()` |
| Dashboard | `dashboard.get()` |

n8n için ayrı paket: [`n8n-nodes-agentfix`](https://www.npmjs.com/package/n8n-nodes-agentfix).
