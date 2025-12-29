# Local-Only Model Providers

This directory supports local-only model providers that won't be committed to git. This is useful for:
- Proprietary/company API endpoints
- Personal API keys hard-coded in files
- Experimental models you don't want to share
- Custom integrations with internal systems

## Quick Start

### 1. Create Your Model File

Any file ending in `.local.js` will be automatically ignored by git.

Example: `src/background/models/MyCompanyModel.local.js`

```javascript
class MyCompanyModel extends BaseModel {
  constructor() {
    super('mycompany', 'My Company AI');
  }

  getModelSpecificConfigFields() {
    return [
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'your-api-key',
        required: true
      },
      {
        name: 'endpoint',
        label: 'API Endpoint',
        type: 'text',
        placeholder: 'https://api.mycompany.com/v1/chat',
        required: true
      }
    ];
  }

  getDescription() {
    return 'Connect to My Company AI API';
  }

  requiresInternet() {
    return true;
  }

  async chat(systemPrompt, userPrompt, config) {
    // Your API implementation here
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    const data = await response.json();
    return data.response; // Adjust based on your API format
  }
}
```

### 2. Register Your Model

Edit `models.config.js` and add your model to the `LOCAL_MODEL_PROVIDERS` array:

```javascript
const LOCAL_MODEL_PROVIDERS = [
  { scriptPath: 'models/ProprietaryModel.local.js', className: 'ProprietaryModel' },
  { scriptPath: 'models/MyCompanyModel.local.js', className: 'MyCompanyModel' } // Add this line
];
```

### 3. Reload Extension

1. Go to `chrome://extensions`
2. Click the reload button on Browser Assistant
3. Your model should now appear in the model dropdown

## Template

A template file has been created at `ProprietaryModel.local.js` that you can copy and customize.

## Important Notes

- **Files ending in `.local.js` are NEVER committed to git**
- **Changes to `models.config.js` ARE committed** (but only add the reference, not the proprietary code)
- The extension handles missing local files gracefully - no error if file doesn't exist
- You can have multiple local model providers

## Verification

To verify your local files won't be committed:

```bash
# Should show ProprietaryModel.local.js is ignored
git status

# Should list your .local.js file
ls -la models/*.local.js
```

## API Format Examples

### OpenAI-compatible Format
```javascript
const data = await response.json();
return data.choices[0].message.content;
```

### Claude-compatible Format
```javascript
const data = await response.json();
return data.content[0].text;
```

### Custom Format
```javascript
const data = await response.json();
return data.response || data.output || data.text;
```

## Troubleshooting

**Model not appearing in dropdown:**
1. Check console for errors: `chrome://extensions` → Browser Assistant → "service worker"
2. Verify class name matches exactly in both the file and config
3. Ensure the file path is correct relative to `src/background/`

**"Model class not found in registry" error:**
- Make sure your class extends `BaseModel`
- Check that the file is syntactically correct
- Verify the class is defined globally (no module exports)

**API errors:**
- Add detailed error logging in your `chat()` method
- Check the browser console and service worker console
- Verify API endpoint and authentication format
