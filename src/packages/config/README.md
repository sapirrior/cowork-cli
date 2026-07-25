# A sub package named config for cowork-cli for managing model provider configurations and the interactive setup flow

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
| `configManager.ts` | `loadConfig()` | Function | Reads credentials, performing schema validation and logging parsing/validation errors rather than silently swallowing them. Prioritizes the JSON structure in `~/.config/cowork/auth.json` (modern multi-provider configuration). Falls back to legacy `.env` in the user's home folder. |
| | `validateConfig(config)` | Function | Verifies that all required fields (`model_name`, `model_url`, `model_api_key`, `model_type`) are present, typed correctly, and that the type is one of the supported provider clients (`openai`, `gemini`). |
| | `verifyConnectivity(client)` | Function | Asynchronous connection test. Performs a dummy model list request (`client.models.list()`) to test endpoint health and API key validity. |
| `loginWizard.ts` | `runLoginWizard(args)` | Function | Core entry point for `cowork --login [provider]` CLI command flows. Handles: <br>1. Flat list printing on invalid providers. <br>2. Switching active providers cleanly if credentials exist. <br>3. Launching the credential setup wizard form if not configured. <br>4. Interactive selector fallback when no args are passed. |
| | `selectProvider(authConfig)` | Function | Maps provider configurations and delegates selector rendering to the TUI `loginForm.selectProvider` component. |
| | `runCredentialForm(...)` | Function | Form workflow for credentials input. Delegates user prompts and text wrapping to `loginForm.inputField`, supporting pre-fills and required field checks. |
| | `loadAuthFile()` | Function | Reads `~/.config/cowork/auth.json` into memory and checks for formatting errors. |
| | `saveAuthFile(authConfig)` | Function | Writes the updated multi-provider JSON file atomically (via a temporary file swap) with secure permissions (mode 0o600) to `~/.config/cowork/auth.json`. |
| | `normalizeProviderKey(input)`| Function | Converts user provider string to canonical mapping (`google`, `openai`, `openrouter`, `local`). |
| | `providerLabel(key, auth)` | Function | Returns styled status labels used by visual printers. |
| | `printProviderList(auth)` | Function | Prints a flat list of available providers, highlighting configured ones with `✓` and indicating the currently active configuration. |

---

## Configuration Files (`configs/` Sub-directory)

| File | Type | Description |
| :--- | :--- | :--- |
| `config.json` | JSON | Holds operational metadata configurations for the CLI environment. |
| `sys.txt` | Text | Contains the template for the agent's base system prompt, describing behavioral rules, file access limits, and tool invocation instructions. |
