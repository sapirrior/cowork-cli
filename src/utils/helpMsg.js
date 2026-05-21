import { formatMain, formatSecondary, formatNormal } from './logger.js';

const helpMsg = `${formatMain('btw - Ask AI from your terminal')}

${formatSecondary('Usage:')}
  ${formatNormal('btw "<query>"         Ask a question to your configured AI model.')}
  ${formatNormal('btw -h, --help        Show this help message.')}

${formatSecondary('Examples:')}
  ${formatNormal('btw "How do I list files in Node.js?"')}
  ${formatNormal('btw -h')}

${formatSecondary('Configuration:')}
  ${formatNormal('Provide API settings in your ~/.env file using these keys:')}
  ${formatNormal('  BTW_MODEL_NAME=gpt-4')}
  ${formatNormal('  BTW_MODEL_URL=https://api.openai.com/v1')}
  ${formatNormal('  BTW_MODEL_API_KEY=your_key_here')}
  ${formatNormal('  BTW_MODEL_TYPE=openai')}`;

export default function show_help() {
  console.log(helpMsg);
}
