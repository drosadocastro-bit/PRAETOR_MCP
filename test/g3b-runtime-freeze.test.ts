import { describe, expect, it } from 'vitest';
import { adaptiveCandidate, executeNonHoldoutValidation, runtimeManifest } from '../experiments/praetor_verify_001/g3b/runtime.js';

describe('G3B executable runtime freeze', () => {
  it('executes only non-holdout validation for frozen non-adaptive arms', () => {
    const observation = executeNonHoldoutValidation('random', 'G3-observable', 0, 0, 'test-commit');
    expect(observation.validity).toBe('VALIDATION_ONLY');
    expect(observation.provenance.holdout_access).toBe(false);
    expect(observation.provenance.oracle_feedback_exposed).toBe(false);
    expect(observation.failure_signatures).toEqual([]);
  });

  it('replays deterministic input, configuration, and oracle output', () => {
    const first = executeNonHoldoutValidation('rule_based', 'G3-white-box', 1, 3, 'test-commit');
    const second = executeNonHoldoutValidation('rule_based', 'G3-white-box', 1, 3, 'test-commit');
    expect(second.input_hash).toBe(first.input_hash);
    expect(second.configuration_hash).toBe(first.configuration_hash);
    expect(second.oracle_output).toEqual(first.oracle_output);
  });

  it('blocks adaptive execution until action semantics receive human review', () => {
    expect(() => adaptiveCandidate()).toThrow('G3B_RUNTIME_REAUTHORIZATION_REQUIRED');
    expect(runtimeManifest().execution_review_status).toBe('REAUTHORIZATION_REQUIRED');
    expect(runtimeManifest().arms.adaptive).toContain('BLOCKED');
  });

  it('declares zero G3B comparative observations', () => {
    const manifest = runtimeManifest();
    expect(manifest.holdout_evaluated).toBe(false);
    expect(manifest.g3b_comparative_observations).toBe(0);
  });
});
