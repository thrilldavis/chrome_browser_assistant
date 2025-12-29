/**
 * Model Configuration
 *
 * Add new model providers to this array to make them available in the extension.
 * Each entry should specify:
 * - scriptPath: Path to the model's JavaScript file (relative to root)
 * - className: The exact name of the class to instantiate
 */
const MODEL_PROVIDERS = [
  { scriptPath: 'models/LMStudioModel.js', className: 'LMStudioModel' },
  { scriptPath: 'models/ClaudeModel.js', className: 'ClaudeModel' },
  { scriptPath: 'models/OpenAIModel.js', className: 'OpenAIModel' }
];

// Local model providers (*.local.js files are gitignored)
// Add your proprietary/personal model providers here
const LOCAL_MODEL_PROVIDERS = [
  { scriptPath: 'models/MoveworksModel.local.js', className: 'MoveworksModel' }
  // Add more local providers as needed
];
