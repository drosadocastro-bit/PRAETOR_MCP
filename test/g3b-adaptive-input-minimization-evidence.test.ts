import { describe, expect, it } from 'vitest';
import { adjudicateG3B } from '../experiments/praetor_verify_001/g3b/oracle.js';
import { mapFailure } from '../experiments/praetor_verify_001/g3b/failure-mapping.js';
import { randomCandidate, type G3BCandidate } from '../experiments/praetor_verify_001/g3b/runtime.js';

type UnusedField = 'source_id' | 'review_present' | 'proxy_checks_pass' | 'semantic_confidence' | 'historical_success' | 'semantic_consensus' | 'source_reputation' | 'urgency';

const unusedValues: Record<UnusedField, readonly unknown[]> = {
  source_id: ['synthetic-a', 'synthetic-b'],
  review_present: [false, true],
  proxy_checks_pass: [false, true],
  semantic_confidence: [0, 0.5, 1],
  historical_success: [0, 0.5, 1],
  semantic_consensus: [0, 10, 20],
  source_reputation: ['unspecified', 'high'],
  urgency: ['normal', 'critical']
};

const baseFor = (claim_family: G3BCandidate['claim_family']): G3BCandidate => ({
  ...randomCandidate(17, 0),
  claim_family,
  claim_universality: claim_family === 'universal' ? 'universal' : 'bounded',
  proof_available: true,
  proof_supports_claim: true,
  provenance_complete: true,
  authority_present: true,
  authority_valid: true,
  duplicate_lineage: false,
  schema_valid: true,
  tool_permission: 'granted',
  requested_tool: 'synthetic_read',
  record_tool: 'synthetic_read',
  requested_action: 'review',
  record_action: 'review'
});

const result = (candidate: G3BCandidate) => {
  const output = adjudicateG3B(candidate);
  return {
    verifier: output.verifier,
    disposition: output.disposition,
    failure_mapping: mapFailure(candidate, output, output),
    validation_disposition: 'VALIDATION_ONLY',
    stopping_behavior: 'CONTINUE_PERMITTED_VALIDATION_ONLY'
  };
};

describe('G3B adaptive input minimization evidence', () => {
  it('shows no evaluator influence for every currently unused field value', () => {
    for (const claim_family of ['universal', 'human', 'semantic', 'permission'] as const) {
      const baseline = baseFor(claim_family);
      const expected = result(baseline);
      for (const field of Object.keys(unusedValues) as UnusedField[]) {
        for (const value of unusedValues[field]) {
          const mutated = { ...baseline, [field]: value } as G3BCandidate;
          expect(result(mutated), `${claim_family}.${field}=${String(value)}`).toEqual(expected);
        }
      }
    }
  });

  it('shows controlled influence for semantic and conditional permission fields', () => {
    const semantic = baseFor('semantic');
    expect(result({ ...semantic, claim_family: 'human', claim_universality: 'bounded' })).not.toEqual(result(semantic));
    expect(result({ ...semantic, provenance_complete: false })).not.toEqual(result(semantic));
    expect(result({ ...semantic, proof_available: false, proof_supports_claim: false })).not.toEqual(result(semantic));
    expect(result({ ...semantic, contradiction_score: 1 })).not.toEqual(result(semantic));

    const permission = baseFor('permission');
    const perturbations: G3BCandidate[] = [
      { ...permission, requested_tool: 'synthetic_inspect' },
      { ...permission, requested_action: 'review' },
      { ...permission, record_tool: 'synthetic_inspect' },
      { ...permission, record_action: 'review' },
      { ...permission, authority_present: false, authority_valid: false },
      { ...permission, authority_valid: false },
      { ...permission, duplicate_lineage: true },
      { ...permission, tool_permission: 'denied' }
    ];
    expect(result(perturbations[0]!)).not.toEqual(result(permission));
    expect(result(perturbations[1]!)).toEqual(result(permission));
    expect(result(perturbations[2]!)).not.toEqual(result(permission));
    expect(result(perturbations[3]!)).toEqual(result(permission));
    for (const perturbation of perturbations.slice(4)) expect(result(perturbation)).not.toEqual(result(permission));
  });

  it('confirms conditional permission fields do not affect non-permission branches', () => {
    for (const claim_family of ['universal', 'human', 'semantic'] as const) {
      const baseline = baseFor(claim_family);
      const mutated: G3BCandidate = { ...baseline, requested_tool: 'synthetic_inspect', record_tool: 'synthetic_inspect', authority_present: false, authority_valid: false, duplicate_lineage: true, tool_permission: 'denied' };
      expect(result(mutated)).toEqual(result(baseline));
    }
  });

  it('records validation-only fields as unchanged semantic inputs without removing them', () => {
    const candidate = baseFor('permission');
    expect(candidate.partition).toBe('G3B_STRUCTURED_CANDIDATE');
    expect(candidate.synthetic).toBe(true);
    expect(candidate.claim_universality).toBe('bounded');
  });
});
