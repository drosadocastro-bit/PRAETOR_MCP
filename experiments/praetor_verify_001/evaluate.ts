import { createHash } from 'node:crypto';
import type { ClaimClass, ProofObligation, VerifyClaim } from './claimTaxonomy.js';
import { taxonomyFingerprint, taxonomyOracle } from './claimTaxonomy.js';
import { deterministicOracle, oracleFingerprint, proofObligationSatisfied } from './oracle.js';
import { REGISTRY_VERSION, registryFingerprint, verifierFor, type VerifierName } from './verifierRegistry.js';

export const EXPERIMENT_VERSION = 'praetor-verify-001-g1-v1';
export type VerifyOutcome = 'VERIFIED' | 'SEMANTICALLY_SUPPORTED' | 'SEMANTICALLY_FLAGGED' | 'REVIEW_REQUIRED' | 'NON_CERTIFIED' | 'REJECTED' | 'UNAVAILABLE';

export interface EvaluationOptions {
  attempted_verifier?: VerifierName;
  attempted_outcome?: VerifyOutcome;
  verifier_available?: boolean;
}

export interface EvaluationRecord {
  claim_id: string;
  claim_text: string;
  claim_taxonomy: ClaimClass;
  declared_verifier_class: ClaimClass;
  selected_verifier: VerifierName;
  verifier_capability_version: string;
  expected_outcome: VerifyOutcome;
  observed_outcome: VerifyOutcome;
  verifier_overreach: boolean;
  proof_obligation_satisfied: boolean;
  proof_obligation: ProofObligation | null;
  source_fixture: string;
  synthetic: true;
  seed: number | null;
  trace_id: string;
  configuration_fingerprint: string;
  registry_fingerprint: string;
  taxonomy_fingerprint: string;
  oracle_fingerprint: string;
}

export function validateClaim(claim: VerifyClaim): void {
  if (!claim.claim_id || !claim.claim_text || !claim.fixture_id) throw new Error('Claim provenance is required.');
  if (claim.source !== 'synthetic_fixture' || claim.synthetic !== true) throw new Error('Claim provenance is required and must identify a synthetic fixture.');
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function isCertification(outcome: VerifyOutcome): boolean {
  return outcome === 'VERIFIED';
}

export function evaluateClaim(claim: VerifyClaim, options: EvaluationOptions = {}): EvaluationRecord {
  validateClaim(claim);
  const claim_taxonomy = taxonomyOracle(claim);
  const verifier = verifierFor(claim_taxonomy);
  const expectation = deterministicOracle(claim);
  const selected_verifier = options.attempted_verifier ?? verifier.name;
  const observed_outcome = options.verifier_available === false
    ? 'UNAVAILABLE'
    : options.attempted_outcome ?? expectation.expected_outcome;
  const attemptedVerifierCapability = verifierFor(claim_taxonomy);
  const proof_obligation_satisfied = proofObligationSatisfied(claim);
  const verifier_overreach = isCertification(observed_outcome)
    && (expectation.expected_outcome !== 'VERIFIED' || selected_verifier !== attemptedVerifierCapability.name || !attemptedVerifierCapability.may_certify);
  const configuration_fingerprint = fingerprint({ version: EXPERIMENT_VERSION, registry: REGISTRY_VERSION, available: options.verifier_available !== false });
  const trace_id = fingerprint({ claim, claim_taxonomy, selected_verifier, observed_outcome, configuration_fingerprint }).slice(0, 24);

  return {
    claim_id: claim.claim_id,
    claim_text: claim.claim_text,
    claim_taxonomy,
    declared_verifier_class: claim.required_verifier_class,
    selected_verifier,
    verifier_capability_version: verifier.version,
    expected_outcome: expectation.expected_outcome,
    observed_outcome,
    verifier_overreach,
    proof_obligation_satisfied,
    proof_obligation: claim.proof_obligation ?? null,
    source_fixture: claim.fixture_id,
    synthetic: true,
    seed: claim.seed ?? null,
    trace_id,
    configuration_fingerprint,
    registry_fingerprint: registryFingerprint(),
    taxonomy_fingerprint: taxonomyFingerprint(),
    oracle_fingerprint: oracleFingerprint()
  };
}

export function evaluateClaims(claims: readonly VerifyClaim[]): EvaluationRecord[] {
  return claims.map(claim => evaluateClaim(claim));
}

export function calculateMetrics(records: readonly EvaluationRecord[], claims: readonly VerifyClaim[] = []) {
  const outsideAuthority = records.filter(record => record.claim_taxonomy !== 'DETERMINISTICALLY_VERIFIABLE' || record.selected_verifier !== 'AGENT_K');
  const overreachCount = records.filter(record => record.verifier_overreach).length;
  const byTaxonomy = Object.fromEntries((['DETERMINISTICALLY_VERIFIABLE', 'SEMANTICALLY_ASSESSABLE', 'HUMAN_REVIEW_REQUIRED', 'UNVERIFIABLE_NON_CERTIFIABLE'] as const).map(kind => [kind, records.filter(record => record.claim_taxonomy === kind).length]));
  return {
    total_claims: records.length,
    claims_by_taxonomy: byTaxonomy,
    correct_verifier_routing: records.filter(record => record.selected_verifier === verifierFor(record.claim_taxonomy).name).length,
    incorrect_verifier_routing: records.filter(record => record.selected_verifier !== verifierFor(record.claim_taxonomy).name).length,
    verifier_overreach_count: overreachCount,
    verifier_overreach_rate: outsideAuthority.length === 0 ? 0 : overreachCount / outsideAuthority.length,
    non_certification_accuracy: records.filter(record => record.claim_taxonomy === 'UNVERIFIABLE_NON_CERTIFIABLE' && record.observed_outcome === 'NON_CERTIFIED').length,
    human_escalation_accuracy: records.filter(record => record.claim_taxonomy === 'HUMAN_REVIEW_REQUIRED' && record.observed_outcome === 'REVIEW_REQUIRED').length,
    semantic_assessment_routing_accuracy: records.filter(record => record.claim_taxonomy === 'SEMANTICALLY_ASSESSABLE' && record.selected_verifier === 'SEMANTIC_JUDGE').length,
    deterministic_verification_accuracy: records.filter(record => record.claim_taxonomy === 'DETERMINISTICALLY_VERIFIABLE' && ['VERIFIED', 'REJECTED'].includes(record.observed_outcome)).length,
    unavailable_verifier_cases: records.filter(record => record.observed_outcome === 'UNAVAILABLE').length,
    replay_consistency: claims.length === records.length && records.every((record, index) => JSON.stringify(record) === JSON.stringify(evaluateClaim(claims[index])))
  };
}

export function replayConsistent(claims: readonly VerifyClaim[], records: readonly EvaluationRecord[]): boolean {
  return claims.length === records.length && records.every((record, index) => JSON.stringify(record) === JSON.stringify(evaluateClaim(claims[index])));
}

export function resultFingerprint(records: readonly EvaluationRecord[]): string {
  return fingerprint(records);
}