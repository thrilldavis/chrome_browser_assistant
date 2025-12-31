# Model Providers Guide

This directory contains AI model provider implementations for the Browser Assistant extension. Each model provider connects to a different AI service (Claude, OpenAI, local models, etc.).

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Creating a New Model Provider](#creating-a-new-model-provider)
- [Configuration Fields](#configuration-fields)
- [Registration System](#registration-system)
- [Local vs Committed Models](#local-vs-committed-models)
- [Complete Example](#complete-example)

## Architecture Overview

All model providers extend the `BaseModel` class, which defines the standard interface:

```javascript
class BaseModel {
  constructor(id, displayName)
  getModelSpecificConfigFields()  // Define config UI
  getDescription()                 // User-friendly description
  requiresInternet()              // Does this need internet?
  async chat(systemPrompt, userPrompt, config)  // Main API call
  validateConfig(config)          // Validate configuration
}
```

## Creating a New Model Provider

### Step 1: Create Your Model File

Create a new file in this directory: `YourModelName.js`

```javascript
/**
 * YourModelName - Model provider for [Service Name]
 *
 * [Brief description of what this model connects to]
 */
class YourModelName extends BaseModel {
  constructor() {
    // id: unique identifier (lowercase, no spaces)
    // displayName: shown in the UI dropdown
    super('your-model-id', 'Your Model Name');
  }

  // Define configuration fields shown in the UI
  getModelSpecificConfigFields() {
    return [
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'your-api-key-here',
        required: true,
        helpText: 'Get your API key from example.com/api-keys'
      },
      {
        name: 'modelName',
        label: 'Model',
        type: 'select',
        required: true,
        defaultValue: 'default-model',
        options: [
          { value: 'model-1', label: 'Model 1 (Fast)' },
          { value: 'model-2', label: 'Model 2 (Better)' }
        ]
      }
    ];
  }

  getDescription() {
    return 'Connect to [Service Name] AI. Requires API key and internet.';
  }

  requiresInternet() {
    return true;  // Set to false for local models
  }

  // Main method - make API call and return response text
  async chat(systemPrompt, userPrompt, config) {
    const apiKey = config.apiKey;
    const modelName = config.modelName || 'default-model';

    if (!apiKey) {
      throw new Error('API key is required');
    }

    try {
      const response = await fetch('https://api.example.com/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error (${response.status}): ${error}`);
      }

      const data = await response.json();

      // Extract the text response from the API response
      // (Format varies by API - adapt to your needs)
      return data.choices[0].message.content;

    } catch (error) {
      console.error('API error:', error);
      throw new Error(`Could not connect: ${error.message}`);
    }
  }
}

// IMPORTANT: Register your class at the end
BaseModel.registerClass('YourModelName', YourModelName);
```

### Step 2: Register in models.config.js

Add your model to the appropriate array in `models.config.js`:

```javascript
// For models to be committed to git:
const MODEL_PROVIDERS = [
  { scriptPath: 'models/YourModelName.js', className: 'YourModelName' }
];

// For local-only models (gitignored):
const LOCAL_MODEL_PROVIDERS = [
  { scriptPath: 'models/YourModelName.local.js', className: 'YourModelName' }
];
```

### Step 3: Load Your Model

The model will automatically:
1. Load when the background script starts
2. Register itself in the global registry
3. Appear in the UI dropdown
4. Show configuration panel when selected

## Configuration Fields

Configuration fields define the UI shown to users. Each field is an object with these properties:

### Field Types

#### Text Input
```javascript
{
  name: 'apiKey',           // Internal field name
  label: 'API Key',         // Shown to user
  type: 'text',             // or 'password' to hide value
  placeholder: 'sk-...',    // Placeholder text
  required: true,           // Must be filled?
  defaultValue: '',         // Optional default
  helpText: 'Get from...'   // Help text shown below field
}
```

#### Number Input
```javascript
{
  name: 'maxTokens',
  label: 'Max Tokens',
  type: 'number',
  placeholder: '4096',
  required: false,
  defaultValue: '4096',
  helpText: 'Maximum response length'
}
```

#### Select Dropdown
```javascript
{
  name: 'modelName',
  label: 'Model',
  type: 'select',
  required: true,
  defaultValue: 'gpt-4',
  options: [
    { value: 'gpt-4', label: 'GPT-4 (Most Capable)' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fast)' }
  ]
}
```

### Base Fields

All models automatically include these base fields:
- **chunkSize**: Max characters per chunk for long content (default: 50000)

## Registration System

The registration system allows models to register themselves when their scripts load:

```javascript
// At the end of your model file:
BaseModel.registerClass('YourModelName', YourModelName);
```

This:
1. Adds your class to `self.MODEL_CLASS_REGISTRY`
2. Allows the model manager to instantiate your class
3. Makes your model available in the UI

## Local vs Committed Models

### Committed Models
Place in `MODEL_PROVIDERS` array for models that should be committed to git:
- Built-in models (Claude, OpenAI, LM Studio)
- Open source integrations
- Models without proprietary code

### Local Models
Place in `LOCAL_MODEL_PROVIDERS` array for models that should NOT be committed:
- Proprietary integrations
- Company-specific models
- Models with sensitive credentials

**File naming convention**: Use `.local.js` extension (e.g., `MoveworksModel.local.js`)

**Gitignore pattern**: `*.local.js` files are automatically ignored

## Complete Example

Here's a complete example of a simple model provider:

```javascript
/**
 * ExampleModel - Model provider for Example AI Service
 *
 * Connects to the Example AI API using an API key.
 * Supports multiple model types with different capabilities.
 */
class ExampleModel extends BaseModel {
  constructor() {
    super('example', 'Example AI');
  }

  getModelSpecificConfigFields() {
    return [
      {
        name: 'apiKey',
        label: 'Example AI API Key',
        type: 'password',
        placeholder: 'ex-...',
        required: true,
        helpText: 'Get your API key from example.ai/dashboard'
      },
      {
        name: 'modelType',
        label: 'Model Type',
        type: 'select',
        required: true,
        defaultValue: 'balanced',
        options: [
          { value: 'fast', label: 'Fast (Lower cost)' },
          { value: 'balanced', label: 'Balanced (Recommended)' },
          { value: 'powerful', label: 'Powerful (Higher cost)' }
        ]
      },
      {
        name: 'temperature',
        label: 'Temperature',
        type: 'number',
        placeholder: '0.7',
        required: false,
        defaultValue: '0.7',
        helpText: 'Creativity level (0.0-1.0). Higher = more creative.'
      }
    ];
  }

  getDescription() {
    return 'Use Example AI models via API. Fast and reliable responses.';
  }

  requiresInternet() {
    return true;
  }

  async chat(systemPrompt, userPrompt, config) {
    // Extract config values
    const apiKey = config.apiKey;
    const modelType = config.modelType || 'balanced';
    const temperature = parseFloat(config.temperature) || 0.7;

    // Validate required fields
    if (!apiKey) {
      throw new Error('Example AI API key is required');
    }

    // Prepare API request
    const apiUrl = 'https://api.example.ai/v1/completions';

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          model: modelType,
          temperature: temperature,
          system: systemPrompt,
          prompt: userPrompt,
          max_tokens: 4096
        })
      });

      // Handle errors
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      // Parse response
      const data = await response.json();

      // Extract text from response
      // (This format depends on your API's response structure)
      if (data.completion) {
        return data.completion;
      }

      throw new Error('Unexpected response format from Example AI API');

    } catch (error) {
      console.error('Example AI error:', error);
      throw new Error(`Failed to connect to Example AI: ${error.message}`);
    }
  }
}

// Register the model
BaseModel.registerClass('ExampleModel', ExampleModel);
```

## Testing Your Model

1. **Reload the extension** in `chrome://extensions`
2. **Open the side panel** on any webpage
3. **Select your model** from the dropdown
4. **Click the ⚙️ button** to configure it
5. **Fill in the configuration** fields
6. **Save** and try sending a message

## Best Practices

### Error Handling
- Always validate required configuration fields
- Provide clear error messages to users
- Log errors to console for debugging
- Throw errors with user-friendly messages

### API Calls
- Use `async/await` for cleaner code
- Check `response.ok` before parsing
- Handle network failures gracefully
- Include appropriate headers for your API

### Configuration
- Provide sensible default values
- Add helpful `helpText` to guide users
- Use `select` dropdowns for predefined choices
- Mark truly required fields as `required: true`

### Security
- Never hardcode API keys or secrets
- Use `type: 'password'` for sensitive fields
- Store credentials in user's local config only
- For proprietary models, use `.local.js` files

## Existing Model Examples

- **ClaudeModel.js** - Full-featured API model with multiple model options
- **OpenAIModel.js** - API model with temperature and max tokens
- **LMStudioModel.js** - Local model provider (no API key needed)
- **MoveworksModel.local.js** - OAuth-based authentication example

## Troubleshooting

### Model doesn't appear in dropdown
- Check console for errors in `chrome://extensions`
- Ensure `BaseModel.registerClass()` is called at the end
- Verify model is listed in `models.config.js`
- Reload the extension

### Configuration not saving
- Check field names match between `getModelSpecificConfigFields()` and `chat()`
- Ensure required fields are marked correctly
- Check browser console for validation errors

### API calls failing
- Verify API endpoint URL is correct
- Check headers match API documentation
- Ensure API key is valid
- Look for CORS errors in console (may need manifest permissions)

## Need Help?

- Check existing model implementations for examples
- Review the `BaseModel.js` source for the full interface
- Test with simple API calls first, then add complexity
- Use console.log() liberally during development
