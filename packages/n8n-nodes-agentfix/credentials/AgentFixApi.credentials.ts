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
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://agentfix.com.tr',
      placeholder: 'https://agentfix.com.tr',
      description: 'AgentFix kurulumunun kök adresi. Sonda slash olmasın.',
    },
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Kullanıcı paneli → API Erişimi sayfasından üretilen token.',
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
