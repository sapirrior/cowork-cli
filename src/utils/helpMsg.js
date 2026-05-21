import { formatMain, formatSecondary, formatNormal } from './logger.js';

const helpMsg = `
${formatMain('btw - Ask AI from your terminal')}

${formatSecondary('Usage:')}
  ${formatNormal('btw <query>           Ask a question to your configured AI model.')}
  ${formatNormal('btw -c, --config      Interactively configure API keys and model settings.')}
  ${formatNormal('btw -h, --help        Show this help message.')}

${formatSecondary('Examples:')}
  ${formatNormal('btw "How do I list files in Node.js?"')}
  ${formatNormal('btw --config')}
  ${formatNormal('btw -h')}

${formatNormal('Configuration is stored in src/configs/user.json.')}
`;

export default function show_help() {
  console.log(helpMsg);
}
