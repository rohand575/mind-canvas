/**
 * Wraps `text` into display lines constrained to `maxWidth` pixels.
 * The caller must set ctx.font before calling this.
 * Explicit `\n` in the text always produce a new line.
 * Words wider than maxWidth are broken at the character level (like CSS overflow-wrap: break-word).
 */
export function wrapTextToLines(
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D,
): string[] {
  const inputLines = text.split('\n');
  const result: string[] = [];

  for (const inputLine of inputLines) {
    if (!inputLine) {
      result.push('');
      continue;
    }
    const words = inputLine.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        result.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
      // Break any segment that is itself wider than maxWidth, character by character
      while (ctx.measureText(currentLine).width > maxWidth) {
        let breakAt = 1;
        while (breakAt < currentLine.length && ctx.measureText(currentLine.slice(0, breakAt + 1)).width <= maxWidth) {
          breakAt++;
        }
        result.push(currentLine.slice(0, breakAt));
        currentLine = currentLine.slice(breakAt);
      }
    }
    if (currentLine) result.push(currentLine);
  }

  return result;
}
