import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class AgentFixApi implements ICredentialType {
  name = 'agentFixApi';

  displayName = 'AgentFix API';

  icon = 'file:agentfix.svg' as const;

  documentationUrl = 'https://agentfix.com.tr/docs/api';

  properties: INodeProperties[] = [
    {
      displayName: 'Temel URL (Base URL)',
      name: 'baseUrl',
      type: 'string',
      default: 'https://agentfix.com.tr',
      placeholder: 'https://agentfix.com.tr',
      description: 'AgentFix kök adresi, sonda slash olmasın (AgentFix base URL, no trailing slash).',
    },
    {
      displayName: 'API Anahtarı (API Token)',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Kullanıcı paneli → API Erişimi (User panel → API Access).',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiToken}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/api/v1/me',
      method: 'GET',
    },
  };
}
