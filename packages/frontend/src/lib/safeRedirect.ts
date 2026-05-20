/**
 * Allowlist-based redirect helper.
 *
 * Used to prevent open-redirect attacks when the destination URL comes from
 * an API response (e.g. a payment-gateway checkout link). Only same-origin
 * URLs and URLs whose hostname matches one of the allowed suffixes are
 * permitted; anything else is rejected.
 */

const ALLOWED_REDIRECT_HOSTS: readonly string[] = [
  'flutterwave.com',
  'flw.ng',
  'pesapal.com',
  'stripe.com',
  'checkout.stripe.com',
];

export function isSafeExternalRedirect(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string' || !rawUrl) return false;
  let url: URL;
  try {
    url = new URL(rawUrl, window.location.origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.origin === window.location.origin) return true;
  const host = url.hostname.toLowerCase();
  return ALLOWED_REDIRECT_HOSTS.some(
    (allowed) => host === allowed || host.endsWith('.' + allowed),
  );
}

/**
 * Navigate to `rawUrl` only if it points at the same origin or an
 * allow-listed payment gateway. Returns true on navigation, false if
 * the URL was rejected (caller is expected to surface an error).
 */
export function safeRedirect(rawUrl: string): boolean {
  if (!isSafeExternalRedirect(rawUrl)) return false;
  window.location.href = rawUrl;
  return true;
}
