import { createHash } from 'node:crypto';
import type { ClaimEvidence, VerifyClaim } from './claimTaxonomy.js';
import { evaluateClaim, type EvaluationRecord, type VerifyOutcome } from './evaluate.js';

export const G1_VERSION = 'praetor-verify-001-g1-v1';

export interface G1Pair {
  pair_id: string;
  arm_a: VerifyClaim;
  arm_b: VerifyClaim;
  controlled_changed_field: string;
  fields_required_to_remain_constant: readonly string[];
  expected_transition: readonly [VerifyOutcome, VerifyOutcome];
}

export interface G1PairRecord {
  experiment_id: string;
  pair_id: string;
  arm_a_id: string;
  arm_b_id: string;
  synthetic: true;
  arm_a_fingerprint: string;
  arm_b_fingerprint: string;
  changed_field: string;
  invariant_passed: boolean;
  expected_transition: readonly [VerifyOutcome, VerifyOutcome];
  observed_transition: readonly [VerifyOutcome, VerifyOutcome];
  arm_a: EvaluationRecord;
  arm_b: EvaluationRecord;
  failure_signatures: readonly string[];
}

const obligation = (required_evidence: readonly string[], missing_evidence_outcome: 'NON_CERTIFIED' | 'REVIEW_REQUIRED' = 'NON_CERTIFIED') => ({
  required_evidence,
  missing_evidence_outcome,
  verification_mode: 'POSITIVE_EVIDENCE_REQUIRED' as const
});

function claim(id: string, claim_type: VerifyClaim['claim_type'], claim_text: string, evidence: ClaimEvidence, proof_obligation = obligation([])): VerifyClaim {
  return {
    claim_id: id,
    claim_text,
    claim_type,
    required_verifier_class: 'DETERMINISTICALLY_VERIFIABLE',
    evidence,
    proof_obligation,
    source: 'synthetic_fixture',
    synthetic: true,
    fixture_id: `g1:${id}`
  };
}

export const G1_PAIRS: readonly G1Pair[] = [
  {
    pair_id: 'g1_permission_presence',
    arm_a: claim('g1_0001_a', 'permission', 'The requested tool call is permitted.', { permission_record: 'present', permission_valid: true }, obligation(['permission_record'])),
    arm_b: claim('g1_0001_b', 'permission', 'The requested tool call is permitted.', { permission_record: 'unknown', permission_valid: true }, obligation(['permission_record'])),
    controlled_changed_field: 'evidence.permission_record',
    fields_required_to_remain_constant: ['claim_text', 'claim_type', 'proof_obligation'],
    expected_transition: ['VERIFIED', 'NON_CERTIFIED']
  },
  {
    pair_id: 'g1_schema_provenance',
    arm_a: claim('g1_0002_a', 'schema', 'The required schema is available.', { schema_provenance: true, provenance_valid: true }, obligation(['schema_provenance'])),
    arm_b: claim('g1_0002_b', 'schema', 'The required schema is available.', { schema_provenance: false, provenance_valid: true }, obligation(['schema_provenance'])),
    controlled_changed_field: 'evidence.schema_provenance',
    fields_required_to_remain_constant: ['claim_text', 'claim_type', 'proof_obligation'],
    expected_transition: ['VERIFIED', 'NON_CERTIFIED']
  },
  {
    pair_id: 'g1_authority_evidence',
    arm_a: claim('g1_0003_a', 'precondition', 'The authority token is valid.', { authority_evidence: true }, obligation(['authority_evidence'])),
    arm_b: claim('g1_0003_b', 'precondition', 'The authority token is valid.', { authority_evidence: false }, obligation(['authority_evidence'])),
    controlled_changed_field: 'evidence.authority_evidence',
    fields_required_to_remain_constant: ['claim_text', 'claim_type', 'proof_obligation'],
    expected_transition: ['VERIFIED', 'NON_CERTIFIED']
  },
  {
    pair_id: 'g1_provenance_validity',
    arm_a: claim('g1_0004_a', 'lineage', 'The evidence lineage is valid.', { schema_provenance: true, provenance_valid: true }, obligation(['schema_provenance'])),
    arm_b: claim('g1_0004_b', 'lineage', 'The evidence lineage is valid.', { schema_provenance: true, provenance_valid: false }, obligation(['schema_provenance'])),
    controlled_changed_field: 'evidence.provenance_valid',
    fields_required_to_remain_constant: ['claim_text', 'claim_type', 'proof_obligation', 'evidence.schema_provenance'],
    expected_transition: ['VERIFIED', 'NON_CERTIFIED']
  },
  {
    pair_id: 'g1_semantic_boundary',
    arm_a: claim('g1_0005_a', 'contradiction', 'The claim is resolved by an explicit deterministic rule.', { deterministic_rule_present: true, semantic_assessment: 'supported' }, obligation(['deterministic_rule_present'])),
    arm_b: claim('g1_0005_b', 'contradiction', 'The claim is resolved by an explicit deterministic rule.', { deterministic_rule_present: false, semantic_assessment: 'supported' }, obligation(['deterministic_rule_present'])),
    controlled_changed_field: 'evidence.deterministic_rule_present',
    fields_required_to_remain_constant: ['claim_text', 'claim_type', 'proof_obligation', 'evidence.semantic_assessment'],
    expected_transition: ['VERIFIED', 'SEMANTICALLY_SUPPORTED']
  },
  {
    pair_id: 'g1_human_discretion',
    arm_a: claim('g1_0006_a', 'policy_exception', 'The policy exception is resolved by an explicit rule.', { deterministic_rule_present: true, exception_requires_human: false }, obligation(['deterministic_rule_present'])),
    arm_b: claim('g1_0006_b', 'policy_exception', 'The policy exception is resolved by an explicit rule.', { deterministic_rule_present: true, exception_requires_human: true }, obligation(['deterministic_rule_present'])),
    controlled_changed_field: 'evidence.exception_requires_human',
    fields_required_to_remain_constant: ['claim_type', 'evidence.deterministic_rule_present'],
    expected_transition: ['VERIFIED', 'REVIEW_REQUIRED']
  },
  {
    pair_id: 'g1_positive_vs_negative',
    arm_a: claim('g1_0007_a', 'precondition', 'The transition is valid.', { authority_evidence: true, transition_valid: true }, obligation(['authority_evidence'])),
    arm_b: claim('g1_0007_b', 'precondition', 'The transition is valid.', { authority_evidence: true, transition_valid: false }, obligation(['authority_evidence'])),
    controlled_changed_field: 'evidence.transition_valid',
    fields_required_to_remain_constant: ['claim_text', 'claim_type', 'proof_obligation', 'evidence.authority_evidence'],
    expected_transition: ['VERIFIED', 'REJECTED']
  },
  {
    pair_id: 'g1_no_violation_vs_positive_proof',
    arm_a: claim('g1_0008_a', 'precondition', 'The required precondition is established.', { rule_present: true }, obligation(['rule_present'])),
    arm_b: claim('g1_0008_b', 'precondition', 'The required precondition is established.', { rule_present: false }, obligation(['rule_present'])),
    controlled_changed_field: 'evidence.rule_present',
    fields_required_to_remain_constant: ['claim_text', 'claim_type', 'proof_obligation'],
    expected_transition: ['VERIFIED', 'NON_CERTIFIED']
  }
];

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function canonicalArm(claimValue: VerifyClaim, controlledChangedField: string): unknown {
  const copy = JSON.parse(JSON.stringify(claimValue)) as VerifyClaim;
  const { claim_id: _claimId, fixture_id: _fixtureId, ...canonical } = copy;
  const evidenceField = controlledChangedField.replace('evidence.', '') as keyof ClaimEvidence;
  delete canonical.evidence[evidenceField];
  return canonical;
}

export function pairInvariant(pair: G1Pair): boolean {
  return JSON.stringify(canonicalArm(pair.arm_a, pair.controlled_changed_field)) === JSON.stringify(canonicalArm(pair.arm_b, pair.controlled_changed_field));
}

export function evaluateG1Pair(pair: G1Pair): G1PairRecord {
  const arm_a = evaluateClaim(pair.arm_a);
  const arm_b = evaluateClaim(pair.arm_b);
  const invariant_passed = pairInvariant(pair);
  const transitionMatches = JSON.stringify(pair.expected_transition) === JSON.stringify([arm_a.observed_outcome, arm_b.observed_outcome]);
  const failure_signatures = [
    ...(invariant_passed ? [] : ['PAIR_INVARIANCE_FAILURE']),
    ...(arm_a.verifier_overreach || arm_b.verifier_overreach ? ['OVERREACH_MISSING_PROOF'] : []),
    ...(transitionMatches ? [] : ['BOUNDARY_TRANSITION_FAILURE'])
  ];
  return {
    experiment_id: G1_VERSION,
    pair_id: pair.pair_id,
    arm_a_id: pair.arm_a.claim_id,
    arm_b_id: pair.arm_b.claim_id,
    synthetic: true,
    arm_a_fingerprint: fingerprint(pair.arm_a),
    arm_b_fingerprint: fingerprint(pair.arm_b),
    changed_field: pair.controlled_changed_field,
    invariant_passed,
    expected_transition: pair.expected_transition,
    observed_transition: [arm_a.observed_outcome, arm_b.observed_outcome],
    arm_a,
    arm_b,
    failure_signatures
  };
}

export function evaluateG1Pairs(pairs: readonly G1Pair[] = G1_PAIRS): G1PairRecord[] {
  return pairs.map(evaluateG1Pair);
}

export function replayConsistentG1(pairs: readonly G1Pair[], records: readonly G1PairRecord[]): boolean {
  return pairs.length === records.length && pairs.every((pair, index) => JSON.stringify(evaluateG1Pair(pair)) === JSON.stringify(records[index]));
}

export function calculateG1Metrics(records: readonly G1PairRecord[], pairs: readonly G1Pair[] = G1_PAIRS) {
  const arms = records.flatMap(record => [record.arm_a, record.arm_b]);
  const abstentionExpected = arms.filter(record => record.expected_outcome === 'NON_CERTIFIED' || record.expected_outcome === 'REVIEW_REQUIRED');
  const eligibleCertification = arms.filter(record => record.expected_outcome === 'VERIFIED');
  const expectedRejects = arms.filter(record => record.expected_outcome === 'REJECTED');
  const transitionCorrect = records.filter(record => JSON.stringify(record.expected_transition) === JSON.stringify(record.observed_transition)).length;
  return {
    total_pairs: records.length,
    total_arms: arms.length,
    boundary_transition_accuracy: records.length === 0 ? 0 : transitionCorrect / records.length,
    verifier_overreach_rate: arms.length === 0 ? 0 : arms.filter(record => record.verifier_overreach).length / arms.length,
    abstention_correctness_rate: abstentionExpected.length === 0 ? 0 : abstentionExpected.filter(record => record.observed_outcome === record.expected_outcome).length / abstentionExpected.length,
    eligible_certification_accuracy: eligibleCertification.length === 0 ? 0 : eligibleCertification.filter(record => record.observed_outcome === 'VERIFIED').length / eligibleCertification.length,
    incorrect_rejection_rate: arms.length === 0 ? 0 : expectedRejects.filter(record => record.observed_outcome !== 'REJECTED').length / Math.max(1, expectedRejects.length),
    incorrect_non_certification_rate: arms.length === 0 ? 0 : arms.filter(record => record.expected_outcome === 'VERIFIED' && record.observed_outcome === 'NON_CERTIFIED').length / Math.max(1, eligibleCertification.length),
    human_escalation_accuracy: arms.filter(record => record.expected_outcome === 'REVIEW_REQUIRED').length === 0 ? 0 : arms.filter(record => record.expected_outcome === 'REVIEW_REQUIRED' && record.observed_outcome === 'REVIEW_REQUIRED').length / arms.filter(record => record.expected_outcome === 'REVIEW_REQUIRED').length,
    misrouting_rate: arms.length === 0 ? 0 : arms.filter(record => record.selected_verifier !== (record.claim_taxonomy === 'DETERMINISTICALLY_VERIFIABLE' ? 'AGENT_K' : record.claim_taxonomy === 'SEMANTICALLY_ASSESSABLE' ? 'SEMANTIC_JUDGE' : record.claim_taxonomy === 'HUMAN_REVIEW_REQUIRED' ? 'HUMAN_REVIEW' : 'NO_AUTOMATED_VERIFIER')).length / arms.length,
    proof_obligation_failure_count: arms.filter(record => !record.proof_obligation_satisfied).length,
    replay_consistency: records.every(record => record.invariant_passed && record.arm_a_fingerprint.length === 64 && record.arm_b_fingerprint.length === 64) && replayConsistentG1(pairs, records)
  };
}