/**
 * Code detection and syntax tokenization for canvas code blocks.
 * Detects whether pasted text is code, identifies the language,
 * and tokenizes it for syntax-highlighted rendering.
 */

export type TokenType = 'keyword' | 'string' | 'number' | 'comment' | 'punctuation' | 'property' | 'boolean' | 'null' | 'plain';

export interface Token {
  type: TokenType;
  text: string;
}

// ─── Language Detection ──────────────────────────────────────────

const JSON_PATTERN = /^\s*[\[{]/;
const HTML_PATTERN = /^\s*<(!DOCTYPE|html|div|span|p|a|img|head|body|script|style|link|meta|ul|ol|li|table|form|input|button|h[1-6])\b/i;
const FUNCTION_PATTERN = /\b(function|const|let|var|import|export|class|interface|type|enum|def|fn|func|pub|async|await|return|yield)\b/;
const BRACKET_HEAVY = /[{}\[\]();]/g;
const ARROW_FUNC = /=>/;
const PYTHON_PATTERN = /\b(def |class |import |from .+ import|if __name__|print\(|elif |lambda )/;
const CSS_PATTERN = /[.#][\w-]+\s*\{|@media|@keyframes|@import/;
const SQL_PATTERN = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN|GROUP BY|ORDER BY)\b/i;
const SHELL_PATTERN = /^(\$|#!\/|sudo |apt |npm |yarn |pip |git |docker |curl |wget |chmod |mkdir |cd |ls |echo )/m;

interface DetectionResult {
  isCode: boolean;
  language: string;
}

export function detectCode(text: string): DetectionResult {
  const trimmed = text.trim();

  // Try JSON first — most common code paste
  if (JSON_PATTERN.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return { isCode: true, language: 'json' };
    } catch {
      // Might still be JSON-like but malformed, or JS object
      if (trimmed.startsWith('{') && trimmed.endsWith('}') && trimmed.includes(':')) {
        // Could be JSON with trailing commas or JS object
        const colonCount = (trimmed.match(/:/g) || []).length;
        const lineCount = trimmed.split('\n').length;
        if (colonCount >= 2 && lineCount >= 3) {
          return { isCode: true, language: 'json' };
        }
      }
    }
  }

  // HTML/XML
  if (HTML_PATTERN.test(trimmed) || (trimmed.startsWith('<') && trimmed.endsWith('>') && trimmed.includes('</'))) {
    return { isCode: true, language: 'html' };
  }

  // SQL
  if (SQL_PATTERN.test(trimmed)) {
    return { isCode: true, language: 'sql' };
  }

  // Shell/terminal
  if (SHELL_PATTERN.test(trimmed)) {
    return { isCode: true, language: 'shell' };
  }

  // CSS
  if (CSS_PATTERN.test(trimmed)) {
    return { isCode: true, language: 'css' };
  }

  // Python
  if (PYTHON_PATTERN.test(trimmed)) {
    return { isCode: true, language: 'python' };
  }

  // JavaScript/TypeScript (general programming)
  if (FUNCTION_PATTERN.test(trimmed) || ARROW_FUNC.test(trimmed)) {
    return { isCode: true, language: 'javascript' };
  }

  // Heuristic: if text has many brackets/semicolons relative to length, likely code
  const brackets = (trimmed.match(BRACKET_HEAVY) || []).length;
  const lines = trimmed.split('\n');
  const indentedLines = lines.filter(l => /^\s{2,}/.test(l)).length;

  if (lines.length >= 3 && (brackets >= 4 || indentedLines / lines.length > 0.5)) {
    return { isCode: true, language: 'code' };
  }

  return { isCode: false, language: '' };
}

// ─── Syntax Tokenization ────────────────────────────────────────

const JS_KEYWORDS = new Set([
  'abstract', 'arguments', 'async', 'await', 'break', 'case', 'catch', 'class',
  'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum',
  'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'if',
  'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null',
  'of', 'package', 'private', 'protected', 'public', 'return', 'static', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'var',
  'void', 'while', 'with', 'yield',
]);

const PYTHON_KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for',
  'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None',
  'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try',
  'while', 'with', 'yield',
]);

const SQL_KEYWORDS = new Set([
  'select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set',
  'delete', 'create', 'table', 'alter', 'drop', 'index', 'join', 'inner',
  'outer', 'left', 'right', 'on', 'and', 'or', 'not', 'null', 'is',
  'in', 'between', 'like', 'order', 'by', 'group', 'having', 'limit',
  'as', 'distinct', 'union', 'all', 'exists', 'case', 'when', 'then',
  'else', 'end', 'primary', 'key', 'foreign', 'references', 'constraint',
]);

/**
 * Tokenize a single line of code for syntax highlighting
 */
export function tokenizeLine(line: string, language: string): Token[] {
  if (language === 'json') return tokenizeJSON(line);
  if (language === 'sql') return tokenizeGeneric(line, SQL_KEYWORDS);
  if (language === 'python') return tokenizeGeneric(line, PYTHON_KEYWORDS);
  return tokenizeGeneric(line, JS_KEYWORDS);
}

function tokenizeJSON(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Whitespace
    if (/\s/.test(line[i])) {
      let start = i;
      while (i < line.length && /\s/.test(line[i])) i++;
      tokens.push({ type: 'plain', text: line.slice(start, i) });
      continue;
    }

    // Strings (property keys and values)
    if (line[i] === '"') {
      let start = i;
      i++;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\') i++; // skip escaped char
        i++;
      }
      if (i < line.length) i++; // closing quote
      const str = line.slice(start, i);

      // Check if this is a property key (followed by :)
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      if (line[j] === ':') {
        tokens.push({ type: 'property', text: str });
      } else {
        tokens.push({ type: 'string', text: str });
      }
      continue;
    }

    // Numbers
    if (/[-\d]/.test(line[i]) && (i === 0 || /[\s,:\[]/.test(line[i - 1]))) {
      let start = i;
      if (line[i] === '-') i++;
      while (i < line.length && /[\d.eE+\-]/.test(line[i])) i++;
      if (i > start) {
        tokens.push({ type: 'number', text: line.slice(start, i) });
        continue;
      }
    }

    // Boolean / null
    const remaining = line.slice(i);
    const boolMatch = remaining.match(/^(true|false|null)\b/);
    if (boolMatch) {
      const type = boolMatch[1] === 'null' ? 'null' : 'boolean';
      tokens.push({ type, text: boolMatch[1] });
      i += boolMatch[1].length;
      continue;
    }

    // Punctuation: { } [ ] , :
    if (/[{}\[\],:.]/.test(line[i])) {
      tokens.push({ type: 'punctuation', text: line[i] });
      i++;
      continue;
    }

    // Anything else
    tokens.push({ type: 'plain', text: line[i] });
    i++;
  }

  return tokens;
}

function tokenizeGeneric(line: string, keywords: Set<string>): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Whitespace
    if (/\s/.test(line[i])) {
      let start = i;
      while (i < line.length && /\s/.test(line[i])) i++;
      tokens.push({ type: 'plain', text: line.slice(start, i) });
      continue;
    }

    // Line comments (// or #)
    if ((line[i] === '/' && line[i + 1] === '/') || (line[i] === '#' && keywords === PYTHON_KEYWORDS) || (line[i] === '-' && line[i + 1] === '-' && keywords === SQL_KEYWORDS)) {
      tokens.push({ type: 'comment', text: line.slice(i) });
      break;
    }

    // Strings
    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      const quote = line[i];
      let start = i;
      i++;
      while (i < line.length && line[i] !== quote) {
        if (line[i] === '\\') i++;
        i++;
      }
      if (i < line.length) i++;
      tokens.push({ type: 'string', text: line.slice(start, i) });
      continue;
    }

    // Numbers
    if (/\d/.test(line[i]) && (i === 0 || /[\s,;:=<>+\-*/%!&|^~([\]{]/.test(line[i - 1]))) {
      let start = i;
      while (i < line.length && /[\d.xXbBoOeE_a-fA-F]/.test(line[i])) i++;
      tokens.push({ type: 'number', text: line.slice(start, i) });
      continue;
    }

    // Words (identifiers / keywords)
    if (/[a-zA-Z_$]/.test(line[i])) {
      let start = i;
      while (i < line.length && /[a-zA-Z0-9_$]/.test(line[i])) i++;
      const word = line.slice(start, i);
      if (keywords.has(word)) {
        if (word === 'true' || word === 'True' || word === 'false' || word === 'False') {
          tokens.push({ type: 'boolean', text: word });
        } else if (word === 'null' || word === 'None' || word === 'undefined') {
          tokens.push({ type: 'null', text: word });
        } else {
          tokens.push({ type: 'keyword', text: word });
        }
      } else {
        tokens.push({ type: 'plain', text: word });
      }
      continue;
    }

    // Punctuation / operators
    if (/[{}\[\](),:;.=<>+\-*/%!&|^~?@]/.test(line[i])) {
      tokens.push({ type: 'punctuation', text: line[i] });
      i++;
      continue;
    }

    // Anything else
    tokens.push({ type: 'plain', text: line[i] });
    i++;
  }

  return tokens;
}

// ─── Color Themes ───────────────────────────────────────────────

export interface SyntaxTheme {
  background: string;
  text: string;
  keyword: string;
  string: string;
  number: string;
  comment: string;
  punctuation: string;
  property: string;
  boolean: string;
  null: string;
}

export const CODE_THEME_DARK: SyntaxTheme = {
  background: '#1e1e2e',
  text: '#cdd6f4',
  keyword: '#cba6f7',
  string: '#a6e3a1',
  number: '#fab387',
  comment: '#6c7086',
  punctuation: '#9399b2',
  property: '#89b4fa',
  boolean: '#fab387',
  null: '#f38ba8',
};

export const CODE_THEME_LIGHT: SyntaxTheme = {
  background: '#f5f5f5',
  text: '#383a42',
  keyword: '#a626a4',
  string: '#50a14f',
  number: '#986801',
  comment: '#a0a1a7',
  punctuation: '#383a42',
  property: '#4078f2',
  boolean: '#986801',
  null: '#e45649',
};

export function getTokenColor(type: TokenType, theme: SyntaxTheme): string {
  switch (type) {
    case 'keyword': return theme.keyword;
    case 'string': return theme.string;
    case 'number': return theme.number;
    case 'comment': return theme.comment;
    case 'punctuation': return theme.punctuation;
    case 'property': return theme.property;
    case 'boolean': return theme.boolean;
    case 'null': return theme.null;
    default: return theme.text;
  }
}

// ─── Constants ──────────────────────────────────────────────────

export const CODE_FONT = "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', 'Monaco', monospace";
export const CODE_FONT_SIZE = 14;
export const CODE_LINE_HEIGHT = 1.5;
export const CODE_PADDING = 16;
export const CODE_BORDER_RADIUS = 8;
