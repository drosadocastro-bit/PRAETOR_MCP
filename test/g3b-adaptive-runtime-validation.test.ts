import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../experiments/praetor_verify_001/g3b/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8')) as Record<string, any>;

describe('G3B adaptive runtime validation artifact', () => {
  it('freezes non-holdout implementation without granting effective execution', () => {
    const validation = read('G3B_ADAPTIVE_RUNTIME_VALIDATION.json');
    expect(validation.status).toBe('NON_HOLDOUT_VALIDATION_PASS');
    expect(validation.approved_design).toBe('DIRECT_CANDIDATE_ID_FINITE_STATE');
    expect(validation.implementation_commit).toBe('3773a003585ce1085f1eb6bba87cda2aa3d8b84d');
    expect(validation.non_holdout_validation).toBe('PASS');
    expect(validation.effective_execution_authorized_for_new_basis).toBe(false);
    expect(validation.adaptive_runtime_implemented).toBe(true);
    expect(validation.holdout_access_status).toBe('NOT_ACCESSED');
    expect(validation.holdout_evaluated).toBe(false);
    expect(validation.execution_performed).toBe(false);
    expect(validation.comparative_observations).toBe(0);
    expect(validation.full_revalidation_started).toBe(false);
    expect(validation.holdout_state).toMatchObject({
      holdout_access_status: 'NOT_ACCESSED',
      holdout_evaluated: false,
      comparative_observations: 0,
      execution_performed: false,
      adaptive_runtime_implemented: true,
      full_revalidation_started: false,
      comparative_g3b_executed: false
    });
    expect(validation.freeze.basis_frozen).toBe(true);
    expect(validation.freeze.full_g3b_readiness).toBe(false);
  });
});
