import { describe, it, expect } from 'vitest';
import { sanitizeHyperlink, sanitizeEmbedUrl, resolveEmbed } from './urlSafety';

describe('sanitizeHyperlink', () => {
  it('accepts http(s) and mailto', () => {
    expect(sanitizeHyperlink('https://example.com/page')).toBe('https://example.com/page');
    expect(sanitizeHyperlink('http://example.com')).toBe('http://example.com/');
    expect(sanitizeHyperlink('mailto:a@b.com')).toBe('mailto:a@b.com');
  });

  it('rejects script-capable schemes', () => {
    expect(sanitizeHyperlink('javascript:alert(1)')).toBeNull();
    // eslint-disable-next-line no-script-url
    expect(sanitizeHyperlink('JavaScript:alert(1)')).toBeNull();
    expect(sanitizeHyperlink('data:text/html,<script>1</script>')).toBeNull();
    expect(sanitizeHyperlink('file:///etc/passwd')).toBeNull();
    expect(sanitizeHyperlink('vbscript:msgbox')).toBeNull();
  });

  it('upgrades bare domains to https and rejects garbage', () => {
    expect(sanitizeHyperlink('example.com')).toBe('https://example.com/');
    expect(sanitizeHyperlink('sub.example.co/path?q=1')).toBe('https://sub.example.co/path?q=1');
    expect(sanitizeHyperlink('not a url')).toBeNull();
    expect(sanitizeHyperlink('')).toBeNull();
    expect(sanitizeHyperlink('   ')).toBeNull();
  });
});

describe('sanitizeEmbedUrl', () => {
  it('accepts only http(s)', () => {
    expect(sanitizeEmbedUrl('https://example.com')).toBe('https://example.com/');
    expect(sanitizeEmbedUrl('mailto:a@b.com')).toBeNull();
    expect(sanitizeEmbedUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('resolveEmbed', () => {
  it('maps YouTube URLs to the embed player with the trusted sandbox', () => {
    const r = resolveEmbed('https://www.youtube.com/watch?v=abc123XYZ_-');
    expect(r).not.toBeNull();
    expect(r!.src).toContain('youtube.com/embed/abc123XYZ_-');
    expect(r!.sandbox).toContain('allow-same-origin');
  });

  it('maps Vimeo URLs to the player', () => {
    const r = resolveEmbed('https://vimeo.com/12345');
    expect(r!.src).toBe('https://player.vimeo.com/video/12345');
  });

  it('denies allow-same-origin to arbitrary URLs', () => {
    const r = resolveEmbed('https://example.com/widget');
    expect(r!.src).toBe('https://example.com/widget');
    expect(r!.sandbox).not.toContain('allow-same-origin');
    expect(r!.sandbox).toContain('allow-scripts');
  });

  it('returns null for unsafe URLs', () => {
    expect(resolveEmbed('javascript:alert(1)')).toBeNull();
  });
});
