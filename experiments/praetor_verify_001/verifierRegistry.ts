import { createHash } from 'node:crypto';
import type { ClaimClass, ClaimType, VerificationMode } from './claimTaxonomy.js';

export const REGISTRY_VERSION = 'praetor-verify-001-registry-v2';

export type VerifierName = 'AGENT_K' | 'SEMANTIC_JUDGE' | 'HUMAN_REVIEW' | 'NO_AUTOMATED_VERIFIER';

export interface VerifierCapability {
  name: VerifierName;
  version: string;
  may_handle: readonly ClaimClass[];
  may_certify: boolean;
  claim_families: readonly ClaimType[];
  required_evidence: readonly string[];
  verification_mode: VerificationMode;
  missing_evidence_outcome: 'NON_CERTIFIED' | 'REVIEW_REQUIRED';
}

export const VERIFIER_REGISTRY: readonly VerifierCapability[] = [
  { name: 'AGENT_K', version: 'agent-k-deterministic-v2', may_handle: ['DETERMINISTICALLY_VERIFIABLE'], may_certify: true, claim_families: ['permission', 'schema', 'precondition', 'lineage'], required_evidence: [], verification_mode: 'POSITIVE_EVIDENCE_REQUIRED', missing_evidence_outcome: 'NON_CERTIFIED' },
  { name: 'SEMANTIC_JUDGE', version: 'semantic-judge-observer-v2', may_handle: ['SEMANTICALLY_ASSESSABLE'], may_certify: false, claim_families: ['unsupported_certainty', 'contradiction', 'ambiguity', 'qualification_mismatch'], required_evidence: [], verification_mode: 'POSITIVE_EVIDENCE_REQUIRED', missing_evidence_outcome: 'REVIEW_REQUIRED' },
  { name: 'HUMAN_REVIEW', version: 'human-review-boundary-v2', may_handle: ['HUMAN_REVIEW_REQUIRED'], may_certify: true, claim_families: ['policy_exception', 'conflicting_evidence', 'authority_delegation'], required_evidence: ['exception_context'], verification_mode: 'POSITIVE_EVIDENCE_REQUIRED', missing_evidence_outcome: 'REVIEW_REQUIRED' },
  { name: 'NO_AUTOMATED_VERIFIER', version: 'none-v2', may_handle: ['UNVERIFIABLE_NON_CERTIFIABLE'], may_certify: false, claim_families: ['universal_safety', 'future_reliability', 'complete_controllability'], required_evidence: [], verification_mode: 'POSITIVE_EVIDENCE_REQUIRED', missing_evidence_outcome: 'NON_CERTIFIED' }
];

export function verifierFor(claimClass: ClaimClass): VerifierCapability {
  return VERIFIER_REGISTRY.find(verifier => verifier.may_handle.includes(claimClass)) ?? VERIFIER_REGISTRY[3];
}

export function registryFingerprint(): string {
  return createHash('sha256').update(JSON.stringify({ version: REGISTRY_VERSION, registry: VERIFIER_REGISTRY }), 'utf8').digest('hex');
}