import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DisclarionApi implements ICredentialType {
	name = 'disclarionApi';

	displayName = 'Disclarion API';

	icon: ICredentialType['icon'] = {
		light: 'file:../nodes/Disclarion/disclarion.svg',
		dark: 'file:../nodes/Disclarion/disclarion.dark.svg',
	};

	documentationUrl = 'https://disclarion.com/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'dcl_live_...',
			description:
				'Your Disclarion project API key, from app.disclarion.com → Project Settings → API Keys',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.disclarion.com',
			description:
				'Disclarion API base URL. Only change this if you are using a self-hosted or staging backend.',
		},
	];

	// Applied automatically by this.helpers.httpRequestWithAuthentication in
	// the node — without this, that helper has no way to know how to turn
	// this credential into an Authorization header.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// GET /v1/me is a side-effect-free way to verify a key: every other
	// authenticated Disclarion endpoint (POST /v1/logs) writes a real,
	// permanent audit record, which is the wrong thing to trigger just to
	// check "is this key valid?" from this Test button.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/me',
		},
	};
}
