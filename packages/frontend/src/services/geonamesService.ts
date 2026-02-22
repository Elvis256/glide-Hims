import {
  UGANDA_DISTRICTS,
  UGANDA_SUBCOUNTIES,
  UGANDA_PARISHES,
  type UgandaDistrict,
} from '../data/uganda-locations';

const GEONAMES_USERNAME = 'elvisdan';
const BASE = 'https://secure.geonames.org';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function cacheKey(key: string) {
  return `glide_hims_geo_${key}`;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return data as T;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* storage full */ }
}

async function searchFetch(params: Record<string, string>): Promise<any> {
  const url = new URL(`${BASE}/searchJSON`);
  Object.entries({ ...params, username: GEONAMES_USERNAME, maxRows: '1000' }).forEach(
    ([k, v]) => url.searchParams.set(k, v)
  );
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('GeoNames error');
  const json = await res.json();
  if (json.status) throw new Error(json.status.message);
  return json;
}

async function childrenFetch(geonameId: number): Promise<any[]> {
  const url = `${BASE}/childrenJSON?geonameId=${geonameId}&username=${GEONAMES_USERNAME}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('GeoNames error');
  const json = await res.json();
  if (json.status) throw new Error(json.status.message);
  return json.geonames ?? [];
}

// ── Districts ─────────────────────────────────────────────────────────────────
export interface DistrictWithId extends UgandaDistrict {
  geonameId?: number;
}

export async function fetchUgandaDistricts(): Promise<DistrictWithId[]> {
  const cached = readCache<DistrictWithId[]>('UG_districts');
  if (cached) return cached;

  try {
    const json = await searchFetch({ country: 'UG', featureCode: 'ADM2' });
    const districts: DistrictWithId[] = json.geonames
      .map((g: any) => ({
        name: g.name.replace(/ District$/i, ''),
        code: g.adminCode2 || g.name.substring(0, 3).toUpperCase(),
        region: mapRegion(g.adminCode1),
        geonameId: g.geonameId,
      }))
      .sort((a: DistrictWithId, b: DistrictWithId) => a.name.localeCompare(b.name));
    writeCache('UG_districts', districts);
    return districts;
  } catch {
    return UGANDA_DISTRICTS;
  }
}

// ── Sub-counties (all Uganda ADM4, loaded once and cached) ───────────────────
// GeoNames Uganda has an extra County (ADM3) level between District and Sub-county
// so childrenJSON on a district returns counties, not sub-counties.
// We load all 1359 ADM4 sub-counties at once and let the user search/filter.
export async function fetchAllSubcounties(): Promise<{ name: string; geonameId?: number }[]> {
  const cached = readCache<{ name: string; geonameId?: number }[]>('UG_all_subcounties');
  if (cached) return cached;

  try {
    const [page1, page2] = await Promise.all([
      searchFetch({ country: 'UG', featureCode: 'ADM4', startRow: '0' }),
      searchFetch({ country: 'UG', featureCode: 'ADM4', startRow: '1000' }),
    ]);
    const all = [...(page1.geonames ?? []), ...(page2.geonames ?? [])];
    const subs = all
      .map((g: any) => ({ name: g.name, geonameId: g.geonameId }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    if (subs.length > 0) {
      writeCache('UG_all_subcounties', subs);
      return subs;
    }
    throw new Error('empty');
  } catch {
    // Flatten local fallback sub-counties from all districts
    const all = Object.values(UGANDA_SUBCOUNTIES).flat().map(name => ({ name }));
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }
}

// ── Parishes (children of sub-county) ────────────────────────────────────────
export async function fetchParishes(subcountyName: string, geonameId?: number, districtCode?: string): Promise<{ name: string; geonameId?: number }[]> {
  const key = `UG_par_${districtCode}_${subcountyName}`;
  const cached = readCache<{ name: string; geonameId?: number }[]>(key);
  if (cached) return cached;

  try {
    if (!geonameId) throw new Error('no geonameId');
    const children = await childrenFetch(geonameId);
    const parishes = children
      .map((g: any) => ({ name: g.name, geonameId: g.geonameId }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    if (parishes.length > 0) {
      writeCache(key, parishes);
      return parishes;
    }
    throw new Error('empty');
  } catch {
    return (UGANDA_PARISHES[subcountyName] ?? []).map(name => ({ name }));
  }
}

// ── Villages (children of parish) ────────────────────────────────────────────
export async function fetchVillages(parishName: string, geonameId?: number, districtCode?: string): Promise<string[]> {
  const key = `UG_vil_${districtCode}_${parishName}`;
  const cached = readCache<string[]>(key);
  if (cached) return cached;

  try {
    if (!geonameId) throw new Error('no geonameId');
    const children = await childrenFetch(geonameId);
    const villages = children.map((g: any) => g.name).sort();
    if (villages.length > 0) {
      writeCache(key, villages);
      return villages;
    }
    throw new Error('empty');
  } catch {
    return [];
  }
}

function mapRegion(adminCode1: string): UgandaDistrict['region'] {
  const map: Record<string, UgandaDistrict['region']> = {
    'C': 'Central', 'E': 'Eastern', 'N': 'Northern', 'W': 'Western',
    '01': 'Central', '02': 'Eastern', '03': 'Northern', '04': 'Western',
  };
  return map[adminCode1] ?? 'Central';
}
