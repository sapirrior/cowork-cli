import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { rgb, bold, dim } from '../packages/tui/ui/format.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Brand Colors: Solid Brand Yellow/Amber for Logo Art, Blue for Title, Grey for Quote
const amberColor: [number, number, number] = [242, 207, 110]; // Solid Brand Yellow / Amber
const blueColor:  [number, number, number] = [123, 165, 218]; // Title Blue
const greyColor:  [number, number, number] = [160, 165, 175]; // Quote Grey

const QUOTES: string[] = [
  "First, solve the problem. Then, write the code.",
  "Simplicity is prerequisite for reliability.",
  "Make it work, make it right, make it fast.",
  "The best error message is the one that never shows up.",
  "Code is like humor. When you have to explain it, it's bad.",
  "Clean code always looks like it was written by someone who cares.",
  "Simplicity is about subtracting the obvious and adding the meaningful.",
  "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
  "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.",
  "The most important property of a program is whether it accomplishes the intention of its user.",
  "Experience is the name everyone gives to their mistakes.",
  "Truth can only be found in one place: the code.",
  "Deleted code is debugged code.",
  "Fix the cause, not the symptom.",
  "Before software can be reusable it first has to be usable.",
  "Measuring programming progress by lines of code is like measuring aircraft building progress by weight.",
  "Software is a great combination between artistry and engineering.",
  "The function of good software is to make the complex appear simple.",
  "There are only two hard things in Computer Science: cache invalidation and naming things.",
  "Premature optimization is the root of all evil.",
  "Good software, like good wine, takes time.",
  "Programs must be written for people to read, and only incidentally for machines to execute.",
  "Controlling complexity is the essence of computer programming.",
  "Complexity kills. It sucks the life out of developers.",
  "The only way to go fast, is to go well.",
  "Debugging is twice as hard as writing the code in the first place.",
  "Architecture is about the important stuff. Whatever that is.",
  "Good code is its own best documentation.",
  "Don't comment bad code — rewrite it.",
  "Understand the problem deeply before attempting a solution.",
  "Careful thinking avoids endless debugging.",
  "Write code that is easy to delete, not easy to extend.",
  "Small steps, solid foundation.",
  "Correctness is clearly the prime quality. If a system does not do what it is supposed to do, little else matters.",
  "Build for clarity first; performance will follow.",
  "The best code is no code at all.",
  "Design is choice. All design.",
  "Simple things should be simple, complex things should be possible.",
  "The primary purpose of code is to communicate intent to humans.",
  "Refactoring is a controlled technique for improving the design of an existing codebase.",
  "Mastery in engineering is knowing what not to build.",
  "Continuous improvement is better than delayed perfection.",
  "The craft of programming is the management of complexity.",
  "Clear logic leads to clean code.",
  "Investigate before you innovate.",
  "Understand the system, then transform it.",
  "Great software is crafted, not just assembled.",
  "Quality is not an act, it is a habit.",
  "Simplicity is the ultimate sophistication.",
  "An engineer's greatest tool is a clear mind."
];

function getRandomQuote(): string {
  const index = Math.floor(Math.random() * QUOTES.length);
  return QUOTES[index];
}

/**
 * Decodes \uXXXX escape sequences in text into actual unicode characters.
 */
function decodeUnicodeEscapes(str: string): string {
  return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

/**
 * Sonnet CLI ANSI logo rendered in solid brand yellow/amber unicode art, "Sonnet CLI" title,
 * and a randomly selected philosophical engineering quote.
 */
export function getLogoLines(): string[] {
  let rawLines: string[] = [
    ' ▛███▜',
    '▛█████▜',
    ' ▘▘ ▝▝'
  ];

  try {
    const unicodePath = path.join(__dirname, 'logo-art-unicode.txt');
    if (fs.existsSync(unicodePath)) {
      const content = fs.readFileSync(unicodePath, 'utf8');
      const lines = content.split('\n').map(l => decodeUnicodeEscapes(l.trimEnd())).filter(Boolean);
      if (lines.length >= 3) {
        rawLines = lines;
      }
    }
  } catch (e) {}

  const quote = getRandomQuote();

  return [
    `${rgb(amberColor, rawLines[0] || ' ▛███▜')}   ${bold(rgb(blueColor, 'Sonnet CLI'))}`,
    `${rgb(amberColor, rawLines[1] || '▛█████▜')}  ${dim(rgb(greyColor, quote))}`,
    `${rgb(amberColor, rawLines[2] || ' ▘▘ ▝▝')}`,
  ];
}
