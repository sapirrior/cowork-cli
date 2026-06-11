import { formatMain, formatSecondary, formatNormal } from './logger.js';

const helpMsg = `${formatMain('cwk - Ask AI from your terminal')}

${formatSecondary('Usage:')}
  ${formatNormal('cwk "<query>"                 Ask a question to your active AI model.')}
  ${formatNormal('cwk -l, --login [provider]    Configure or switch active provider (google, openai, openrouter, local).')}
  ${formatNormal('cwk -v, --version             Show version information.')}
  ${formatNormal('cwk -h, --help                Show this help message.')}

${formatSecondary('Examples:')}
  ${formatNormal('cwk "How do I list files in Node.js?"')}
  ${formatNormal('cwk --login google')}
  ${formatNormal('cwk -l')}

${formatSecondary('Configuration:')}
  ${formatNormal('Settings are managed inside ~/.config/cowork/auth.json via \'cwk --login\'.')}
  ${formatNormal('We also support legacy environment variables set in ~/.env if auth.json is absent.')}`;

export default function show_help() {
  console.log(helpMsg);
}
