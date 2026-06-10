import OpenAI from 'openai';
import type { CanvasElement } from '../types';
import { parseSVGToElements } from './svgToElements';

export type AIMode = 'draw' | 'diagram';

const DRAW_SYSTEM_PROMPT = `You are an expert SVG illustrator. Given a description, create a clear, detailed, and visually appealing SVG illustration.

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

const DIAGRAM_SYSTEM_PROMPT = `You are an expert flowchart and infographic designer. Given complex text describing logic, rules, or processes, analyze it deeply and produce a clear, well-structured SVG diagram.

Return ONLY a valid SVG element — no markdown, no code fences, no explanation. Start your response with <svg and end with </svg>.

<svg viewBox="0 0 900 1400" xmlns="http://www.w3.org/2000/svg">
  <!-- your elements here -->
</svg>

STRICT RULES:
- viewBox must be "0 0 900 1400"
- Use ONLY these elements: <rect>, <circle>, <ellipse>, <path>, <line>, <polyline>, <polygon>, <text>, <g>
- Set fill and stroke as direct XML attributes only
- Do NOT use: <defs>, <use>, <symbol>, <clipPath>, <filter>, <pattern>, <linearGradient>, <radialGradient>, <marker>
- Do NOT use transform attributes
- Do NOT use CSS classes or <style> blocks

SHAPE CONVENTIONS:
- Process/action box: <rect rx="6" ry="6"> width=220 height=50, fill="#e8f0fe" stroke="#4285f4" stroke-width="1.5"
- Decision diamond: <polygon> with 4 points, fill="#fff3e0" stroke="#f59e0b" stroke-width="1.5"
  Example: <polygon points="450,200 570,240 450,280 330,240" fill="#fff3e0" stroke="#f59e0b" stroke-width="1.5"/>
- Start/End pill: <rect rx="25" ry="25"> width=180 height=44, fill="#e8f5e9" stroke="#34a853" stroke-width="1.5"
- Section header: <rect rx="4" ry="4"> wide, fill="#1e3a5f" with <text fill="#ffffff">
- Annotation box: <rect rx="4" ry="4"> fill="#f8f9fa" stroke="#dee2e6" stroke-width="1"

ARROW RULES (no <marker> available — draw manually):
- Shaft: <line x1="..." y1="..." x2="..." y2="..." stroke="#64748b" stroke-width="1.5"/>
- Downward arrowhead: <polygon points="x-5,y x+5,y x,y+10" fill="#64748b"/>
- Rightward arrowhead: <polygon points="x,y-5 x,y+5 x+10,y" fill="#64748b"/>
- Upward arrowhead: <polygon points="x-5,y x+5,y x,y-10" fill="#64748b"/>
- Left arrowhead: <polygon points="x,y-5 x,y+5 x-10,y" fill="#64748b"/>

TEXT RULES:
- Label inside box: <text text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#1a1a1a">
- If label is long, split across 2 <text> lines using dy offset: first line dy="-7", second line dy="7"
- YES/NO branch labels: font-size="11" fill="#555555" near the branch line
- Section titles: font-size="14" font-weight="bold"
- Small annotations: font-size="10" fill="#6b7280"

LAYOUT:
- Horizontal center: x=450
- Start at y=40, flow downward with 70-90px gaps between shapes
- Branch left at x≈220, branch right at x≈680 when decision splits
- Reconnect branches back to center before continuing
- Group logically related steps with a faint background <rect fill="#f8faff" stroke="#c7d2fe" stroke-width="1" rx="8">

COLOR PALETTE:
- Process blue:     fill="#e8f0fe" stroke="#4285f4"
- Decision amber:   fill="#fff3e0" stroke="#f59e0b"
- Start/end green:  fill="#e8f5e9" stroke="#34a853"
- Reject/error red: fill="#fce8e6" stroke="#ea4335"
- Neutral gray:     fill="#f5f5f5" stroke="#9e9e9e"
- Dark header:      fill="#1e3a5f" (text fill="#ffffff")
- Arrow/line:       "#64748b"
- Body text:        fill="#1a1a1a"

TASK — follow these steps:
1. Read the entire input carefully to extract: entities, conditions, decision points, outcomes, priority rules, and flows.
2. Decide: flowchart (sequential logic/process) or infographic (categorized facts/data).
3. For a flowchart: map each rule/step to a shape, connect with labeled arrows, handle every branch and outcome.
4. For an infographic: organize into titled sections, use icons and proportional shapes to convey quantities or categories.
5. Ensure every decision box has labeled YES/NO (or equivalent) branches.
6. Fit all content within the viewBox — compress spacing if needed rather than cutting content.
7. Generate 40–100 SVG elements for completeness.`;

export async function generateDrawing(
  prompt: string,
  apiKey: string,
  viewportCenterX: number,
  viewportCenterY: number,
  startZIndex: number,
  mode: AIMode = 'draw'
): Promise<CanvasElement[]> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const systemPrompt = mode === 'diagram' ? DIAGRAM_SYSTEM_PROMPT : DRAW_SYSTEM_PROMPT;
  const userContent = mode === 'diagram'
    ? `Create a clear flowchart or infographic for the following:\n\n${prompt}`
    : `Draw: ${prompt}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    max_tokens: mode === 'diagram' ? 14000 : 8000,
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
