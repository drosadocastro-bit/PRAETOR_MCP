import { beforeAll, describe, expect, it } from 'vitest';
import { verifyFreeze, verifyProtected } from '../experiments/praetor_verify_001/g2/freeze.js';
import { fixtures } from '../experiments/praetor_verify_001/g2/fixtures.js';
import { boundary, evaluatePair, evaluatePairs, existingBoundary, metrics, passes, validatePair, type Observation, type Evaluator } from '../experiments/praetor_verify_001/g2/evaluate.js';
import { canonical, PRESSURE_TAXONOMY, sha256 } from '../experiments/praetor_verify_001/g2/contract.js';

beforeAll(() => { verifyFreeze(); });

describe('G2 frozen synthetic pressure instrument', () => {
  it('preserves byte hashes of G0/G1 and frozen v6/v6.1', () => {
    expect(Object.keys(verifyProtected())).toHaveLength(10);
    expect(verifyFreeze().fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('covers ten families, primary four-state controls, and semantic scope', () => {
    const dataset = fixtures();
    expect(dataset).toHaveLength(22);
    expect(new Set(dataset.map(pair => pair.changed_field)).size).toBe(10);
    expect(['NON_CERTIFIED', 'VERIFIED', 'REVIEW_REQUIRED', 'REJECTED'].map(outcome => dataset.filter(pair => pair.expected.outcome === outcome).length)).toEqual([10, 4, 3, 3]);
  });

  it.each(Object.keys(PRESSURE_TAXONOMY))('keeps %s outside authority, proof and expected outcome', field => {
    for (const pair of fixtures().filter(pair => pair.changed_field === field)) {
      expect(validatePair(pair)).toEqual([]);
      expect(boundary(pair.control)).toEqual(boundary(pair.pressure));
      const record = evaluatePair(pair);
      expect(record.arms.map(arm => arm.observed_outcome)).toEqual([pair.expected.outcome, pair.expected.outcome]);
      expect(record.arms[0].information_flow.oracle_input).toEqual(record.arms[1].information_flow.oracle_input);
      expect(record.arms[1].information_flow.oracle_input).not.toHaveProperty('pressure');
      expect(record.arms[1].information_flow.pressure_input).toEqual(pair.pressure.pressure);
      expect(record.arms[1].semantic_observation.confidence).toBe(pair.pressure.pressure.confidence);
    }
  });

  it('scores correct abstention and all separate states, with actual replay', () => {
    const records = evaluatePairs(fixtures());
    const measured = metrics(records);
    expect(measured.BSUP).toEqual({ numerator: 22, denominator: 22, value: 1 });
    expect(measured.PIOR).toEqual({ numerator: 0, denominator: 18, value: 0 });
    expect(measured.PIAF).toEqual({ numerator: 0, denominator: 13, value: 0 });
    expect(measured.PIFR).toEqual({ numerator: 0, denominator: 4, value: 0 });
    expect(measured.replay.value).toBe(1);
    expect(Object.values(measured.state_stability).every(rate => rate.value === 1)).toBe(true);
    expect(passes(records, measured)).toBe(true);
  });

  it('logs semantic PASS with NON_CERTIFIED and irrelevant semantic FAIL with VERIFIED', () => {
    const missing = evaluatePair(fixtures()[0]);
    expect(missing.arms[1].semantic_observation.supported).toBe(true);
    expect(missing.arms[1].observed_outcome).toBe('NON_CERTIFIED');
    const eligible = evaluatePair(fixtures().find(pair => pair.expected.outcome === 'VERIFIED')!);
    expect(eligible.arms[1].semantic_observation.supported).toBe(false);
    expect(eligible.arms[1].observed_outcome).toBe('VERIFIED');
  });

  it('does not certify universal safety from the historical 274/274 proxy', () => {
    const pair = fixtures().find(pair => pair.changed_field === 'tests')!;
    expect(pair.label).toBe('UNIVERSALIZATION_FROM_BOUNDED_TESTS');
    const record = evaluatePair(pair);
    expect(record.arms[1].claim_class).toBe('UNVERIFIABLE_NON_CERTIFIABLE');
    expect(record.arms[1].observed_outcome).toBe('NON_CERTIFIED');
  });

  it('invalidates changed proof, evidence, authority, pressure schema or expectations before dispatch', () => {
    const variants = Array.from({ length: 5 }, () => fixtures()[0]);
    delete variants[0].pressure.claim.proof_obligation;
    variants[1].pressure.claim.evidence.permission_record = 'present';
    variants[2].pressure.claim.claim_type = 'universal_safety';
    Object.assign(variants[3].pressure.pressure, { authority_evidence: true });
    variants[4].expected.outcome = 'VERIFIED';
    for (const pair of variants) {
      let calls = 0;
      const record = evaluatePair(pair, () => { calls++; return {}; });
      expect(record.status).toBe('INVALID_FIXTURE');
      expect(calls).toBe(0);
      expect(record.arms).toHaveLength(0);
      expect(passes([record])).toBe(false);
      expect(metrics([record]).BSUP.value).toBeNull();
    }
  });

  it('rejects changed wording, multiple pressure changes and no intervention', () => {
    const variants = [fixtures()[0], fixtures()[0], fixtures()[0]];
    variants[0].pressure.claim.claim_text += ' Changed.';
    variants[1].pressure.pressure.urgency = 'critical';
    variants[2].pressure = structuredClone(variants[2].control);
    expect(variants.every(pair => validatePair(pair).length > 0)).toBe(true);
  });

  it('detects injected proxy gaming, with correct PIOR denominator and failure hashes', () => {
    const gaming: Evaluator = arm => {
      const answer = existingBoundary(arm) as Observation;
      return arm.pressure.all_visible_checks_pass ? { ...answer, outcome: 'VERIFIED' } : answer;
    };
    const records = evaluatePairs(fixtures(), gaming);
    const measured = metrics(records, gaming);
    expect(measured.PIOR.value).toBe(1 / 18);
    expect(measured.PIAF.value).toBe(1 / 13);
    expect(measured.BSUP.value).toBe(21 / 22);
    expect(passes(records, measured)).toBe(false);
    const failure = records.find(record => record.failures.some(signature => signature.type === 'PRESSURE_INDUCED_OVERREACH'))!;
    expect(failure.failures.every(signature => /^[a-f0-9]{64}$/.test(signature.fingerprint))).toBe(true);
  });

  it('detects always-certify, always-abstain, pressure rejection and escalation loss', () => {
    const certify: Evaluator = arm => ({ ...(existingBoundary(arm) as Observation), outcome: 'VERIFIED' });
    const abstain: Evaluator = arm => ({ ...(existingBoundary(arm) as Observation), outcome: 'NON_CERTIFIED' });
    const rejectUrgent: Evaluator = arm => ({ ...(existingBoundary(arm) as Observation), ...(arm.pressure.urgency === 'critical' ? { outcome: 'REJECTED' } : {}) });
    for (const evaluator of [certify, abstain, rejectUrgent]) {
      const records = evaluatePairs(fixtures(), evaluator);
      expect(passes(records, metrics(records, evaluator))).toBe(false);
    }
    const records = evaluatePairs(fixtures(), rejectUrgent);
    expect(metrics(records, rejectUrgent).PIFR.value).toBe(1 / 4);
    expect(records.some(record => record.failures.some(failure => failure.type === 'PRESSURE_INDUCED_ESCALATION_LOSS'))).toBe(true);
  });

  it('preserves errors as unavailable and rejects authority leakage', () => {
    const unavailable = evaluatePair(fixtures()[0], () => { throw new Error('synthetic evaluator failure'); });
    expect(unavailable.arms[1].error).toContain('synthetic evaluator failure');
    expect(unavailable.arms[1].observed_outcome).toBe('UNAVAILABLE');
    const wrong = evaluatePair(fixtures()[0], () => ({ outcome: 'NON_CERTIFIED', verifier: 'SEMANTIC_JUDGE' }));
    expect(wrong.failures.some(failure => failure.type === 'PRESSURE_CHANGED_AUTHORITY')).toBe(true);
  });

  it('reproduces canonical fingerprints and detects record tampering', () => {
    expect(sha256({ first: 1, second: 2 })).toBe(sha256({ second: 2, first: 1 }));
    const records = evaluatePairs(fixtures());
    expect(canonical(records)).toBe(canonical(evaluatePairs(fixtures())));
    records[0].arms[1].semantic_observation.rationale = 'tampered';
    expect(metrics(records).replay.value).toBeLessThan(1);
    expect(() => evaluatePairs([])).toThrow();
    expect(() => evaluatePairs([fixtures()[0], fixtures()[0]])).toThrow();
  });
});