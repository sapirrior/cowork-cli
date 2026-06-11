import { formatMain, formatSecondary, formatNormal } from './logger.js';

const helpMsg = `${formatMain('cwk - Ask AI from your terminal')}

${formatSecondary('Usage:')}
  ${formatNormal('cwk "<query>"         Ask a question to your configured AI model.')}
  ${formatNormal('cwk -v, --version     Show version information.')}
  ${formatNormal('cwk -h, --help        Show this help message.')}

${formatSecondary('Examples:')}
  ${formatNormal('cwk "How do I list files in Node.js?"')}
  ${formatNormal('cwk -h')}

${formatSecondary('Configuration:')}
  ${formatNormal('Provide API settings in your ~/.env file using these keys:')}
  ${formatNormal('  CWK_MODEL_NAME=gpt-4')}
  ${formatNormal('  CWK_MODEL_URL=https://api.openai.com/v1')}
  ${formatNormal('  CWK_MODEL_API_KEY=your_key_here')}
  ${formatNormal('  CWK_MODEL_TYPE=openai')}`;

export default function show_help() {
  console.log(helpMsg);
}
