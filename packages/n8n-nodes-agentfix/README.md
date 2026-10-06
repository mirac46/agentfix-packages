# n8n-nodes-agentfix

[![npm](https://img.shields.io/npm/v/n8n-nodes-agentfix?label=n8n-nodes-agentfix)](https://www.npmjs.com/package/n8n-nodes-agentfix)
[![sdk](https://img.shields.io/npm/v/agentfix-sdk?label=agentfix-sdk)](https://www.npmjs.com/package/agentfix-sdk)

[AgentFix](https://agentfix.com.tr) resmi n8n community node’u. Ses/chat ajanı görüşmeyi bitirince hastayı, randevuyu ve çağrı notunu AgentFix’e yazar; bilgi bankasında arar; CRM, teklif, WhatsApp, e-posta ve panoyu aynı credential ile kullanır.

Kurulum bir kez. Credential: panel API token + `https://api.agentfix.com.tr`.

## Ne işe yarar

| Senaryo | Node |
|---|---|
| AI görüşmesi bitti → hasta + randevu + not | **Ingest → Save Conversation** |
| Bilgi bankasında ara / sor | **RAG → Query** / **Chat** |
| Hasta listele / oluştur / güncelle | **Customer / Patient** |
| Randevu oluştur, tamamla, iptal | **Appointment** |
| WhatsApp mesajı gönder | **WhatsApp → Send Message** |
| E-posta yanıtla | **Email → Reply** |
| Bugünkü özet | **Dashboard → Get** |

Telefon aynıysa hasta tekilleştirilir; ikinci kez aynı numarayı yazmak yeni kayıt açmaz.

## Kurulum

### n8n GUI (önerilen)

1. **Settings → Community Nodes → Install**
2. Paket: `n8n-nodes-agentfix`
3. **Install**

### Self-hosted

```bash
cd ~/.n8n/custom
npm install n8n-nodes-agentfix
```

n8n’i yeniden başlat. Palette **AgentFix** görünür.

## Credential

**Credentials → New → AgentFix API**

| Alan | Değer |
|---|---|
| Base URL | `https://api.agentfix.com.tr` (sonda `/v1` yok; self-host’ta kendi origin) |
| API Token | Kullanıcı paneli → **API Erişimi** |

Token izinleri (varsayılan):

- `rag:read` `rag:write`
- `customers:write` (ingest / ajan yazımı bu izni kullanır)
- `appointments:write`

**Test** yeşil olmalı. Token bir kez gösterilir.

0.1.x’ten kalan `https://agentfix.com.tr` kayıtları düğümde otomatik olarak `https://api.agentfix.com.tr`’ye çevrilir; credential **Test** düğmesi için adresi elle güncelleyin.

**Platform Channel** kaynağı ayrı credential kullanır: **AgentFix Platform Channel API** (Base URL, kanal numarası, `afp_` ile başlayan kanal anahtarı). Test isteği `GET /v1/platform/channels/<kanal>/health`.

## Kaynaklar

### Account

- **Get Current User** — token doğrula (`GET /v1/me`)

### RAG

Paneldeki bilgi bankası sekmeleri:

- **Get About Us (Hakkımızda)** — şirket / hekim metni
- **Get Services (Hizmetler)** — hizmet ve fiyat kataloğu
- **Get FAQs (SSS)**
- **Get Persona** — asistan kişiliği
- **Get Documents** — özel belgeler
- **Get All Context** — hepsi birden
- **Query** — chunk arama
- **Chat** — asistan sorusu
- **Sync** — bilgi bankasını güncelle
- **Live Pricing** — güncel katalog fiyatları (`GET /v1/rag/pricing`, vektör değil)

### Ingest (ajan yazımı)

AI / n8n akışı konuşma bitince bunları kullanır. JWT değil, API token.

- **Upsert Patient** — telefon ile hasta
- **Create Appointment** — randevu
- **Save Call Note** — görüşme özeti
- **Save Conversation** — üçünü birden (önerilen)

Örnek gövde (Save Conversation):

```json
{
  "name": "Ayşe Yılmaz",
  "phone": "+905551112233",
  "title": "Kontrol muayenesi",
  "scheduledAt": "2026-09-01T10:00:00+03:00",
  "notes": "AI görüşmesinden randevu"
}
```

### Message Buffer (mesaj tamponu)

Art arda gelen mesajları tek yanıtta toplar; n8n’de Postgres kuyruğu + Wait kurmaya gerek kalmaz.

- **Collect** — `POST /v1/ingest/message-batches/collect`: `channel` (whatsapp, messenger, instagram, web_chat), `conversationId`, `externalId`, `text`, `sentAt`. İstek bekleme süresi (en çok 30 sn) kadar açık kalır; grubu işleyecek tek çağrı `shouldProcess: true`, `batchId`, `claimToken` ve birleşik `message` alır.
- **Complete** — `POST /v1/ingest/message-batches/complete`: `batchId`, `claimToken`.

### CRM Automation

- **Upsert Contact** — `POST /v1/ingest/crm-contact`: ad, telefon veya e-posta → `contactKey`.
- **Add Note** — `POST /v1/ingest/crm-note`: `contactKey`, `text`, `externalId` (tekrarı önler).

### Platform Channel

Kanal anahtarıyla çalışan dış kanal uçları (`/v1/platform/channels/<kanal>/…`): Health, Send Event, Complete Event, Knowledge, Collect Messages, Complete Batch, Reply to Batch (isteğe bağlı insana devir).

### Customer / Patient

Get Many, Get, Create, Update

### Appointment

Get Many, Create, Complete, Cancel

### Call

Get Many, Save Note

### Offer

Get Many, Create — oluştururken `customerId` (sayı), tutar ve en az bir kalem (`items`: name, quantity, unit_price) zorunlu.

### WhatsApp

Send Message — `accountId`, telefon, metin

### Chat / Email / Services / Dashboard

Paneldeki sohbet, e-posta thread yanıtı, paket listesi (kategori zorunlu: `konusma-paketleri`, `kurulum-ucretleri`, `bakim-ucretleri`), pano istatistikleri.

## Tipik akış

```
[Webhook / Voice agent bitti]
        ↓
[AgentFix: Ingest → Save Conversation]
        ↓
[AgentFix: RAG → Query]  (gerekirse bilgi çek)
        ↓
[AgentFix: WhatsApp → Send Message]  (onay SMS / hatırlatma)
```

## Node.js projesi

Aynı API için TypeScript SDK: [`agentfix-sdk`](https://www.npmjs.com/package/agentfix-sdk)

```ts
import { AgentFix } from 'agentfix-sdk';

const af = new AgentFix({
  apiToken: process.env.AGENTFIX_API_TOKEN!, // baseUrl varsayılanı https://api.agentfix.com.tr
});

await af.ingest.conversation({
  name: 'Ayşe Yılmaz',
  phone: '+905551112233',
  title: 'Kontrol',
  scheduledAt: '2026-09-01T10:00:00+03:00',
});
```

## Sorun giderme

**Credential kırmızı:** token paneldan yeni üret; Base URL sonunda `/` olmasın.

**Ingest 403:** tokenda `customers:write` yok.

**Hata kodu:** API hataları `{ error, code, details? }` döner; düğüm `code`’u hata açıklamasında, *Continue On Fail* açıkken çıktıda `error`, `code`, `status` alanlarında gösterir.

**Community node görünmüyor:** `N8N_COMMUNITY_PACKAGES_ENABLED=true` ve `N8N_UNVERIFIED_PACKAGES_ENABLED=true`. Queue Mode’da paketi worker’lara da kur.

**Python runner uyarısı:** yok say; bu node JS.

## Lisans

MIT — [agentfix.com.tr](https://agentfix.com.tr)
