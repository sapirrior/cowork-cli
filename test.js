import { ui, loginForm } from './src/packages/tui/index.js';

// Helper to wait for a delay in ms
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runDemo() {
  // 1. Display header
  ui.header('cowork cli engine demo');
  await sleep(200);

  // 2. Select Provider step
  const providers = [
    { label: 'Google Gemini', configured: true, active: true },
    { label: 'OpenAI (GPT-4o)', configured: false, active: false },
    { label: 'OpenRouter AI', configured: true, active: false },
    { label: 'Local LLM (Ollama)', configured: false, active: false }
  ];

  let selectedIdx;
  try {
    selectedIdx = await loginForm.selectProvider(ui, providers);
  } catch (err) {
    if (err.cancelled) {
      console.log('\nDemo aborted by user.');
      process.exit(0);
    }
    throw err;
  }

  const selectedProvider = providers[selectedIdx];

  // 3. Ask for Model Name
  const modelName = await loginForm.inputField(ui, {
    label: `${selectedProvider.label} Model Name`,
    hint: '[default: gemini-1.5-flash]',
    masked: false,
    required: true,
    fallback: 'gemini-1.5-flash'
  });

  // 4. Ask for API Key
  const apiKey = await loginForm.inputField(ui, {
    label: 'API Key',
    hint: '[secret]',
    masked: true,
    required: true
  });

  // 5. Run Loading Animation (Spinner)
  ui.start('Verifying credentials', 'Establishing connection...');
  await sleep(800);

  ui.update('Sending authentication challenge...');
  await sleep(800);

  ui.update('Retrieving available models list...');
  await sleep(800);

  // 6. Stop Spinner on Success
  ui.stop('Verification successful! Saved config.');

  // 7. Footer duration info
  ui.footer('2.45');
}

runDemo().catch(err => {
  console.error('\nDemo encountered an error:', err);
  process.exit(1);
});
