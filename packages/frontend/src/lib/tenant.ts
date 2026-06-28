/**
 * Subdomain-based tenant detection.
 *
 * Extracts the tenant slug from the hostname once at module load.
 * Does NOT grow with tenants — uses a small allowlist of "main" domains.
 */

/** Domains that are NOT tenant subdomains (marketing / demo / platform). */
const MAIN_DOMAINS = new Set([
  'itsolutionsuganda.com',
  'hmisdemo.itsolutionsuganda.com',
  'www.itsolutionsuganda.com',
]);

/**
 * Pure function: extract a tenant slug from a hostname.
 *
 * - `tesy.itsolutionsuganda.com`         → "tesy"
 * - `tesy.hmisdemo.itsolutionsuganda.com` → "tesy"
 * - `hmisdemo.itsolutionsuganda.com`      → null  (main domain)
 * - `localhost`                           → null  (dev)
 * - `192.168.x.x`                        → null  (IP)
 */
export function extractTenantSlug(hostname: string): string | null {
  // Strip port if present
  const host = hostname.split(':')[0];

  // Skip IPs (v4 simple check) and localhost
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === 'localhost') {
    return null;
  }

  // If the full host is a known main domain, no tenant
  if (MAIN_DOMAINS.has(host)) {
    return null;
  }

  // Check if host ends with any main domain; if so, the prefix is the tenant slug
  for (const main of MAIN_DOMAINS) {
    if (host.endsWith(`.${main}`)) {
      const prefix = host.slice(0, -(main.length + 1)); // e.g. "tesy"
      // The prefix could itself contain dots (e.g. "a.b") — take only the leftmost label
      const slug = prefix.split('.')[0];
      return slug || null;
    }
  }

  return null;
}

/** Tenant slug detected from the current hostname (computed once). */
export const subdomainTenantSlug: string | null =
  typeof window !== 'undefined' ? extractTenantSlug(window.location.hostname) : null;

/** True when the page is loaded on a tenant subdomain. */
export const isTenantSubdomain: boolean = subdomainTenantSlug !== null;

/**
 * Merge a URL-param slug with the subdomain slug.
 * URL param wins when present (preserves path-based `/login/tesy` flow).
 */
export function getEffectiveTenantSlug(routeSlug?: string): string | undefined {
  return routeSlug || subdomainTenantSlug || undefined;
}

/**
 * Build the login path for redirects.
 *
 * On a tenant subdomain → `/login` (slug is implicit in hostname).
 * On the main domain     → `/login/{slug}` when a slug is known, else `/login`.
 */
export function buildLoginPath(slug?: string | null): string {
  if (isTenantSubdomain) {
    return '/login';
  }
  const effective = slug ?? subdomainTenantSlug;
  return effective ? `/login/${effective}` : '/login';
}
