import OpenAI from 'openai';
import type { CanvasElement } from '../types';
import { parseSVGToElements } from './svgToElements';

const SYSTEM_PROMPT = `You are an expert SVG illustrator. Given a description, create a clear, detailed, and visually appealing SVG illustration.

Return ONLY a valid SVG element — no markdown, no code fences, no explanation. Start your response with <svg and end with </svg>.

<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <!-- your elements here -->
</svg>

STRICT RULES:
- viewBox must be "0 0 800 600"
- Center the subject within the viewBox
- Use ONLY these elements: <rect>, <circle>, <ellipse>, <path>, <line>, <polyline>, <polygon>, <text>, <g>
- Set fill and stroke as direct XML attributes (e.g. fill="#e8f4fd" stroke="#1971c2")
- Do NOT use: <defs>, <use>, <symbol>, <clipPath>, <filter>, <pattern>, <linearGradient>, <radialGradient>
- Do NOT use transform attributes
- Do NOT use CSS classes or <style> blocks
- stroke-width should be 1.5 to 3 for most elements
- For labels: use <text> with font-size="14" to font-size="18", text-anchor="middle"

ILLUSTRATION QUALITY:
- Generate 20–60 elements for richness and detail
- Use a cohesive, harmonious color palette
- Combine paths for organic shapes with primitives for structural parts
- Add clear <text> labels for all major components
- Shade / layer elements for depth (darker strokes on lighter fills)
- Use meaningful anatomy: correct proportions and spatial relationships

EXAMPLE color palette (adapt per subject):
  Skin/body: fill="#fde8d0" stroke="#c47a3a"
  Bone:      fill="#f5f0e0" stroke="#b8a060"
  Muscle:    fill="#e8a090" stroke="#c04040"
  Organ:     fill="#f0c0c0" stroke="#a03030"
  Vein/nerve: stroke="#4060c0" fill="none"
  Text:      fill="#1e1e1e"`;

export async function generateDrawing(
  prompt: string,
  apiKey: string,
  viewportCenterX: number,
  viewportCenterY: number,
  startZIndex: number
): Promise<CanvasElement[]> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Draw: ${prompt}` },
    ],
    max_tokens: 8000,
  });

  const content = response.choices[0]?.message?.content ?? '';
  if (!content) throw new Error('No response from AI');

  // Extract the SVG block — be tolerant of extra whitespace / prose around it
  const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgMatch) throw new Error('AI did not return an SVG. Try rephrasing your prompt.');

  const elements = parseSVGToElements(svgMatch[0], viewportCenterX, viewportCenterY, startZIndex);
  if (elements.length === 0) throw new Error('The generated SVG had no drawable elements. Try a different prompt.');

  return elements;
}
