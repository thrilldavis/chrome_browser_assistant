/**
 * ClaudeModel - Model provider for Anthropic's Claude API
 *
 * Connects to Anthropic's Claude API using an API key.
 * Supports various Claude models (Haiku, Sonnet, Opus).
 */
class ClaudeModel extends BaseModel {
  constructor() {
    super('claude', 'Claude (Anthropic)');
  }

  getModelSpecificConfigFields() {
    return [
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-ant-...',
        required: true,
        helpText: 'Get your API key from console.anthropic.com'
      },
      {
        name: 'modelName',
        label: 'Model',
        type: 'select',
        required: true,
        defaultValue: 'claude-3-5-sonnet-20241022',
        options: [
          { value: 'claude-opus-4-5', label: 'Claude 4.5 Opus (Most Capable)' },
          { value: 'claude-sonnet-4-5', label: 'Claude 4.5 Sonnet' },
          { value: 'claude-haiku-4-5', label: 'Claude 4.5 Haiku (Fast & Affordable)' }
        ]
      },
      {
        name: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        placeholder: '4096',
        required: false,
        defaultValue: '4096',
        helpText: 'Maximum tokens in the response (default: 4096)'
      }
    ];
  }

  getDescription() {
    return 'Use Anthropic\'s Claude AI models via API. Requires an API key and internet connection.';
  }

  requiresInternet() {
    return true;
  }

  async chat(systemPrompt, userPrompt, config) {
    const apiKey = config.apiKey;
    const modelName = config.modelName || 'claude-3-5-sonnet-20241022';
    const maxTokens = parseInt(config.maxTokens) || 4096;

    if (!apiKey) {
      throw new Error('Claude API key is required');
    }

    const apiUrl = 'https://api.anthropic.com/v1/messages';

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        let errorMessage = `Claude API error (${response.status})`;

        try {
          const errorData = JSON.parse(errText);
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message;
          }
        } catch (e) {
          errorMessage = errText;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Claude API returns content as an array of content blocks
      if (data.content && data.content.length > 0) {
        return data.content[0].text;
      }

      throw new Error('Unexpected response format from Claude API');
    } catch (error) {
      console.error('Claude API error:', error);
      if (error.message.includes('API error')) {
        throw error;
      }
      throw new Error(`Could not connect to Claude API: ${error.message}`);
    }
  }
}

// Register this class in the global registry
BaseModel.registerClass('ClaudeModel', ClaudeModel);
