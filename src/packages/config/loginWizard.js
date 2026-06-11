import { ui } from '../tui/index.js';
import { formatMain, formatHeader, formatSecondary, formatDim, formatError, logger } from '../utils/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const configDir = path.join(os.homedir(), '.config', 'cowork');
const authPath = path.join(configDir, 'auth.json');

/**
 * Loads the current auth.json file, or returns a blank default structure.
 */
function loadAuthFile() {
  try {
    if (fs.existsSync(authPath)) {
      const data = fs.readFileSync(authPath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        parsed.providers = parsed.providers || {};
        return parsed;
      }
    }
  } catch (err) {
    // Ignore and fallback
  }
  return { active: null, providers: {} };
}

/**
 * Writes the auth configuration back to ~/.config/cowork/auth.json
 */
function saveAuthFile(authConfig) {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(authPath, JSON.stringify(authConfig, null, 2), 'utf8');
    logger.main(`Successfully updated configuration at ${authPath}`);
  } catch (err) {
    logger.error(`Failed to save auth configuration: ${err.message}`);
  }
}

/**
 * Interactive provider selector for 'cwk login' command.
 */
async function selectProvider(providers) {
  if (!process.stdin.isTTY) {
    throw new Error('stdin is not a TTY. Cannot select provider.');
  }

  ui.header('cwk login');
  console.log(formatSecondary('Choose your AI provider:'));

  let selectedIdx = 0;

  const renderList = () => {
    for (let i = 0; i < providers.length; i++) {
      process.stdout.write('\r\x1b[K'); // clear line
      const prefix = i === selectedIdx ? formatMain('➔ ') : '  ';
      const item = i === selectedIdx ? formatMain(`[ ${providers[i]} ]`) : formatDim(`  ${providers[i]}  `);
      console.log(`${prefix}${item}`);
    }
    process.stdout.write(`\x1b[${providers.length}A`);
  };

  process.stdout.write('\x1b[?25l');
  renderList();

  return new Promise((resolve, reject) => {
    const onData = (data) => {
      const str = data.toString();

      if (str === '\u0003') {
        cleanup();
        process.stdout.write(`\x1b[${providers.length}B`);
        console.log(formatDim('\nLogin cancelled.'));
        reject({ cancelled: true });
        return;
      }

      if (str === '\r' || str === '\n') {
        cleanup();
        process.stdout.write(`\x1b[${providers.length}B`);
        console.log(`\nSelected Provider: ${formatMain(providers[selectedIdx])}\n`);
        resolve(providers[selectedIdx]);
        return;
      }

      if (str === '\u001b[A' || str === '\u001b[D') { // Up / Left
        selectedIdx = (selectedIdx - 1 + providers.length) % providers.length;
        renderList();
      } else if (str === '\u001b[B' || str === '\u001b[C' || str === '\t') { // Down / Right / Tab
        selectedIdx = (selectedIdx + 1) % providers.length;
        renderList();
      } else if (str === ' ') {
        selectedIdx = (selectedIdx + 1) % providers.length;
        renderList();
      }
    };

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.off('data', onData);
      process.stdin.pause();
      process.stdout.write('\x1b[?25h');
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

/**
 * Custom prompt helper to allow optional inputs.
 */
async function askOptional(question, defaultValue = '') {
  const qText = defaultValue ? `${question} [Default: ${defaultValue}]` : question;
  const answer = await ui.ask(qText);
  return answer.trim() || defaultValue;
}

/**
 * Normalizes input key to standard key mapping.
 */
function normalizeProviderKey(input) {
  const clean = input.toLowerCase().trim();
  if (clean.includes('google') || clean.includes('gemini')) return 'google';
  if (clean.includes('openai')) return 'openai';
  if (clean.includes('openrouter')) return 'openrouter';
  if (clean.includes('local')) return 'local';
  return clean;
}

/**
 * Executable login wizard command.
 * @param {string[]} args CLI arguments.
 */
export async function runLoginWizard(args = []) {
  const providersMap = {
    'google': { name: 'Google Gemini', defaultModel: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/openai', type: 'gemini' },
    'openai': { name: 'OpenAI', defaultModel: 'gpt-4o-mini', url: 'https://api.openai.com/v1', type: 'openai' },
    'openrouter': { name: 'OpenRouter', defaultModel: 'google/gemini-2.5-flash', url: 'https://openrouter.ai/api/v1', type: 'openai' },
    'local': { name: 'Local', defaultModel: 'meta-llama/llama-3', url: '', type: 'openai' }
  };

  const providersList = ['Google Gemini', 'OpenAI', 'OpenRouter', 'Local'];
  const authConfig = loadAuthFile();

  try {
    let selectedProviderName;
    const passedArg = args[0] ? args[0].toLowerCase() : null;

    if (passedArg) {
      const normalizedKey = normalizeProviderKey(passedArg);
      if (providersMap[normalizedKey]) {
        selectedProviderName = providersMap[normalizedKey].name;
      } else {
        logger.error(`Unknown provider: '${args[0]}'. Opening selector.`);
        selectedProviderName = await selectProvider(providersList);
      }
    } else {
      selectedProviderName = await selectProvider(providersList);
    }

    const providerKey = normalizeProviderKey(selectedProviderName);
    const providerMeta = providersMap[providerKey];

    // If already configured, switch active provider directly and exit cleanly without prompts
    if (authConfig.providers && authConfig.providers[providerKey]) {
      authConfig.active = providerKey;
      saveAuthFile(authConfig);
      logger.main(`Active provider switched to: ${providerMeta.name}`);
      return;
    }

    let currentConfig = {
      model_type: providerMeta.type,
      model_name: '',
      model_url: providerMeta.url,
      model_api_key: ''
    };

    console.log(formatHeader(`Configuring ${providerMeta.name}...`));

    if (providerKey === 'local') {
      currentConfig.model_url = await ui.ask('Enter your Local Endpoint URL (mandatory)');
      while (!currentConfig.model_url.trim()) {
        console.log(formatError('Endpoint URL is mandatory for Local setups.'));
        currentConfig.model_url = await ui.ask('Enter your Local Endpoint URL (mandatory)');
      }
      currentConfig.model_name = await askOptional('Enter local model name', providerMeta.defaultModel);
      currentConfig.model_api_key = await askOptional('Enter local API Key (optional)', 'sk-no-key-required');
    } else {
      currentConfig.model_name = await askOptional(`Enter ${providerMeta.name} Model Name`, providerMeta.defaultModel);
      currentConfig.model_api_key = await ui.ask(`Enter your ${providerMeta.name} API Key`);
      while (!currentConfig.model_api_key.trim()) {
        console.log(formatError('API Key is required.'));
        currentConfig.model_api_key = await ui.ask(`Enter your ${providerMeta.name} API Key`);
      }
    }

    authConfig.providers[providerKey] = currentConfig;
    authConfig.active = providerKey;

    saveAuthFile(authConfig);
  } catch (err) {
    if (err && err.cancelled) {
      console.log(formatDim('Selection aborted cleanly.'));
    } else {
      logger.error('Error during setup: ' + err.message);
    }
  }
}
