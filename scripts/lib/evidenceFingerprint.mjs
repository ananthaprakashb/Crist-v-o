import { createHash } from 'node:crypto';

export function fingerprintClaims(claims = []) {
  if (!Array.isArray(claims) || claims.length === 0) return undefined;

  const canonical = claims
    .map((claim) => ({
      claimId: claim.claimId,
      label: claim.label,
      value: claim.value ?? null,
      passage: claim.passage,
      matchType: claim.matchType,
    }))
    .sort((a, b) => a.claimId.localeCompare(b.claimId));

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
