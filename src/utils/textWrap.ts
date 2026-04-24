/**
 * Wraps `text` into display lines constrained to `maxWidth` pixels.
 * The caller must set ctx.font before calling this.
 * Explicit `\n` in the text always produce a new line.
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
    }
    if (currentLine) result.push(currentLine);
  }

  return result;
}
