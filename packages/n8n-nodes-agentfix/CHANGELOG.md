# Değişiklikler

## 0.4.0

Yeni:

- Platform Channel → **Agent Config** (`GET /v1/platform/channels/:kanal/agent-config`): kanalın AI Agent talimatı,
  kanal kuralları, model, mesaj birleştirme süresi, test modu ve ayar özeti. Akış her mesajda okur; panelde değişen
  talimat akışı yeniden kurmadan bir sonraki mesajda geçerli olur.
- SDK: `platformChannel.agentConfig()` ve `AgentConfig` tipi.

Değişiklikler:

- `agentfix-sdk` 0.4.0'a yükseltildi.

## 0.3.0

Yeni:

- Platform Channel → **Contact Context** (`GET /v1/platform/channels/:kanal/contacts/:kişi/context`): kişinin kayıtlı
  kullanıcı, potansiyel müşteri ve son talep özeti.
- Platform Channel → **Upsert Lead** (`POST /v1/platform/channels/:kanal/contacts/:kişi/lead`): ad, kurum, hizmet, özet,
  e-posta, telefon ve `needs` nesnesi. Boş alan gönderilmez; `needs` en çok 30 anahtar, `summary` en çok 4000 karakter
  olarak istekten önce denetlenir.
- SDK: `platformChannel.contactContext()` ve `platformChannel.upsertLead()`; `ContactContext`, `LeadUpsertInput`,
  `LeadUpsertResult` tipleri.

Değişiklikler:

- `agentfix-sdk` 0.3.0'a yükseltildi.

## 0.2.0

Yeni:

- **Message Buffer** kaynağı: Collect ve Complete (`/v1/ingest/message-batches/*`).
- **CRM Automation** kaynağı: Upsert Contact ve Add Note (`/v1/ingest/crm-contact`, `/v1/ingest/crm-note`).
- **Platform Channel** kaynağı ve **AgentFix Platform Channel API** credential'ı: Health, Send Event, Complete Event,
  Knowledge, Collect Messages, Complete Batch, Reply to Batch.
- RAG → **Live Pricing** (`/v1/rag/pricing`) ve Query/Chat için kategori filtresi.
- API hata gövdesi `{ error, code, details? }` düğüm hatasına taşınır: HTTP kodu, mesaj ve `code`; *Continue On Fail*
  açıkken çıktı `error`, `code`, `status` alanlarını içerir.

Değişiklikler:

- Varsayılan Base URL `https://api.agentfix.com.tr`, yol öneki `/v1` (eskiden `https://agentfix.com.tr` + `/api/v1`).
  Kayıtlı eski `agentfix.com.tr` adresleri istek sırasında API alan adına çevrilir; sonda bırakılmış `/api`, `/v1`
  temizlenir.
- `agentfix-sdk` 0.2.0'a yükseltildi.

Düzeltmeler:

- Chat → Send Message gövdesi `message` (sunucu yalnız bu alanı okur; `content`/`text` boş mesaj sayılıyordu).
- Email → Reply gövdesi `bodyText` (önceki `text` alanı reddediliyordu).
- Offer → Create: `customer_id` sayı, `amount` ve zorunlu `items` kalemleri gönderilir.
- Services → Get Packages kategori parametresini gönderir; kategori boşsa istek gönderilmeden hata verilir.
- Ağ ve zaman aşımı gibi HTTP dışı hatalarda düğüm hatası yalnız mesajı taşır; istek başlıkları (API anahtarı) yürütme
  kaydına düşmez.
