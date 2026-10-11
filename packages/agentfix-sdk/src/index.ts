export { AgentFix, type AgentFixClientConfig, type BatchClaim, type MessageBufferInput } from './client';
export type {
  ContactContext,
  ContactLead,
  ContactRequest,
  ContactUser,
  LeadNeeds,
  LeadNeedsValue,
  LeadUpsertInput,
  LeadUpsertResult,
} from './contacts';
export {
  AgentFixAuthError,
  AgentFixError,
  AgentFixNotFoundError,
  AgentFixValidationError,
  parseApiError,
  toAgentFixError,
  type AgentFixApiErrorInfo,
} from './errors';
export {
  API_PREFIX,
  compact,
  DEFAULT_BASE_URL,
  normalizeBaseUrl,
  pickRagSection,
  supportedOperations,
  resolveAgentFixRequest,
  type HttpMethod,
  type ResolvedRequest,
} from './operations';
