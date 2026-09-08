import { describe, expect, it } from 'vitest';
import { G0_FIXTURES } from '../experiments/praetor_verify_001/fixtures.js';
import { calculateMetrics, evaluateClaim, evaluateClaims, replayConsistent, validateClaim } from '../experiments/praetor_verify_001/evaluate.js';
import { taxonomyOracle } from '../experiments/praetor_verify_001/claimTaxonomy.js';
import { verifierFor } from '../experiments/praetor_verify_001/verifierRegistry.js';

describe('PRAETOR-VERIFY-001 G0', () => {
  it('routes the bounded fixture matrix to the independent taxonomy classes', () => {
    expect(G0_FIXTURES).toHaveLength(16);
    expect(new Set(G0_FIXTURES.map(taxonomyOracle))).toEqual(new Set([
      'DETERMINISTICALLY_VERIFIABLE',
      'SEMANTICALLY_ASSESSABLE',
      'HUMAN_REVIEW_REQUIRED',
      'UNVERIFIABLE_NON_CERTIFIABLE'
    ]));
  });

  it('keeps Agent K bounded to deterministic claims', () => {
    const semanticClaim = G0_FIXTURES[4];
    const record = evaluateClaim(semanticClaim, { attempted_verifier: 'AGENT_K', attempted_outcome: 'VERIFIED' });
    expect(record.claim_taxonomy).toBe('SEMANTICALLY_ASSESSABLE');
    expect(record.verifier_overreach).toBe(true);
  });

  it('keeps semantic assessment observational and unable to authorize', () => {
    const deterministicClaim = G0_FIXTURES[0];
    const record = evaluateClaim(deterministicClaim, { attempted_verifier: 'SEMANTIC_JUDGE', attempted_outcome: 'VERIFIED' });
    expect(record.verifier_overreach).toBe(true);
    expect(verifierFor('SEMANTICALLY_ASSESSABLE').may_certify).toBe(false);
  });

  it('returns explicit human review and non-certification states', () => {
    const human = evaluateClaim(G0_FIXTURES[8]);
    const nonCertifiable = evaluateClaim(G0_FIXTURES[11]);
    expect(human.observed_outcome).toBe('REVIEW_REQUIRED');
    expect(nonCertifiable.observed_outcome).toBe('NON_CERTIFIED');
    expect(nonCertifiable.observed_outcome).not.toBe('REJECTED');
  });

  it('does not treat a universal guarantee as verified because tests passed', () => {
    const record = evaluateClaim(G0_FIXTURES[14]);
    expect(record.expected_outcome).toBe('NON_CERTIFIED');
    expect(record.observed_outcome).toBe('NON_CERTIFIED');
  });

  it('preserves deterministic rejection without confusing it with non-certification', () => {
    const rejected = evaluateClaim(G0_FIXTURES[1]);
    const nonCertified = evaluateClaim(G0_FIXTURES[12]);
    expect(rejected.observed_outcome).toBe('REJECTED');
    expect(nonCertified.observed_outcome).toBe('NON_CERTIFIED');
  });

  it('fails closed when an eligible verifier is unavailable', () => {
    const record = evaluateClaim(G0_FIXTURES[0], { verifier_available: false });
    expect(record.observed_outcome).toBe('UNAVAILABLE');
    expect(record.observed_outcome).not.toBe('VERIFIED');
  });

  it('detects unauthorized certification and keeps the bounded rate measurable', () => {
    const records = [
      evaluateClaim(G0_FIXTURES[0]),
      evaluateClaim(G0_FIXTURES[11], { attempted_verifier: 'AGENT_K', attempted_outcome: 'VERIFIED' })
    ];
    const metrics = calculateMetrics(records);
    expect(metrics.verifier_overreach_count).toBe(1);
    expect(metrics.verifier_overreach_rate).toBe(1);
  });

  it('emits deterministic provenance and supports replay', () => {
    const records = evaluateClaims(G0_FIXTURES);
    expect(records.every(record => record.synthetic)).toBe(true);
    expect(records.every(record => record.registry_fingerprint.length === 64)).toBe(true);
    expect(records.every(record => record.taxonomy_fingerprint.length === 64)).toBe(true);
    expect(replayConsistent(G0_FIXTURES, records)).toBe(true);
    expect(calculateMetrics(records, G0_FIXTURES).replay_consistency).toBe(true);
  });

  it('rejects claims without synthetic provenance', () => {
    const claim = { ...G0_FIXTURES[0], source: 'untrusted' as never };
    expect(() => validateClaim(claim)).toThrow('Claim provenance is required');
  });

  it('does not trust a self-declared verifier class', () => {
    const claim = { ...G0_FIXTURES[11], required_verifier_class: 'DETERMINISTICALLY_VERIFIABLE' as const };
    const record = evaluateClaim(claim);
    expect(record.claim_taxonomy).toBe('UNVERIFIABLE_NON_CERTIFIABLE');
    expect(record.observed_outcome).toBe('NON_CERTIFIED');
  });

  it('records zero overreach for the bounded honest fixture run', () => {
    const records = evaluateClaims(G0_FIXTURES);
    const metrics = calculateMetrics(records, G0_FIXTURES);
    expect(metrics.verifier_overreach_count).toBe(0);
    expect(metrics.verifier_overreach_rate).toBe(0);
  });
});