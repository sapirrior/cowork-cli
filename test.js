import { outputFormatted } from './src/utils/outputFormatter.js';

// Custom dummy text designed to test all markdown rendering capabilities
const markdown = `
# Markdown Formatting Showcase

This is a custom test document designed to demonstrate the updated, clean, and readable terminal formatting layout.

## 1. Inline Typography & Styles

You can style text inline to emphasize important concepts:
- Standard text uses the default grey/silver foreground.
- Use **bold text** to highlight critical details in the main accent color.
- Use *italic/dimmed text* (or _this way_) to render less important annotations.
- Use \`inline code\` to specify commands, variables, or functions.
- Links like [GitHub Repository](https://github.com/sapirrior/cowork-cli) display the label and a dimmed URL.

### 1.1. Nested Lists & Alignment

1. First level item (ordered)
   - Nested bullet item A (unordered)
   - Nested bullet item B (unordered)
     - Deeply nested item C (with trailing spaces)   
2. Second level item (ordered)
3. Third level item (ordered)

---

## 2. Blockquotes

> Blockquotes are padded and prefixed with a vertical line character.
> The text is styled in the new readable cool grey accent color to distinguish it.
>
> Multiple paragraphs within the same quote are separated cleanly.

## 3. Tables

Tables support **left**, *center*, and right-aligned columns, as well as \`inline code\` inside cells.

| Tool | Supported | Command |
| :--- | :---: | ---: |
| Version Check | Yes | \`cwk -v\` |
| Help Screen | Yes | \`cwk -h\` |
| Stdin Piping | Yes | \`cmd | cwk\` |
| Verbose Mode | No | N/A |

### Available Model Types

| Type | Provider | Notes |
| :--- | :--- | :--- |
| \`openai\` | Any OpenAI-compatible API | Default type |
| \`gemini\` | Google Gemini | Preserves \`thought_signature\` |

## 4. Code Blocks

Here is a JavaScript code snippet showing the minimal left-border rendering:

\`\`\`javascript
const greeting = "Hello, developer!";
console.log(greeting.trim());

// A test function with indented blocks
function checkFormatter() {
  const status = "success";
  return status === "success";
}
\`\`\`

And a shell command without a language header:

\`\`\`
cwk --version
cwk "Compare the output formatter changes"
\`\`\`

---

_This is the end of the visual test suite._
`;

console.log(outputFormatted(markdown));
