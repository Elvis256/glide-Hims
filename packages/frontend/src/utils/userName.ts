export function userDisplayName(u: unknown, fallback = '—'): string {
  if (!u) return fallback;
  if (typeof u === 'string') return u || fallback;
  if (typeof u === 'object') {
    const o = u as Record<string, unknown>;
    if (typeof o.fullName === 'string' && o.fullName.trim()) return o.fullName;
    if (typeof o.name === 'string' && o.name.trim()) return o.name;
    const fn = typeof o.firstName === 'string' ? o.firstName : '';
    const ln = typeof o.lastName === 'string' ? o.lastName : '';
    const joined = `${fn} ${ln}`.trim();
    if (joined) return joined;
    if (typeof o.username === 'string' && o.username.trim()) return o.username;
    if (typeof o.email === 'string' && o.email.trim()) return o.email;
  }
  return fallback;
}
