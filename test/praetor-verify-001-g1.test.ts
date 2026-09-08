import { describe, expect, it } from 'vitest';
import { evaluateClaim } from '../experiments/praetor_verify_001/evaluate.js';
import { G0_FIXTURES } from '../experiments/praetor_verify_001/fixtures.js';
import { calculateG1Metrics, evaluateG1Pairs, G1_PAIRS, pairInvariant, replayConsistentG1 } from '../experiments/praetor_verify_001/g1.js';

describe('PRAETOR-VERIFY-001 G1', () => {
  it('contains eight matched pairs with one controlled changed field', () => {
    expect(G1_PAIRS).toHaveLength(8);
    expect(G1_PAIRS.every(pair => pairInvariant(pair))).toBe(true);
    expect(new Set(G1_PAIRS.map(pair => pair.controlled_changed_field)).size).toBe(8);
  });

  it('changes outcomes at every preregistered capability boundary', () => {
    const records = evaluateG1Pairs();
    expect(records.every(record => record.invariant_passed)).toBe(true);
    expect(records.every(record => JSON.stringify(record.expected_transition) === JSON.stringify(record.observed_transition))).toBe(true);
  });

  it('satisfies bounded BTA, VOR, ACR, and ECA targets', () => {
    const records = evaluateG1Pairs();
    const metrics = calculateG1Metrics(records, G1_PAIRS);
    expect(metrics.total_pairs).toBe(8);
    expect(metrics.total_arms).toBe(16);
    expect(metrics.boundary_transition_accuracy).toBe(1);
    expect(metrics.verifier_overreach_rate).toBe(0);
    expect(metrics.abstention_correctness_rate).toBe(1);
    expect(metrics.eligible_certification_accuracy).toBe(1);
    expect(metrics.incorrect_rejection_rate).toBe(0);
    expect(metrics.incorrect_non_certification_rate).toBe(0);
    expect(metrics.human_escalation_accuracy).toBe(1);
    expect(metrics.proof_obligation_failure_count).toBe(6);
    expect(metrics.replay_consistency).toBe(true);
    expect(replayConsistentG1(G1_PAIRS, records)).toBe(true);
  });

  it('keeps explicit denial as rejection and unknown permission as non-certification', () => {
    const base = G1_PAIRS[0].arm_a;
    const denied = evaluateClaim({ ...base, evidence: { ...base.evidence, permission_record: 'denied' } });
    const unknown = evaluateClaim(G1_PAIRS[0].arm_b);
    expect(denied.observed_outcome).toBe('REJECTED');
    expect(unknown.observed_outcome).toBe('NON_CERTIFIED');
  });

  it('does not let semantic support become deterministic certification', () => {
    const semanticArm = G1_PAIRS[4].arm_b;
    const record = evaluateClaim(semanticArm, { attempted_verifier: 'AGENT_K', attempted_outcome: 'VERIFIED' });
    expect(record.claim_taxonomy).toBe('SEMANTICALLY_ASSESSABLE');
    expect(record.expected_outcome).toBe('SEMANTICALLY_SUPPORTED');
    expect(record.verifier_overreach).toBe(true);
  });

  it('does not let confidence, history, or rationale manufacture proof', () => {
    const claim = {
      ...G1_PAIRS[2].arm_b,
      evidence: {
        ...G1_PAIRS[2].arm_b.evidence,
        confidence: 1,
        prior_tests_passed: true,
        rationale_present: true
      }
    };
    const record = evaluateClaim(claim);
    expect(record.proof_obligation_satisfied).toBe(false);
    expect(record.observed_outcome).toBe('NON_CERTIFIED');
  });

  it('does not confuse no detected violation with positive proof', () => {
    const record = evaluateClaim(G1_PAIRS[7].arm_b);
    expect(record.proof_obligation_satisfied).toBe(false);
    expect(record.observed_outcome).toBe('NON_CERTIFIED');
  });

  it('emits deterministic failure signatures when a pair is perturbed incorrectly', () => {
    const brokenPair = { ...G1_PAIRS[0], arm_b: { ...G1_PAIRS[0].arm_b, claim_text: 'unintended change' } };
    const record = evaluateG1Pairs([brokenPair])[0];
    expect(record.invariant_passed).toBe(false);
    expect(record.failure_signatures).toContain('PAIR_INVARIANCE_FAILURE');
  });

  it('preserves all G0 fixtures and does not use observed output in the oracle', () => {
    expect(G0_FIXTURES).toHaveLength(16);
    const record = evaluateClaim(G1_PAIRS[0].arm_b, { attempted_verifier: 'AGENT_K', attempted_outcome: 'VERIFIED' });
    expect(record.expected_outcome).toBe('NON_CERTIFIED');
    expect(record.verifier_overreach).toBe(true);
  });
});