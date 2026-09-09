import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertHoldoutRemainsUntouched, runG3BRuntimePrevalidation } from '../experiments/praetor_verify_001/g3b/prevalidation.js';

describe('G3B runtime prevalidation', () => {
  it('observes all comparative gates without changing the frozen execution boundary', () => {
    const artifact = runG3BRuntimePrevalidation();
    expect(artifact.runtime_prevalidation).toBe('PASS');
    expect(artifact.eligibility).toBe('ELIGIBLE_FOR_HUMAN_EXECUTION_DECISION');
    expect(artifact.gates.gate_1_executable_runner.status).toBe('PASS');
    expect(artifact.gates.gate_2_provenance_contract.status).toBe('PASS');
    expect(artifact.gates.gate_3_replay_precheck.status).toBe('PASS');
    expect(artifact.gates.gate_4_oracle_feedback_isolation.status).toBe('PASS');
    expect(artifact.gates.gate_5_baseline_parity.status).toBe('PASS');
    expect(artifact.gates.gate_6_executable_stopping_rules.status).toBe('PASS');
    expect(artifact.holdout_access_status).toBe('NOT_ACCESSED');
    expect(artifact.holdout_evaluated).toBe(false);
    expect(artifact.execution_performed).toBe(false);
    expect(artifact.comparative_observations).toBe(0);
    expect(artifact.human_authorization).toBe(false);
  });

  it('preserves the frozen G3B state and does not create results', () => {
    assertHoldoutRemainsUntouched();
    const manifest = JSON.parse(readFileSync(new URL('../experiments/praetor_verify_001/g3b/G3B_PRE_EXECUTION_MANIFEST.json', import.meta.url), 'utf8')) as { holdout_evaluated: boolean; g3b_comparative_observations: number; execution_ready: boolean };
    expect(manifest).toMatchObject({ holdout_evaluated: false, g3b_comparative_observations: 0, execution_ready: false });
  });
});
