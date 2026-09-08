import { createHash } from 'node:crypto';
import type { ClaimClass, ProofObligation, VerifyClaim } from './claimTaxonomy.js';
import { taxonomyFingerprint, taxonomyOracle, TAXONOMY_VERSION } from './claimTaxonomy.js';

export const ORACLE_VERSION = 'praetor-verify-001-oracle-v1';

export interface OracleExpectation {
  expected_verifier_class: ClaimClass;
  expected_outcome: 'VERIFIED' | 'SEMANTICALLY_SUPPORTED' | 'SEMANTICALLY_FLAGGED' | 'REVIEW_REQUIRED' | 'NON_CERTIFIED' | 'REJECTED';
}

function evidenceValue(claim: VerifyClaim, key: string): boolean {
  const value = claim.evidence[key as keyof VerifyClaim['evidence']];
  if (key === 'permission_record') return value === 'present' && claim.evidence.permission_valid !== false;
  if (key === 'schema_provenance') return value === true && claim.evidence.provenance_valid !== false;
  return value === true;
}

export function proofObligationSatisfied(claim: VerifyClaim, obligation: ProofObligation | undefined = claim.proof_obligation): boolean {
  return !obligation || obligation.required_evidence.every(key => evidenceValue(claim, key));
}

export function deterministicOracle(claim: VerifyClaim): OracleExpectation {
  const expected_verifier_class = taxonomyOracle(claim);
  if (expected_verifier_class === 'UNVERIFIABLE_NON_CERTIFIABLE') return { expected_verifier_class, expected_outcome: 'NON_CERTIFIED' };
  if (expected_verifier_class === 'HUMAN_REVIEW_REQUIRED') return { expected_verifier_class, expected_outcome: 'REVIEW_REQUIRED' };
  if (expected_verifier_class === 'SEMANTICALLY_ASSESSABLE') {
    return {
      expected_verifier_class,
      expected_outcome: claim.evidence.semantic_assessment === 'flagged' ? 'SEMANTICALLY_FLAGGED' : 'SEMANTICALLY_SUPPORTED'
    };
  }

  if (claim.evidence.permission_record === 'denied' || claim.evidence.permission_present === false || claim.evidence.duplicate_lineage === true || claim.evidence.transition_valid === false) {
    return { expected_verifier_class, expected_outcome: 'REJECTED' };
  }
  if (!proofObligationSatisfied(claim)) return { expected_verifier_class, expected_outcome: claim.proof_obligation?.missing_evidence_outcome ?? 'NON_CERTIFIED' };

  const deterministicPass = (claim.evidence.permission_present ?? true)
    && (claim.evidence.required_field_present ?? true)
    && (claim.evidence.transition_valid ?? true)
    && !(claim.evidence.duplicate_lineage ?? false);
  return { expected_verifier_class, expected_outcome: deterministicPass ? 'VERIFIED' : 'REJECTED' };
}

export function oracleFingerprint(): string {
  return createHash('sha256').update(JSON.stringify({
    version: ORACLE_VERSION,
    taxonomy_version: TAXONOMY_VERSION,
    taxonomy_fingerprint: taxonomyFingerprint(),
    outcomes: ['VERIFIED', 'SEMANTICALLY_SUPPORTED', 'SEMANTICALLY_FLAGGED', 'REVIEW_REQUIRED', 'NON_CERTIFIED', 'REJECTED']
  }), 'utf8').digest('hex');
}