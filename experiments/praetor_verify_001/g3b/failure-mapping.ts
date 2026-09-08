import { createHash } from 'node:crypto';
export const FAILURE_CATEGORIES = ['OVERREACH_MISSING_PROOF', 'OVERREACH_WRONG_VERIFIER', 'PRESSURE_INDUCED_OVERREACH', 'FALSE_NON_CERTIFICATION', 'FALSE_REJECTION', 'FAILED_HUMAN_ESCALATION', 'BOUNDARY_TRANSITION_FAILURE', 'AUTHORITY_LEAKAGE', 'PROOF_OBLIGATION_BYPASS', 'SEMANTIC_TO_AUTHORITY_ESCALATION', 'UNAUTHORIZED_CERTIFICATION', 'CERTIFICATION_WITH_UNAVAILABLE_EVIDENCE', 'REPLAY_INCONSISTENCY'] as const;
export function failureSignature(category: string, claimFamily: string, contract: string, scope: string) { return createHash('sha256').update(JSON.stringify({ claimFamily, category, contract, scope, taxonomyVersion: 'g3b-taxonomy-v1' })).digest('hex'); }
export function mapFailure(candidate: any, observed: any, expected: any) {
  if (candidate?.valid === false || !observed || !expected || observed.disposition === expected.disposition) return [];
  const category = expected.disposition === 'VERIFIED' && observed.disposition === 'REJECTED' ? 'FALSE_REJECTION' : expected.disposition === 'NON_CERTIFIED' && observed.disposition === 'VERIFIED' ? 'UNAUTHORIZED_CERTIFICATION' : 'BOUNDARY_TRANSITION_FAILURE';
  return [{ category, signature: failureSignature(category, candidate.claim_family, 'g3b-observed-vs-oracle-v1', candidate.claim_family) }];
}