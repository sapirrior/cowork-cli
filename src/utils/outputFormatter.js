/**
 * Wraps text to the current terminal width without breaking words unless necessary.
 * Dynamically detects terminal width and preserves whitespace/indentation.
 * @param {string} text The text to format.
 * @param {number} [overrideWidth] Optional manual width override.
 * @returns {string} The formatted text.
 */
export function outputFormatted(text, overrideWidth) {
  if (!text) return '';
  
  // Dynamically determine width (fallback to 80 if not detectable)
  const width = overrideWidth || process.stdout.columns || 80;
  
  const lines = text.split('\n');
  const wrappedLines = lines.map(line => {
    if (line.length <= width) return line;

    // Split by whitespace but keep the whitespace as tokens
    const tokens = line.split(/(\s+)/);
    const result = [];
    let currentLine = '';

    for (const token of tokens) {
      if (!token) continue;

      // If adding this token exceeds width
      if ((currentLine + token).length > width) {
        
        // If it's a long word (not whitespace) that exceeds the entire width
        if (token.length > width && !/^\s+$/.test(token)) {
          // If we have content in currentLine, push it first
          if (currentLine) {
            result.push(currentLine.trimEnd());
            currentLine = '';
          }
          
          // Force-break the long word
          let remainingWord = token;
          while (remainingWord.length > width) {
            result.push(remainingWord.substring(0, width));
            remainingWord = remainingWord.substring(width);
          }
          currentLine = remainingWord;
        } 
        // If it's whitespace that causes overflow, just wrap to next line
        else if (/^\s+$/.test(token)) {
          if (currentLine) {
            result.push(currentLine.trimEnd());
            currentLine = '';
          }
          // Do not start a new line with just spaces if it was leading spaces for a wrapped line
          // (Unless they are the very first spaces on a line, which we handled)
        }
        // If it's a normal word that exceeds width, push currentLine and start new with this word
        else {
          if (currentLine) {
            result.push(currentLine.trimEnd());
          }
          currentLine = token;
        }
      } else {
        // Just append the token (word or whitespace)
        currentLine += token;
      }
    }
    
    if (currentLine) result.push(currentLine.trimEnd());
    return result.join('\n');
  });

  return wrappedLines.join('\n');
}
