const HELP_TEXT = `
Usage: sonnet [options] [query]

Options:
  -l, --login [prov]    Configure AI provider (google, openai, openrouter, local, custom)
  -v, --version         Print version
  -h, --help            Show this help message

Examples:
  sonnet "Where is the authentication logic?"
  sonnet "Find all FIXME tags in src/"
  git diff | sonnet "Write a commit message for these changes"
  sonnet --login              # Interactive provider setup
  sonnet --login google       # Setup / switch to Google Gemini

Navigation (while a response is displayed):
  q             Exit
  f             Open follow-up input
  k / ↑         Scroll up 1 line
  j / ↓         Scroll down 1 line
  Ctrl+U        Scroll up half page
  Ctrl+D        Scroll down half page
  PageUp        Scroll up 5 lines
  PageDown      Scroll down 5 lines
  g             Jump to top
  G             Jump to bottom

Input keybindings (follow-up box):
  Ctrl+Left / Alt+b     Jump one word left
  Ctrl+Right / Alt+f    Jump one word right
  Ctrl+W                Delete word left
  Home / End            Jump to start / end of line
`;

export default function show_help(): void {
  process.stdout.write(HELP_TEXT + '\n');
}
