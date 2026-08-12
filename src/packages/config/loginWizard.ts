import { ui, loginForm } from '../tui/index.js';
import { formatMain, formatHeader, formatSecondary, formatDim, formatError, logger } from '../utils/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Config } from './configManager.js';

const configDir = path.join(os.homedir(), '.config', 'sonnet');
const authPath = path.join(configDir, 'auth.json');

// ─── Provider Registry ────────────────────────────────────────────────────────

interface ProviderMeta {
  name: string;
  defaultModel: string;
  url: string;
  type: string;
  skipKey?: boolean;
  customUrl?: boolean;
}

const PROVIDERS_MAP: Record<string, ProviderMeta> = {
  'google':     { name: 'Google Gemini',  defaultModel: 'gemini-2.0-flash', url: 'https://generativelanguage.googleapis.com/v1beta/openai', type: 'gemini' },
  'openai':     { name: 'OpenAI',         defaultModel: 'gpt-4o-mini',       url: 'https://api.openai.com/v1',                               type: 'openai' },
  'openrouter': { name: 'OpenRouter',     defaultModel: 'google/gemini-2.5-flash', url: 'https://openrouter.ai/api/v1',                     type: 'openrouter' },
  'ollama':     { name: 'Ollama (Local)', defaultModel: 'llama3.3',          url: 'http://localhost:11434/v1',                               type: 'ollama', skipKey: true },
  'custom':     { name: 'Custom Provider',defaultModel: '',                  url: '',                                                       type: 'custom', customUrl: true },
};

const PROVIDER_KEYS = ['google', 'openai', 'openrouter', 'ollama', 'custom'];

interface AuthConfig {
  version?: number;
  active: string | null;
  providers: Record<string, Config>;
}

// ─── Auth File I/O ────────────────────────────────────────────────────────────

function loadAuthFile(): AuthConfig {
  try {
    if (fs.existsSync(authPath)) {
      const data = fs.readFileSync(authPath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        parsed.providers = parsed.providers || {};
        return parsed as AuthConfig;
      } else {
        logger.error(`Error loading configuration: ~/.config/sonnet/auth.json is invalid.`);
      }
    }
  } catch (err: any) {
    logger.error(`Error reading or parsing ~/.config/sonnet/auth.json: ${err.message}`);
  }
  return { active: null, providers: {} };
}

function saveAuthFile(authConfig: AuthConfig): void {
  const tmpPath = authPath + '.tmp';
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    authConfig.version = 1;
    fs.writeFileSync(tmpPath, JSON.stringify(authConfig, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, authPath);
    ui.log(formatMain(`Successfully updated configuration at ${authPath}`));
  } catch (err: any) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {}
    logger.error(`Failed to save auth configuration: ${err.message}`);
  }
}

// ─── Provider Utilities ───────────────────────────────────────────────────────

function normalizeProviderKey(input: string): string | null {
  const clean = input.toLowerCase().trim();
  if (clean.includes('google') || clean.includes('gemini')) return 'google';
  if (clean === 'openai' || clean.includes('gpt'))           return 'openai';
  if (clean.includes('openrouter'))                          return 'openrouter';
  if (clean === 'ollama' || clean.includes('ollama') || clean.includes('llama') || clean === 'local') return 'ollama';
  if (clean === 'custom' || clean.includes('custom'))        return 'custom';
  if (PROVIDERS_MAP[clean]) return clean;
  return null;
}

function providerLabel(key: string, authConfig: AuthConfig): string {
  const meta        = PROVIDERS_MAP[key];
  const isSetup     = !!(authConfig.providers && authConfig.providers[key]);
  const isActive    = authConfig.active === key;
  const tick        = isSetup ? '✓' : ' ';
  const activeSufx  = isActive ? ' (active)' : '';
  return `${tick} ${meta.name}${activeSufx}`;
}

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

async function runCredentialForm(providerKey: string, authConfig: AuthConfig): Promise<void> {
  const meta     = PROVIDERS_MAP[providerKey];
  const existing = authConfig.providers[providerKey] || {} as Partial<Config>;

  ui.log(formatHeader(`\nConfiguring ${meta.name}...`));

  let config: Config = {
    model_type:    meta.type,
    model_name:    (existing as Config).model_name    || '',
    model_url:     (existing as Config).model_url     || meta.url,
    model_api_key: (existing as Config).model_api_key || '',
  };

  if (providerKey === 'ollama') {
    // Ollama: URL is customizable, key is not needed
    config.model_url     = await askWithFallback('Ollama Endpoint URL', (existing as Config).model_url, meta.url, false, true);
    config.model_name    = await askWithFallback('Model Name', (existing as Config).model_name, meta.defaultModel, false, true);
    config.model_api_key = 'ollama'; // Ollama doesn't require a real API key
  } else if (providerKey === 'custom') {
    // Custom: everything is user-supplied
    config.model_url     = await askWithFallback('Base URL', (existing as Config).model_url, '', false, true);
    config.model_name    = await askWithFallback('Model Name', (existing as Config).model_name, '', false, true);
    config.model_api_key = await askWithFallback('API Key', (existing as Config).model_api_key, '', true, true);
  } else {
    config.model_name    = await askWithFallback(`${meta.name} Model Name`, (existing as Config).model_name, meta.defaultModel);
    config.model_api_key = await askWithFallback(`${meta.name} API Key`, (existing as Config).model_api_key, '', true, true);
  }

  authConfig.providers[providerKey] = config;
  authConfig.active = providerKey;
  saveAuthFile(authConfig);
}

// ─── Main Entry ───────────────────────────────────────────────────────────────

export async function runLoginWizard(args: string[] = []): Promise<void> {
  const authConfig  = loadAuthFile();
  const passedArg   = args[0] ? args[0].trim() : null;

  try {
    if (passedArg) {
      const key = normalizeProviderKey(passedArg);

      if (!key) {
        ui.log(formatError(`Unknown provider: '${passedArg}'.`));
        printProviderList(authConfig);
        return;
      }

      if (authConfig.providers[key]) {
        authConfig.active = key;
        saveAuthFile(authConfig);
        ui.log(formatMain(`Active provider set to: ${PROVIDERS_MAP[key].name}`));
        printProviderList(authConfig);
        await ui.cleanup();
        return;
      }

      ui.log(formatSecondary(`Provider '${PROVIDERS_MAP[key].name}' is not set up yet. Starting setup...`));
      await runCredentialForm(key, authConfig);
      printProviderList(authConfig);
      await ui.cleanup();
      return;
    }

    const selectedKey = await selectProvider(authConfig);
    await runCredentialForm(selectedKey, authConfig);
    printProviderList(authConfig);
    await ui.cleanup();

  } catch (err: any) {
    if (err && err.cancelled) {
      ui.log(formatDim('Selection aborted cleanly.'));
      await ui.cleanup();
    } else {
      logger.error('Error during setup: ' + (err.message || err));
      await ui.cleanup();
    }
  }
}
