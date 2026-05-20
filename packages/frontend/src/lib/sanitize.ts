/**
 * Escapes HTML special characters to prevent XSS when interpolating
 * user-supplied values into HTML strings (e.g. certificate templates).
 */
export function escapeHtml(value: unknown): string {
  const str = value == null ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates that a value is a safe URL for use as an <img src="..."> in
 * a template string. Accepts https URLs and base64 data URIs for the
 * common raster image formats. Rejects `javascript:`, `data:text/html`,
 * `data:image/svg+xml` (SVG can carry script) and anything malformed.
 *
 * Returns an attribute-safe escaped string (already HTML-escaped) on
 * success, or an empty string on rejection.
 */
export function safeImageUrl(value: unknown): string {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (raw.startsWith('data:')) {
    if (/^data:image\/(png|jpe?g|gif|webp|bmp|x-icon);base64,[A-Za-z0-9+/=]+$/i.test(raw)) {
      return escapeHtml(raw);
    }
    return '';
  }

  try {
    const u = new URL(raw, window.location.origin);
    if (u.protocol === 'https:' || (u.protocol === 'http:' && u.hostname === window.location.hostname)) {
      return escapeHtml(u.toString());
    }
  } catch {
    // fall through
  }
  return '';
}
