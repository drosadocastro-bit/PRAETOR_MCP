import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../experiments/praetor_verify_001/g3b/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8')) as Record<string, any>;

describe('G3B full non-holdout revalidation artifact', () => {
  it('records the adaptive execution gap without granting authority', () => {
    const revalidation = read('G3B_FULL_NON_HOLDOUT_REVALIDATION.json');

    expect(revalidation.final_revalidation_disposition).toBe('INCONCLUSIVE');
    expect(revalidation.full_non_holdout_revalidation).toBe('INCONCLUSIVE');
    expect(revalidation.execution_basis_validated).toBe(false);
    expect(revalidation.effective_execution_authorized_for_new_basis).toBe(false);
    expect(revalidation.reauthorization_required).toBe(true);
    expect(revalidation.gate_results.gate_1_executable_runner.adaptive).toBe('NOT_ESTABLISHED');
    expect(revalidation.arm_validation.adaptive.end_to_end_fixture_execution).toBe('NOT_ESTABLISHED');
    expect(revalidation.holdout_state).toMatchObject({
      holdout_access_status: 'NOT_ACCESSED',
      holdout_evaluated: false,
      execution_performed: false,
      comparative_observations: 0,
      authorized_holdout_study_executed: false,
      new_human_execution_authorization_created: false
    });
  });
});