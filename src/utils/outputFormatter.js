/**
 * Wraps text to a specified width without breaking words in the middle.
 * @param {string} text The text to format.
 * @param {number} width The maximum width of a line (default 80).
 * @returns {string} The formatted text.
 */
export function outputFormatted(text, width = 80) {
  if (!text) return '';
  
  const lines = text.split('\n');
  const wrappedLines = lines.map(line => {
    if (line.length <= width) return line;

    const words = line.split(' ');
    let currentLine = '';
    const result = [];

    for (const word of words) {
      if ((currentLine + word).length <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) result.push(currentLine);
        
        // If a single word is longer than the width, we must break it
        if (word.length > width) {
          let remainingWord = word;
          while (remainingWord.length > width) {
            result.push(remainingWord.substring(0, width));
            remainingWord = remainingWord.substring(width);
          }
          currentLine = remainingWord;
        } else {
          currentLine = word;
        }
      }
    }
    
    if (currentLine) result.push(currentLine);
    return result.join('\n');
  });

  return wrappedLines.join('\n');
}
