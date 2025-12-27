/**
 * OpenAIModel - Model provider for OpenAI's API
 *
 * Connects to OpenAI's API using an API key.
 * Supports GPT-4, GPT-3.5, and other OpenAI models.
 */
class OpenAIModel extends BaseModel {
  constructor() {
    super('openai', 'OpenAI (ChatGPT)');
  }

  getModelSpecificConfigFields() {
    return [
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-...',
        required: true,
        helpText: 'Get your API key from platform.openai.com'
      },
      {
        name: 'modelName',
        label: 'Model',
        type: 'select',
        required: true,
        defaultValue: 'gpt-4.1-mini',
        options: [
          { value: 'gpt-4o', label: 'GPT-4o (Most Capable)' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
          { value: 'gpt-4', label: 'GPT-4' },
          { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fast & Affordable)' }
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
    return 'Use OpenAI\'s GPT models via API. Requires an API key and internet connection.';
  }

  requiresInternet() {
    return true;
  }

  async chat(systemPrompt, userPrompt, config) {
    const apiKey = config.apiKey;
    const modelName = config.modelName || 'gpt-4o-mini';
    const maxTokens = parseInt(config.maxTokens) || 4096;

    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const apiUrl = 'https://api.openai.com/v1/chat/completions';

    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: messages,
          max_tokens: maxTokens,
          stream: false
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        let errorMessage = `OpenAI API error (${response.status})`;

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

      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
      }

      throw new Error('Unexpected response format from OpenAI API');
    } catch (error) {
      console.error('OpenAI API error:', error);
      if (error.message.includes('API error')) {
        throw error;
      }
      throw new Error(`Could not connect to OpenAI API: ${error.message}`);
    }
  }
}

// Register this class in the global registry
BaseModel.registerClass('OpenAIModel', OpenAIModel);
