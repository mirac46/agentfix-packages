export type LeadNeedsValue = string | number | boolean | string[];

/**
 * Önerilen anahtarlar: organizationName, organizationType, city, channels,
 * monthlyVolume, staffCount, currentTools, timeline. En çok 30 anahtar.
 */
export type LeadNeeds = Record<string, LeadNeedsValue>;

export interface ContactUser {
  id: number;
  name: string | null;
  maskedEmail: string | null;
  registeredAt: string | null;
  lastLoginAt: string | null;
  businessType: string | null;
  activePackages: { count: number; names: string[] };
  pendingRequests: number;
}

export interface ContactLead {
  id: number;
  status: string | null;
  source: string | null;
  name: string | null;
  serviceName: string | null;
  organization: string | null;
  summary: string | null;
  needs: LeadNeeds | null;
  adminNotes: string | null;
  createdAt: string | null;
  lastContactAt: string | null;
}

export interface ContactRequest {
  kind: string;
  id: number | string;
  name: string | null;
  status: string | null;
  state: string | null;
  createdAt: string | null;
}

export interface ContactContext {
  contact: string;
  channelKind: string;
  conversationId: string | null;
  displayName: string | null;
  isRegisteredUser: boolean;
  identityVerified: boolean;
  user: ContactUser | null;
  lead: ContactLead | null;
  recentRequests: ContactRequest[];
}

/** Kanalın AI Agent ayarları; akış her mesajda okur, panelde değişince bir sonraki mesajda geçerlidir. */
export interface AgentConfig {
  /** Kuruma ve kanala özel talimat. */
  instructions: string;
  /** Kanal ve güvenlik kuralları; kurum talimatıyla çelişirse bunlar geçerlidir. */
  rules: string;
  model: string;
  /** null: modelin varsayılanı. */
  temperature: number | null;
  mergeWindowSec: number;
  testMode: boolean;
  /** Satış görüşmesinden önce sorulacak keşif soruları (istem bloğu); eski sunucuda yok. */
  discovery?: string;
  /** Randevu kuralı: müsait günler ve başka gün istenince söylenecek cümle; eski sunucuda yok. */
  appointments?: string;
  /** Ayarların özeti; herhangi bir ayar değişince değişir. */
  version: string;
}

/** Boş bırakılan alan gönderilmez; sunucu kayıttaki değeri korur. */
export interface LeadUpsertInput {
  name?: string;
  organization?: string;
  serviceName?: string;
  /** En çok 4000 karakter. */
  summary?: string;
  email?: string;
  phone?: string;
  needs?: LeadNeeds;
}

export interface LeadUpsertResult {
  lead: ContactLead;
  created: boolean;
}

export interface AvailabilitySlot {
  /** UTC anı (ISO 8601). */
  startsAt: string;
  /** Kişiye okunacak biçim: "Cumartesi 18 Ekim, 10:00". */
  label: string;
}

export interface AppointmentAvailability {
  enabled: boolean;
  timeZone: string;
  slotMinutes: number;
  allowedDays: string[];
  /** Müsait olmayan gün istenince kişiye söylenecek cümle. */
  message: string;
  days: Array<{ date: string; weekday: number; label: string; slots: AvailabilitySlot[] }>;
}

export interface AppointmentAvailabilityQuery {
  /** İlk gün (YYYY-MM-DD), randevu saat diliminde. */
  from?: string;
  days?: number;
  /** En çok slot sayısı; varsayılan 12. */
  limit?: number;
}

export interface AppointmentCreateInput {
  /** Uygunluk yanıtındaki `startsAt` değeri. */
  startsAt: string;
  /** Kişinin keşif yanıtlarının kısa özeti; boşsa aday kaydından üretilir. */
  summary?: string;
  name?: string;
}

export interface AppointmentCreateResult {
  appointment: { id: number; startsAt: string; durationMinutes: number; status: string; label: string };
  /** Kişiye yazılacak onayın gövdesi: saat ve hazırlık notu. */
  confirmation: string;
  /** false: kişinin yaklaşan randevusu zaten vardı, o döndü. */
  created: boolean;
}
