import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

// Programmatic-style, not declarative: the request body needs non-trivial
// assembly (parsing the user's raw-metadata JSON, folding an optional
// response ID into it, adding two fields the backend requires but this
// node doesn't expose as user choices — see the `disclosure_shown`/
// `content_labeled` comment below), and the response needs a field
// (`is_first_message`) hoisted out of a nested shape before returning it.
// Both would need custom pre-send/post-receive functions in a declarative
// node anyway, so programmatic keeps this in one place and easier to test.
export class Disclarion implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Disclarion',
		name: 'disclarion',
		icon: { light: 'file:disclarion.svg', dark: 'file:disclarion.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Log an AI interaction with Disclarion for EU AI Act Article 50 disclosure tracking',
		defaults: {
			name: 'Disclarion',
		},
		// Lets an AI Agent node call this directly as a tool — e.g. an agent
		// can log its own reply for Article 50 compliance right after
		// generating it, without a separate manual node in the workflow.
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'disclarionApi',
				required: true,
			},
		],
		// No Resource/Operation split: Disclarion has exactly one resource
		// (an interaction log entry) and one operation (create it) — adding
		// a Resource selector with a single value would be pure ceremony.
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Track Interaction',
						value: 'track',
						description: 'Log an AI response and get back disclosure metadata',
						action: 'Track an AI interaction',
					},
				],
				default: 'track',
			},
			{
				displayName: 'Session ID',
				name: 'sessionId',
				type: 'string',
				required: true,
				default: '',
				description:
					'Stable identifier for the end-user conversation/session — used to determine is_first_message and to group interaction_logs',
				displayOptions: {
					show: { operation: ['track'] },
				},
			},
			{
				displayName: 'Provider',
				name: 'provider',
				type: 'options',
				options: [
					{ name: 'OpenAI', value: 'openai' },
					{ name: 'Anthropic', value: 'anthropic' },
					{ name: 'Gemini', value: 'gemini' },
					{ name: 'Other', value: 'other' },
				],
				default: 'openai',
				displayOptions: {
					show: { operation: ['track'] },
				},
			},
			{
				displayName: 'Custom Provider Name',
				name: 'customProvider',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'mistral',
				description: 'The backend accepts any provider string — enter the real one here',
				displayOptions: {
					show: { operation: ['track'], provider: ['other'] },
				},
			},
			{
				displayName: 'Model Name',
				name: 'modelName',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'gpt-4o-mini',
				description: 'The exact model name/version string the provider returned — required by the backend',
				displayOptions: {
					show: { operation: ['track'] },
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { operation: ['track'] },
				},
				options: [
					{
						displayName: 'Response ID',
						name: 'responseId',
						type: 'string',
						default: '',
						description: "The LLM provider's response/completion ID, if available",
					},
					{
						displayName: 'Raw Metadata (JSON)',
						name: 'rawMetadata',
						type: 'json',
						default: '{}',
						description: 'Any extra non-content metadata to store alongside the log entry',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			// Tracks which error class applies if something throws below:
			// false while parsing/validating this item's own parameters
			// (a NodeOperationError - the user's input, not the API's fault),
			// true only around the actual HTTP call (a NodeApiError).
			let isApiError = false;
			try {
				const operation = this.getNodeParameter('operation', i);

				if (operation === 'track') {
					const sessionId = this.getNodeParameter('sessionId', i) as string;
					const providerChoice = this.getNodeParameter('provider', i) as string;
					const provider =
						providerChoice === 'other'
							? (this.getNodeParameter('customProvider', i) as string)
							: providerChoice;
					const modelName = this.getNodeParameter('modelName', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as {
						responseId?: string;
						rawMetadata?: string;
					};

					let rawMetadata: Record<string, unknown> = {};
					if (additionalFields.rawMetadata) {
						rawMetadata =
							typeof additionalFields.rawMetadata === 'string'
								? (JSON.parse(additionalFields.rawMetadata) as Record<string, unknown>)
								: (additionalFields.rawMetadata as Record<string, unknown>);
					}
					// The backend's LogPayload model has no top-level response-ID
					// field — the Python SDK's own adapters put the provider's
					// response ID inside raw_metadata (e.g. `{"id": response.id}`
					// in openai_adapter.py), so this node does the same.
					if (additionalFields.responseId) {
						rawMetadata.id = additionalFields.responseId;
					}

					const body = {
						session_id: sessionId,
						provider,
						model_name: modelName,
						// The Python SDK's adapters always send both of these as
						// true — normalize() unconditionally sets
						// disclosure_shown=True, content_labeled=True for every
						// supported provider (see e.g. openai_adapter.py). There's
						// no "false" case in the real SDK to mirror, so this node
						// doesn't expose them as a user-facing choice either.
						disclosure_shown: true,
						content_labeled: true,
						raw_metadata: rawMetadata,
					};

					isApiError = true;
					const response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'disclarionApi',
						{
							method: 'POST',
							url: '={{$credentials.baseUrl}}/v1/logs' as unknown as string,
							body,
							json: true,
						},
					)) as { data: Record<string, unknown>; error: unknown; is_first_message: boolean };
					isApiError = false;

					// Response shape from POST /v1/logs: {data: <interaction_logs
					// row>, error: null, is_first_message: boolean}. is_first_message
					// is at the top level, not inside `data` — it's the field a
					// workflow actually needs to decide whether to show a
					// disclosure notice, so it's surfaced directly rather than
					// buried inside the raw log row.
					returnData.push({
						json: {
							is_first_message: response.is_first_message,
							...response.data,
						},
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				if (isApiError) {
					throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
