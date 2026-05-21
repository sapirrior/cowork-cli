const helpMsg = `
btw - Ask AI from your terminal

Usage:
  btw <query>           Ask a question to your configured AI model.
  btw -c, --config      Interactively configure API keys and model settings.
  btw -h, --help        Show this help message.

Examples:
  btw "How do I list files in Node.js?"
  btw --config
  btw -h

Configuration is stored in src/configs/user.json.
`;

export default function show_help() {
  console.log(helpMsg);
}
