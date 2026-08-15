# A sub package named config for Sonnet CLI for managing model provider configurations and the interactive setup flow

This package is responsible for reading and validating credentials/model setups (such as API keys and base URLs) from the filesystem, verifying basic endpoint connectivity, and running the interactive credential wizard.

---

## File & Function Breakdown

### Core Modules

| File | Export / Item | Type | Description |
| :--- | :--- | :--- | :--- |
| `index.ts` | `loadConfig` | Export | Exposes config loader to obtain key, url, model name, and provider type. |
| | `validateConfig` | Export | Validates loaded config structure. |
| | `verifyConnectivity` | Export | Validates credentials via active client check. |
| | `runLoginWizard` | Export | Exposes setup wizard runner. |
| `configManager.ts` | `loadConfig()` | Function | Reads credentials from `~/.config/sonnet/auth.json`. Supports providers: `openai`, `gemini`, `ollama`, `openrouter`, `custom`. Falls back to legacy `.env`. |
| | `validateConfig(config)` | Function | Verifies all required fields are present and that `model_type` is one of: `openai`, `gemini`, `ollama`, `openrouter`, `custom`. |
| | `verifyConnectivity(client, model)` | Function | Asynchronous connection test via `client.models.list()`, falling back to a minimal chat completion probe if the provider does not support model listing. |
| `loginWizard.ts` | `runLoginWizard(args)` | Function | Entry point for `sonnet --login [provider]`. Handles Google, OpenAI, OpenRouter, Ollama, and Custom provider flows. |

---

## Configuration Files (`configs/` Sub-directory)

| File | Type | Description |
| :--- | :--- | :--- |
| `config.json` | JSON | Holds operational metadata (accent colors) for the CLI environment. |
| `sys.txt` | Text | System prompt for one-shot mode (read-only agent). |
| `sys_interactive.txt` | Text | System prompt for interactive chat mode (read-write agent). |

---

## Supported Providers

| Key | Name | Type | Auth |
| :--- | :--- | :--- | :--- |
| `google` | Google Gemini | `gemini` | API key from aistudio.google.com |
| `openai` | OpenAI | `openai` | API key from platform.openai.com |
| `openrouter` | OpenRouter | `openrouter` | API key from openrouter.ai |
| `ollama` | Ollama (Local) | `ollama` | No key required, local endpoint |
| `custom` | Custom Provider | `custom` | User-supplied URL + key |
