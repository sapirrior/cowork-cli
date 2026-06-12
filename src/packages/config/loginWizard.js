import { ui } from '../tui/index.js';
import { formatMain, formatHeader, formatSecondary, formatDim, formatError, logger } from '../utils/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const configDir = path.join(os.homedir(), '.config', 'cowork');
const authPath = path.join(configDir, 'auth.json');

// ─── Provider Registry ────────────────────────────────────────────────────────

const PROVIDERS_MAP = {
  'google':     { name: 'Google Gemini', defaultModel: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/openai', type: 'gemini' },
  'openai':     { name: 'OpenAI',        defaultModel: 'gpt-4o-mini',       url: 'https://api.openai.com/v1',                               type: 'openai' },
  'openrouter': { name: 'OpenRouter',    defaultModel: 'google/gemini-2.5-flash', url: 'https://openrouter.ai/api/v1',                      type: 'openai' },
  'local':      { name: 'Local',         defaultModel: 'meta-llama/llama-3', url: '',                                                       type: 'openai' },
};

// Ordered list of keys for display
const PROVIDER_KEYS = ['google', 'openai', 'openrouter', 'local'];

// ─── Auth File I/O ────────────────────────────────────────────────────────────

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

// ─── Provider Utilities ───────────────────────────────────────────────────────

/**
 * Normalizes a user-supplied provider name/alias to a canonical key.
 * Returns null if the input doesn't match any known provider.
 */
function normalizeProviderKey(input) {
  const clean = input.toLowerCase().trim();
  if (clean.includes('google') || clean.includes('gemini')) return 'google';
  if (clean === 'openai' || clean.includes('gpt'))           return 'openai';
  if (clean.includes('openrouter'))                          return 'openrouter';
  if (clean === 'local' || clean.includes('llama') || clean.includes('ollama')) return 'local';
  // Direct key match
  if (PROVIDERS_MAP[clean]) return clean;
  return null;
}

/**
 * Returns the display label for a provider key, including tick and (active) markers.
 * @param {string}  key        Provider key (e.g. 'google').
 * @param {Object}  authConfig Loaded auth configuration.
 * @returns {string}
 */
function providerLabel(key, authConfig) {
  const meta        = PROVIDERS_MAP[key];
  const isSetup     = !!(authConfig.providers && authConfig.providers[key]);
  const isActive    = authConfig.active === key;
  const tick        = isSetup ? '✓' : ' ';
  const activeSufx  = isActive ? ' (active)' : '';
  return `${tick} ${meta.name}${activeSufx}`;
}

// ─── Flat Provider List Printer ───────────────────────────────────────────────

/**
 * Prints a non-interactive annotated list of all providers.
 * Used after: invalid provider arg, successful provider switch.
 * @param {Object} authConfig Loaded auth configuration.
 */
function printProviderList(authConfig) {
  console.log(formatSecondary('\nAvailable providers:'));
  for (const key of PROVIDER_KEYS) {
    const label    = providerLabel(key, authConfig);
    const isSetup  = !!(authConfig.providers && authConfig.providers[key]);
    const isActive = authConfig.active === key;

    let line;
    if (isActive) {
      line = formatMain(`  ${label}`);
    } else if (isSetup) {
      line = `  ${label}`;
    } else {
      line = formatDim(`  ${label}`);
    }
    console.log(line);
  }
  console.log('');
}

// ─── Interactive Selector ─────────────────────────────────────────────────────

/**
 * Interactive arrow-key provider selector.
 * Renders each item with tick + (active) markers.
 * @param {Object} authConfig Loaded auth configuration.
 * @returns {Promise<string>} Resolves with the selected provider key.
 */
async function selectProvider(authConfig) {
  if (!process.stdin.isTTY) {
    throw new Error('stdin is not a TTY. Cannot select provider.');
  }

  ui.header('cwk login');
  console.log(formatSecondary('Choose your AI provider:\n'));

  let selectedIdx = 0;

  const labels = PROVIDER_KEYS.map(key => providerLabel(key, authConfig));

  const renderList = () => {
    for (let i = 0; i < PROVIDER_KEYS.length; i++) {
      process.stdout.write('\r\x1b[K'); // clear line
      const isSelected = i === selectedIdx;
      const prefix = isSelected ? formatMain('➔ ') : '  ';
      const item   = isSelected
        ? formatMain(`[ ${labels[i]} ]`)
        : formatDim(`  ${labels[i]}  `);
      console.log(`${prefix}${item}`);
    }
    process.stdout.write(`\x1b[${PROVIDER_KEYS.length}A`);
  };

  process.stdout.write('\x1b[?25l');
  renderList();

  return new Promise((resolve, reject) => {
    const onData = (data) => {
      const str = data.toString();

      if (str === '\u0003') { // Ctrl+C
        cleanup();
        process.stdout.write(`\x1b[${PROVIDER_KEYS.length}B`);
        console.log(formatDim('\nLogin cancelled.'));
        reject({ cancelled: true });
        return;
      }

      if (str === '\r' || str === '\n') {
        const selectedKey = PROVIDER_KEYS[selectedIdx];
        cleanup();
        process.stdout.write(`\x1b[${PROVIDER_KEYS.length}B`);
        console.log(`\nSelected: ${formatMain(PROVIDERS_MAP[selectedKey].name)}\n`);
        resolve(selectedKey);
        return;
      }

      if (str === '\u001b[A' || str === '\u001b[D') { // Up / Left
        selectedIdx = (selectedIdx - 1 + PROVIDER_KEYS.length) % PROVIDER_KEYS.length;
        renderList();
      } else if (str === '\u001b[B' || str === '\u001b[C' || str === '\t' || str === ' ') { // Down / Right / Tab / Space
        selectedIdx = (selectedIdx + 1) % PROVIDER_KEYS.length;
        renderList();
      }
    };

    const cleanup = () => {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.off('data', onData);
      process.stdin.pause();
      process.stdout.write('\x1b[?25h');
    };

    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

// ─── Credential Input Form ────────────────────────────────────────────────────

/**
 * Custom prompt that keeps an existing value if the user presses Enter without typing.
 * @param {string} question    The prompt text.
 * @param {string} existingVal Existing value to preserve on blank input.
 * @param {string} [defaultVal] Fallback shown when no existing value exists.
 * @returns {Promise<string>}
 */
async function askWithFallback(question, existingVal = '', defaultVal = '') {
  const fallback = existingVal || defaultVal;
  const hint     = fallback ? ` [${existingVal ? 'keep existing' : `default: ${defaultVal}`}]` : '';
  const answer   = await ui.ask(`${question}${hint}`);
  return answer.trim() || fallback;
}

/**
 * Runs the credential input form for a given provider key.
 * Pre-fills from existing config if available. API key is kept if Enter pressed blank.
 * @param {string} providerKey   Canonical provider key.
 * @param {Object} authConfig    Loaded auth configuration (mutated).
 */
async function runCredentialForm(providerKey, authConfig) {
  const meta     = PROVIDERS_MAP[providerKey];
  const existing = authConfig.providers[providerKey] || {};

  console.log(formatHeader(`\nConfiguring ${meta.name}...`));

  let config = {
    model_type:    meta.type,
    model_name:    existing.model_name    || '',
    model_url:     existing.model_url     || meta.url,
    model_api_key: existing.model_api_key || '',
  };

  if (providerKey === 'local') {
    config.model_url = await askWithFallback('Enter your Local Endpoint URL (mandatory)', existing.model_url, meta.url);
    while (!config.model_url.trim()) {
      console.log(formatError('Endpoint URL is mandatory for Local setups.'));
      config.model_url = await askWithFallback('Enter your Local Endpoint URL (mandatory)', existing.model_url, meta.url);
    }
    config.model_name    = await askWithFallback('Enter local model name', existing.model_name, meta.defaultModel);
    config.model_api_key = await askWithFallback('Enter local API Key (optional)', existing.model_api_key, 'sk-no-key-required');
  } else {
    config.model_name    = await askWithFallback(`Enter ${meta.name} Model Name`, existing.model_name, meta.defaultModel);
    config.model_api_key = await askWithFallback(`Enter your ${meta.name} API Key`, existing.model_api_key);
    while (!config.model_api_key.trim()) {
      console.log(formatError('API Key is required.'));
      config.model_api_key = await askWithFallback(`Enter your ${meta.name} API Key`, existing.model_api_key);
    }
  }

  authConfig.providers[providerKey] = config;
  authConfig.active = providerKey;
  saveAuthFile(authConfig);
}

// ─── Main Entry ───────────────────────────────────────────────────────────────

/**
 * Entry point for `cwk --login [provider]`.
 *
 * Behaviour:
 *   cwk --login                → Interactive selector (ticks + active markers) → credential form (always)
 *   cwk --login <valid key>    → If configured: switch active, print list, exit.
 *                                If NOT configured: run credential form directly.
 *   cwk --login <invalid key>  → Print error + flat annotated list, exit.
 *
 * @param {string[]} args CLI arguments passed after --login / -l.
 */
export async function runLoginWizard(args = []) {
  const authConfig  = loadAuthFile();
  const passedArg   = args[0] ? args[0].trim() : null;

  try {
    // ── Branch A: Argument supplied ──────────────────────────────────────────
    if (passedArg) {
      const key = normalizeProviderKey(passedArg);

      // A1. Invalid provider
      if (!key) {
        console.log(formatError(`Unknown provider: '${passedArg}'.`));
        printProviderList(authConfig);
        return;
      }

      // A2. Valid + already configured → switch active, print list, exit
      if (authConfig.providers[key]) {
        authConfig.active = key;
        saveAuthFile(authConfig);
        console.log(formatMain(`Active provider set to: ${PROVIDERS_MAP[key].name}`));
        printProviderList(authConfig);
        return;
      }

      // A3. Valid but NOT configured → run credential form directly
      console.log(formatSecondary(`Provider '${PROVIDERS_MAP[key].name}' is not set up yet. Starting setup...`));
      await runCredentialForm(key, authConfig);
      printProviderList(authConfig);
      return;
    }

    // ── Branch B: No argument → interactive selector ─────────────────────────
    const selectedKey = await selectProvider(authConfig);
    await runCredentialForm(selectedKey, authConfig);
    printProviderList(authConfig);

  } catch (err) {
    if (err && err.cancelled) {
      console.log(formatDim('Selection aborted cleanly.'));
    } else {
      logger.error('Error during setup: ' + (err.message || err));
    }
  }
}
