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
`;

export default function show_help(): void {
  process.stdout.write(HELP_TEXT + '\n');
}
