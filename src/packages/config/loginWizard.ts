import { ui, loginForm } from '../tui/index.js';
import { formatMain, formatHeader, formatSecondary, formatDim, formatError, logger } from '../utils/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Config } from './configManager.js';

const configDir = path.join(os.homedir(), '.config', 'cowork');
const authPath = path.join(configDir, 'auth.json');

// ─── Provider Registry ────────────────────────────────────────────────────────

interface ProviderMeta {
  name: string;
  defaultModel: string;
  url: string;
  type: string;
}

const PROVIDERS_MAP: Record<string, ProviderMeta> = {
  'google':     { name: 'Google Gemini', defaultModel: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/openai', type: 'gemini' },
  'openai':     { name: 'OpenAI',        defaultModel: 'gpt-4o-mini',       url: 'https://api.openai.com/v1',                               type: 'openai' },
  'openrouter': { name: 'OpenRouter',    defaultModel: 'google/gemini-2.5-flash', url: 'https://openrouter.ai/api/v1',                      type: 'openai' },
  'local':      { name: 'Local',         defaultModel: 'meta-llama/llama-3', url: '',                                                       type: 'openai' },
};

// Ordered list of keys for display
const PROVIDER_KEYS = ['google', 'openai', 'openrouter', 'local'];

interface AuthConfig {
  version?: number;
  active: string | null;
  providers: Record<string, Config>;
}

// ─── Auth File I/O ────────────────────────────────────────────────────────────

/**
 * Loads the current auth.json file, or returns a blank default structure.
 */
function loadAuthFile(): AuthConfig {
  try {
    if (fs.existsSync(authPath)) {
      const data = fs.readFileSync(authPath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        parsed.providers = parsed.providers || {};
        return parsed as AuthConfig;
      } else {
        logger.error(`Error loading configuration: ~/.config/cowork/auth.json is invalid.`);
      }
    }
  } catch (err: any) {
    logger.error(`Error reading or parsing ~/.config/cowork/auth.json: ${err.message}`);
  }
  return { active: null, providers: {} };
}

/**
 * Writes the auth configuration back to ~/.config/cowork/auth.json
 */
function saveAuthFile(authConfig: AuthConfig): void {
  const tmpPath = authPath + '.tmp';
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    // Increment or initialize schema version
    authConfig.version = 1;
    fs.writeFileSync(tmpPath, JSON.stringify(authConfig, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, authPath);
    ui.log(formatMain(`Successfully updated configuration at ${authPath}`));
  } catch (err: any) {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {}
    logger.error(`Failed to save auth configuration: ${err.message}`);
  }
}

// ─── Provider Utilities ───────────────────────────────────────────────────────

/**
 * Normalizes a user-supplied provider name/alias to a canonical key.
 * Returns null if the input doesn't match any known provider.
 */
function normalizeProviderKey(input: string): string | null {
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
 * @param {AuthConfig}  authConfig Loaded auth configuration.
 * @returns {string}
 */
function providerLabel(key: string, authConfig: AuthConfig): string {
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
 * @param {AuthConfig} authConfig Loaded auth configuration.
 */
function printProviderList(authConfig: AuthConfig): void {
  ui.log(formatSecondary('\nAvailable providers:'));
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
    ui.log(line);
  }
  ui.log('');
}

// ─── Interactive Selector ─────────────────────────────────────────────────────

/**
 * Interactive arrow-key provider selector.
 * Renders each item with tick + (active) markers.
 * @param {AuthConfig} authConfig Loaded auth configuration.
 * @returns {Promise<string>} Resolves with the selected provider key.
 */
async function selectProvider(authConfig: AuthConfig): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error('stdin is not a TTY. Cannot select provider.');
  }

  const items = PROVIDER_KEYS.map(key => {
    const meta = PROVIDERS_MAP[key];
    const isSetup = !!(authConfig.providers && authConfig.providers[key]);
    const isActive = authConfig.active === key;
    return {
      label: meta.name,
      configured: isSetup,
      active: isActive
    };
  });

  const selectedIdx = await loginForm.selectProvider(ui, items);
  return PROVIDER_KEYS[selectedIdx];
}

// ─── Credential Input Form ────────────────────────────────────────────────────

/**
 * Custom prompt that keeps an existing value if the user presses Enter without typing.
 * @param {string} label       The prompt text.
 * @param {string} existingVal Existing value to preserve on blank input.
 * @param {string} [defaultVal] Fallback shown when no existing value exists.
 * @returns {Promise<string>}
 */
async function askWithFallback(
  label: string,
  existingVal: string = '',
  defaultVal: string = '',
  masked: boolean = false,
  required: boolean = false
): Promise<string> {
  const fallback = existingVal || defaultVal;
  let hint = '';
  if (existingVal) {
    hint = '[keep existing]';
  } else if (defaultVal) {
    hint = `[default: ${defaultVal}]`;
  }

  return await loginForm.inputField(ui, {
    label,
    hint,
    masked,
    required,
    fallback
  });
}

/**
 * Runs the credential input form for a given provider key.
 * Pre-fills from existing config if available. API key is kept if Enter pressed blank.
 * @param {string} providerKey   Canonical provider key.
 * @param {AuthConfig} authConfig    Loaded auth configuration (mutated).
 */
async function runCredentialForm(providerKey: string, authConfig: AuthConfig): Promise<void> {
  const meta     = PROVIDERS_MAP[providerKey];
  const existing = authConfig.providers[providerKey] || {};

  ui.log(formatHeader(`\nConfiguring ${meta.name}...`));

  let config: Config = {
    model_type:    meta.type,
    model_name:    existing.model_name    || '',
    model_url:     existing.model_url     || meta.url,
    model_api_key: existing.model_api_key || '',
  };

  if (providerKey === 'local') {
    config.model_url = await askWithFallback('Local Endpoint URL', existing.model_url, meta.url, false, true);
    config.model_name    = await askWithFallback('Local Model Name', existing.model_name, meta.defaultModel);
    config.model_api_key = await askWithFallback('Local API Key', existing.model_api_key, 'sk-no-key-required');
  } else {
    config.model_name    = await askWithFallback(`${meta.name} Model Name`, existing.model_name, meta.defaultModel);
    config.model_api_key = await askWithFallback(`${meta.name} API Key`, existing.model_api_key, '', true, true);
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
export async function runLoginWizard(args: string[] = []): Promise<void> {
  const authConfig  = loadAuthFile();
  const passedArg   = args[0] ? args[0].trim() : null;

  try {
    // ── Branch A: Argument supplied ──────────────────────────────────────────
    if (passedArg) {
      const key = normalizeProviderKey(passedArg);

      // A1. Invalid provider
      if (!key) {
        ui.log(formatError(`Unknown provider: '${passedArg}'.`));
        printProviderList(authConfig);
        return;
      }

      // A2. Valid + already configured → switch active, print list, exit
      if (authConfig.providers[key]) {
        authConfig.active = key;
        saveAuthFile(authConfig);
        ui.log(formatMain(`Active provider set to: ${PROVIDERS_MAP[key].name}`));
        printProviderList(authConfig);
        return;
      }

      // A3. Valid but NOT configured → run credential form directly
      ui.log(formatSecondary(`Provider '${PROVIDERS_MAP[key].name}' is not set up yet. Starting setup...`));
      await runCredentialForm(key, authConfig);
      printProviderList(authConfig);
      return;
    }

    // ── Branch B: No argument → interactive selector ─────────────────────────
    const selectedKey = await selectProvider(authConfig);
    await runCredentialForm(selectedKey, authConfig);
    printProviderList(authConfig);

  } catch (err: any) {
    if (err && err.cancelled) {
      ui.log(formatDim('Selection aborted cleanly.'));
    } else {
      logger.error('Error during setup: ' + (err.message || err));
    }
  }
}
