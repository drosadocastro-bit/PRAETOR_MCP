import { createHash } from 'node:crypto';

export const TAXONOMY_VERSION = 'praetor-verify-001-taxonomy-v2';

export const CLAIM_CLASSES = [
  'DETERMINISTICALLY_VERIFIABLE',
  'SEMANTICALLY_ASSESSABLE',
  'HUMAN_REVIEW_REQUIRED',
  'UNVERIFIABLE_NON_CERTIFIABLE'
] as const;

export type ClaimClass = typeof CLAIM_CLASSES[number];
export type ClaimType =
  | 'permission'
  | 'schema'
  | 'precondition'
  | 'lineage'
  | 'unsupported_certainty'
  | 'contradiction'
  | 'ambiguity'
  | 'qualification_mismatch'
  | 'policy_exception'
  | 'conflicting_evidence'
  | 'authority_delegation'
  | 'universal_safety'
  | 'future_reliability'
  | 'complete_controllability';

export interface ClaimEvidence {
  permission_record?: 'present' | 'missing' | 'denied' | 'unknown';
  permission_valid?: boolean;
  authority_evidence?: boolean;
  schema_provenance?: boolean;
  provenance_valid?: boolean;
  rule_present?: boolean;
  deterministic_rule_present?: boolean;
  exception_requires_human?: boolean;
  confidence?: number;
  prior_tests_passed?: boolean;
  rationale_present?: boolean;
  permission_present?: boolean;
  required_field_present?: boolean;
  transition_valid?: boolean;
  duplicate_lineage?: boolean;
  semantic_assessment?: 'supported' | 'flagged';
  human_adjudication_available?: boolean;
}

export type VerificationMode = 'POSITIVE_EVIDENCE_REQUIRED' | 'ABSENCE_OF_VIOLATION_SUFFICIENT';

export interface ProofObligation {
  required_evidence: readonly string[];
  missing_evidence_outcome: 'NON_CERTIFIED' | 'REVIEW_REQUIRED';
  verification_mode: VerificationMode;
}

export interface VerifyClaim {
  claim_id: string;
  claim_text: string;
  claim_type: ClaimType;
  required_verifier_class: ClaimClass;
  evidence: ClaimEvidence;
  source: 'synthetic_fixture';
  synthetic: true;
  seed?: number;
  fixture_id: string;
  proof_obligation?: ProofObligation;
}

const deterministicTypes = new Set<ClaimType>(['permission', 'schema', 'precondition', 'lineage']);
const semanticTypes = new Set<ClaimType>(['unsupported_certainty', 'contradiction', 'ambiguity', 'qualification_mismatch']);
const humanTypes = new Set<ClaimType>(['policy_exception', 'conflicting_evidence', 'authority_delegation']);

export function taxonomyOracle(claim: VerifyClaim): ClaimClass {
  if (deterministicTypes.has(claim.claim_type)) return 'DETERMINISTICALLY_VERIFIABLE';
  if (claim.evidence.deterministic_rule_present === true && semanticTypes.has(claim.claim_type)) return 'DETERMINISTICALLY_VERIFIABLE';
  if (claim.evidence.deterministic_rule_present === true && humanTypes.has(claim.claim_type) && claim.evidence.exception_requires_human !== true) return 'DETERMINISTICALLY_VERIFIABLE';
  if (semanticTypes.has(claim.claim_type)) return 'SEMANTICALLY_ASSESSABLE';
  if (humanTypes.has(claim.claim_type)) return 'HUMAN_REVIEW_REQUIRED';
  return 'UNVERIFIABLE_NON_CERTIFIABLE';
}

export function taxonomyFingerprint(): string {
  return createHash('sha256').update(JSON.stringify({
    version: TAXONOMY_VERSION,
    deterministicTypes: [...deterministicTypes].sort(),
    semanticTypes: [...semanticTypes].sort(),
    humanTypes: [...humanTypes].sort(),
    nonCertifiableTypes: ['universal_safety', 'future_reliability', 'complete_controllability']
  }), 'utf8').digest('hex');
}