import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

// Platform kanal uçları kullanıcı API anahtarını değil, kanala özel anahtarı kabul eder.
export class AgentFixPlatformChannelApi implements ICredentialType {
  name = 'agentFixPlatformChannelApi';

  displayName = 'AgentFix Platform Channel API';

  icon = 'file:agentfix.png' as const;

  documentationUrl = 'https://agentfix.com.tr/docs/api';

  properties: INodeProperties[] = [
    {
      displayName: 'Temel URL (Base URL)',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.agentfix.com.tr',
      placeholder: 'https://api.agentfix.com.tr',
      description: 'AgentFix API adresi, sonda /v1 ve slash olmadan (AgentFix API base URL, without /v1 or trailing slash).',
    },
    {
      displayName: 'Kanal Kimliği (Channel ID)',
      name: 'channelId',
      type: 'number',
      default: 0,
      description: 'Yönetim → Platform Kanalları ekranındaki kanal numarası (Channel number from Admin → Platform Channels).',
    },
    {
      displayName: 'Kanal Anahtarı (Channel Key)',
      name: 'channelKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'afp_ ile başlayan kanal anahtarı; yalnız üretildiğinde gösterilir (Channel key starting with afp_, shown only when generated).',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.channelKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '=/v1/platform/channels/{{$credentials.channelId}}/health',
      method: 'GET',
    },
  };
}
