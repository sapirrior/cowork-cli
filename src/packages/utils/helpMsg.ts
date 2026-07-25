import { formatMain, formatSecondary, formatNormal } from './logger.js';

const helpMsg = `${formatMain('haiku — Ask AI from your terminal')}

${formatSecondary('Usage:')}
  ${formatNormal('haiku "<query>"                 Ask a question to your active AI model.')}
  ${formatNormal('haiku -l, --login [provider]    Configure or switch active provider (google, openai, openrouter, local).')}
  ${formatNormal('haiku -v, --version             Show version information.')}
  ${formatNormal('haiku -h, --help                Show this help message.')}

${formatSecondary('Aliases:')}
  ${formatNormal('hku "<query>"   Short alias for haiku.')}
  ${formatNormal('hk "<query>"    Shortest alias for haiku.')}

${formatSecondary('Examples:')}
  ${formatNormal('haiku "Where is the auth logic?"')}
  ${formatNormal('haiku --login google')}
  ${formatNormal('hku -l')}
  ${formatNormal('git diff | haiku "Summarize these changes"')}

${formatSecondary('Configuration:')}
  ${formatNormal('Settings are managed inside ~/.config/haiku/auth.json via \'haiku --login\'.')}
  ${formatNormal('We also support legacy environment variables set in ~/.env if auth.json is absent.')}`;

export default function show_help(): void {
  console.log(helpMsg);
}
