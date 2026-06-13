import { ui, loginForm } from './src/packages/tui/index.js';

const stage = process.argv[2] || '1';

if (stage === '1') {
  console.log('--- Stage 1: ProviderSelector Component Smoke Test ---');
  const items = [
    { label: 'Google Gemini', configured: true,  active: true  },
    { label: 'OpenAI',        configured: true,  active: false },
    { label: 'OpenRouter',    configured: false, active: false },
    { label: 'Local',         configured: false, active: false },
  ];
  
  try {
    const selectedIdx = await loginForm.selectProvider(ui, items);
    console.log(`Resolved index: ${selectedIdx} (${items[selectedIdx].label})`);
  } catch (err) {
    if (err && err.cancelled) {
      console.log('Cancelled.');
    } else {
      console.error('Error:', err);
    }
  }
} else if (stage === '2') {
  console.log('--- Stage 2: FieldInput Component Smoke Test ---');
  
  try {
    console.log('\nSub-test A: Plain field (Model Name) with fallback');
    const model = await loginForm.inputField(ui, {
      label: 'Model Name',
      hint: '[default: gemini-1.5-flash]',
      fallback: 'gemini-1.5-flash'
    });
    console.log(`Resolved: "${model}"`);

    console.log('\nSub-test B: Masked field (API Key)');
    const key = await loginForm.inputField(ui, {
      label: 'API Key',
      masked: true
    });
    console.log(`Resolved: "${key}"`);

    console.log('\nSub-test C: Validation (API Key required)');
    const reqKey = await loginForm.inputField(ui, {
      label: 'API Key',
      required: true
    });
    console.log(`Resolved: "${reqKey}"`);

  } catch (err) {
    if (err && err.cancelled) {
      console.log('Cancelled.');
    } else {
      console.error('Error:', err);
    }
  }
} else if (stage === '3') {
  console.log('--- Stage 3: Full loginForm Flow Integration Test ---');
  
  const providers = [
    { label: 'Google Gemini', configured: true,  active: true  },
    { label: 'OpenAI',        configured: true,  active: false },
    { label: 'OpenRouter',    configured: false, active: false },
    { label: 'Local',         configured: false, active: false },
  ];

  try {
    const selectedIdx = await loginForm.selectProvider(ui, providers);
    const providerKey = ['google', 'openai', 'openrouter', 'local'][selectedIdx];
    const providerLabel = providers[selectedIdx].label;
    
    console.log(`\nConfiguring ${providerLabel}...`);
    
    const fields = [
      { key: 'model_name', label: 'Model Name', hint: '[default: gemini-1.5-flash]', fallback: 'gemini-1.5-flash' },
      { key: 'model_api_key', label: 'API Key', masked: true, required: true }
    ];
    
    const results = await loginForm.runFieldSequence(ui, fields);
    
    console.log('\nFinal Resolved Config:');
    console.log(JSON.stringify({
      provider: providerKey,
      ...results
    }, null, 2));

  } catch (err) {
    if (err && err.cancelled) {
      console.log('Cancelled.');
    } else {
      console.error('Error:', err);
    }
  }
} else {
  console.log('Unknown stage. Please run "node test.js 1", "node test.js 2", or "node test.js 3".');
}
