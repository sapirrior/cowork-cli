import { formatMain, formatSecondary, formatNormal } from './logger.js';

const helpMsg = `${formatMain('cowork - Ask AI from your terminal')}

${formatSecondary('Usage:')}
  ${formatNormal('cowork "<query>"                 Ask a question to your active AI model.')}
  ${formatNormal('cowork -l, --login [provider]    Configure or switch active provider (google, openai, openrouter, local).')}
  ${formatNormal('cowork -v, --version             Show version information.')}
  ${formatNormal('cowork -h, --help                Show this help message.')}

${formatSecondary('Examples:')}
  ${formatNormal('cowork "How do I list files in Node.js?"')}
  ${formatNormal('cowork --login google')}
  ${formatNormal('cowork -l')}

${formatSecondary('Configuration:')}
  ${formatNormal('Settings are managed inside ~/.config/cowork/auth.json via \'cowork --login\'.')}
  ${formatNormal('We also support legacy environment variables set in ~/.env if auth.json is absent.')}`;

export default function show_help(): void {
  console.log(helpMsg);
}
