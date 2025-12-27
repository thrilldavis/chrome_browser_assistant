/**
 * LMStudioModel - Model provider for local LM Studio instance
 *
 * Connects to a locally running LM Studio server (default: http://localhost:1234)
 * Supports any model loaded in LM Studio via the OpenAI-compatible API.
 */
class LMStudioModel extends BaseModel {
  constructor() {
    super('lmstudio', 'LM Studio (Local)');
  }

  getModelSpecificConfigFields() {
    return [
      {
        name: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        placeholder: 'http://localhost:1234',
        required: true,
        defaultValue: 'http://localhost:1234'
      },
      {
        name: 'modelName',
        label: 'Model Name',
        type: 'text',
        placeholder: 'llama-3.1-8b-instruct-no-robots-mlx',
        required: true,
        defaultValue: 'llama-3.1-8b-instruct-no-robots-mlx',
        helpText: 'The exact model name as shown in LM Studio'
      }
    ];
  }

  getDescription() {
    return 'Connect to your local LM Studio server. Runs entirely on your machine with no internet required.';
  }

  requiresInternet() {
    return false;
  }

  async chat(systemPrompt, userPrompt, config) {
    const baseUrl = config.baseUrl || 'http://localhost:1234';
    const modelName = config.modelName || 'llama-3.1-8b-instruct-no-robots-mlx';
    const apiUrl = `${baseUrl}/v1/chat/completions`;

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: messages,
          stream: false
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`LM Studio API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('LM Studio API error:', error);
      throw new Error(`Could not connect to LM Studio: ${error.message}`);
    }
  }
}

// Register this class in the global registry
BaseModel.registerClass('LMStudioModel', LMStudioModel);
