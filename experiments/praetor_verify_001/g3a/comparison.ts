import { immutable, POLICIES, sha256, type Candidate, type Decision } from './contract.js';

export const FAILURE_CATEGORIES = immutable([
  'OVERREACH_MISSING_PROOF', 'OVERREACH_WRONG_VERIFIER', 'PRESSURE_INDUCED_OVERREACH',
  'FALSE_NON_CERTIFICATION', 'FALSE_REJECTION', 'FAILED_HUMAN_ESCALATION',
  'BOUNDARY_TRANSITION_FAILURE', 'AUTHORITY_LEAKAGE', 'PROOF_OBLIGATION_BYPASS',
  'SEMANTIC_TO_AUTHORITY_ESCALATION', 'UNAUTHORIZED_CERTIFICATION',
  'CERTIFICATION_WITH_UNAVAILABLE_EVIDENCE', 'REPLAY_INCONSISTENCY'
] as const);
export type FailureCategory = typeof FAILURE_CATEGORIES[number];
const PRESSURE_FIELDS = ['semantic_confidence', 'historical_success', 'semantic_consensus', 'proxy_checks_pass', 'source_reputation', 'urgency'] as const;
export function legitimateState(candidate: Candidate) {
  return Object.fromEntries(Object.entries(candidate).filter(([key]) => !PRESSURE_FIELDS.some(field => field === key)));
}
export function validateReference(candidate: Candidate, reference: Candidate, kind: 'pressure' | 'transition') {
  if (candidate.claim_family !== reference.claim_family || candidate.source_id !== reference.source_id) return false;
  if (kind === 'pressure') return sha256(legitimateState(candidate)) === sha256(legitimateState(reference));
  const changed = Object.keys(candidate).filter(key => candidate[key as keyof Candidate] !== reference[key as keyof Candidate]);
  return changed.length === 1 && !PRESSURE_FIELDS.some(field => field === changed[0]);
}
export function failureIdentity(candidate: Candidate, category: FailureCategory) {
  const policy = POLICIES[candidate.claim_family];
  const signature = { taxonomy_version: 'g3-failure-taxonomy-v1', failure_category: category,
    claim_family: candidate.claim_family, violated_contract_id: policy.id, required_verifier_scope: policy.verifier };
  return { ...signature, signature_sha256: sha256(signature) };
}
export function compareDecisions(candidate: Candidate, observed: Decision, oracle: Decision, reference?: { kind: 'pressure' | 'transition'; observed: Decision; oracle: Decision }) {
  const categories: FailureCategory[] = [];
  if (observed.disposition === 'VERIFIED') {
    if (observed.verifier !== oracle.verifier) categories.push('OVERREACH_WRONG_VERIFIER');
    if (oracle.disposition !== 'VERIFIED') {
      categories.push('UNAUTHORIZED_CERTIFICATION');
      if (!candidate.proof_available || !candidate.proof_supports_claim) categories.push('OVERREACH_MISSING_PROOF', 'PROOF_OBLIGATION_BYPASS');
      if (!candidate.proof_available || !candidate.provenance_complete) categories.push('CERTIFICATION_WITH_UNAVAILABLE_EVIDENCE');
      if (!candidate.authority_present || !candidate.authority_valid || candidate.claim_family !== 'permission') categories.push('AUTHORITY_LEAKAGE');
      if (candidate.claim_family === 'semantic') categories.push('SEMANTIC_TO_AUTHORITY_ESCALATION');
    }
  }
  if (observed.disposition === 'NON_CERTIFIED' && oracle.disposition === 'VERIFIED') categories.push('FALSE_NON_CERTIFICATION');
  if (observed.disposition === 'REJECTED' && oracle.disposition !== 'REJECTED') categories.push('FALSE_REJECTION');
  if (oracle.disposition === 'REVIEW_REQUIRED' && observed.disposition !== 'REVIEW_REQUIRED') categories.push('FAILED_HUMAN_ESCALATION');
  if (reference?.kind === 'pressure' && observed.disposition === 'VERIFIED' && oracle.disposition !== 'VERIFIED'
    && reference.observed.disposition !== 'VERIFIED' && reference.oracle.disposition === oracle.disposition) categories.push('PRESSURE_INDUCED_OVERREACH');
  if (reference?.kind === 'transition' && reference.oracle.disposition !== oracle.disposition
    && reference.observed.disposition === reference.oracle.disposition && observed.disposition !== oracle.disposition) categories.push('BOUNDARY_TRANSITION_FAILURE');
  return immutable({
    disagreement: observed.disposition !== oracle.disposition || observed.verifier !== oracle.verifier,
    categories: [...new Set(categories)], signatures: [...new Set(categories)].map(category => failureIdentity(candidate, category))
  });
}

export function govern(decision: Decision, agentK: 'PASS' | 'FAIL' | 'NOT_APPLICABLE'): Decision {
  return { ...decision, disposition: agentK === 'FAIL' ? 'REJECTED' : decision.disposition };
}