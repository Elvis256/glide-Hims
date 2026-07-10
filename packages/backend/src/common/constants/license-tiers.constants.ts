/**
 * Canonical license tier ranking used across the platform.
 * Higher rank = more capabilities. A tenant on tier X may use any feature
 * that requires tier <= X.
 */
export const LICENSE_TIER_RANK: Record<string, number> = {
  trial: 0,
  free: 0,
  basic: 1,
  standard: 1,
  professional: 2,
  pro: 2,
  enterprise: 3,
};

export type LicenseTier = 'trial' | 'standard' | 'professional' | 'enterprise';

export function tierRank(tier?: string | null): number {
  if (!tier) return 0;
  return LICENSE_TIER_RANK[String(tier).toLowerCase()] ?? 0;
}

export function meetsTier(
  actual: string | null | undefined,
  required: string | null | undefined,
): boolean {
  if (!required) return true;
  return tierRank(actual) >= tierRank(required);
}
