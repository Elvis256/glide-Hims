import { COUNTRIES_FALLBACK, type Country } from '../data/countries';

const CACHE_KEY = 'glide_hims_countries';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  data: Country[];
  timestamp: number;
}

function getCache(): Country[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(data: Country[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* storage full, ignore */ }
}

export async function fetchAllCountries(): Promise<Country[]> {
  const cached = getCache();
  if (cached) return cached;

  try {
    const res = await fetch(
      'https://restcountries.com/v3.1/all?fields=name,cca2,idd,flag',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error('API error');
    const raw = await res.json();

    const countries: Country[] = raw
      .map((c: any) => ({
        name: c.name.common,
        code: c.cca2,
        dialCode: c.idd?.root
          ? `${c.idd.root}${c.idd.suffixes?.[0] ?? ''}`
          : '',
        flag: c.flag ?? '',
      }))
      .filter((c: Country) => c.name)
      .sort((a: Country, b: Country) => {
        // Uganda first, then alphabetical
        if (a.code === 'UG') return -1;
        if (b.code === 'UG') return 1;
        return a.name.localeCompare(b.name);
      });

    setCache(countries);
    return countries;
  } catch {
    // Offline fallback — sort Uganda first
    return [...COUNTRIES_FALLBACK].sort((a, b) => {
      if (a.code === 'UG') return -1;
      if (b.code === 'UG') return 1;
      return a.name.localeCompare(b.name);
    });
  }
}
