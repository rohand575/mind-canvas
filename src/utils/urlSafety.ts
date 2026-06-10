/**
 * URL validation for user-provided links (hyperlinks, embeds).
 *
 * Only http(s) (and mailto: for hyperlinks) are allowed. Everything else —
 * javascript:, data:, file:, vbscript:, blob: — is rejected to prevent
 * script-injection via stored URLs, which is especially important inside
 * the Electron build.
 */

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
// "example.com", "sub.domain.co/path" — looks like a host, just missing a scheme
const BARE_HOST_RE = /^[\w-]+(\.[\w-]+)+([/?#]|$)/;

function normalize(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (!SCHEME_RE.test(url)) {
    // No scheme — treat as https if it plausibly is a host, reject otherwise
    return BARE_HOST_RE.test(url) ? `https://${url}` : null;
  }
  return url;
}

/** Validate a hyperlink for window.open / shell.openExternal. */
export function sanitizeHyperlink(raw: string): string | null {
  const url = normalize(raw);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}

/** Validate a URL for use as an iframe embed source. */
export function sanitizeEmbedUrl(raw: string): string | null {
  const url = normalize(raw);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Resolve the iframe src and sandbox policy for an embed URL.
 *
 * Known video platforms get their player URL plus `allow-same-origin`
 * (required for the players to function fully). Arbitrary URLs are
 * sandboxed WITHOUT `allow-same-origin` — combining it with
 * `allow-scripts` would let a same-origin-capable document escape the
 * sandbox entirely.
 */
export function resolveEmbed(raw: string): { src: string; sandbox: string } | null {
  const url = sanitizeEmbedUrl(raw);
  if (!url) return null;

  const TRUSTED_SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups';
  const UNTRUSTED_SANDBOX = 'allow-scripts allow-forms allow-presentation allow-popups';

  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) {
    return {
      src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`,
      sandbox: TRUSTED_SANDBOX,
    };
  }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return {
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      sandbox: TRUSTED_SANDBOX,
    };
  }
  return { src: url, sandbox: UNTRUSTED_SANDBOX };
}
