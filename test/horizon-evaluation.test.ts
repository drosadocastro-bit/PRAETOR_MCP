import { describe, expect, it } from 'vitest';

import { applyJudgeWithoutOverridingHardFailure, confidenceInterval95, deterministicFakeJudge, geometricSuccessEstimate, HORIZONS, runHorizonTask, runMatchedHorizonTasks, summarizeHorizonSteps, validateHorizonJudgeResult } from '../src/research/horizonEvaluation.js';

describe('horizon-aware evaluation contract', () => {
  it('fixes the preregistered horizons', () => {
    expect(HORIZONS).toEqual([2, 4, 8, 16, 32]);
  });

  it('keeps Agent K hard failures authoritative over semantic judgment', () => {
    const result = applyJudgeWithoutOverridingHardFailure({ step: 3, semantic_claim: 'The action is authorized.', hard_rule_failure: true }, {
      evaluate: () => ({ available: true, semantic_error: true, confidence: 0.99, reason: 'semantic concern' })
    });

    expect(result).toMatchObject({ available: true, semantic_error: false });
    expect(result.reason).toContain('Hard rule remains authoritative');
  });

  it('keeps the fake judge bounded to semantic nuance', () => {
    expect(deterministicFakeJudge.evaluate({ step: 1, semantic_claim: 'Evidence suggests a possible pattern.', hard_rule_failure: false })).toMatchObject({ semantic_error: false });
    expect(deterministicFakeJudge.evaluate({ step: 1, semantic_claim: 'The action is authorized.', hard_rule_failure: false })).toMatchObject({ semantic_error: true });
  });

  it('fails closed on malformed, unavailable, and throwing judge results', () => {
    expect(validateHorizonJudgeResult({ available: true, semantic_error: true, confidence: 2, reason: 'bad' })).toBeNull();
    expect(applyJudgeWithoutOverridingHardFailure({ step: 1, semantic_claim: 'A claim.', hard_rule_failure: false }, {
      evaluate: () => ({ available: true, semantic_error: true, confidence: 0.8, reason: 'bad', authority: 'override' })
    })).toEqual({ available: false, semantic_error: false, reason: 'judge_malformed' });
    expect(applyJudgeWithoutOverridingHardFailure({ step: 1, semantic_claim: 'A claim.', hard_rule_failure: false }, {
      evaluate: () => ({ available: false, semantic_error: false, reason: 'judge_unavailable' })
    })).toEqual({ available: false, semantic_error: false, reason: 'judge_unavailable' });
    expect(applyJudgeWithoutOverridingHardFailure({ step: 1, semantic_claim: 'A claim.', hard_rule_failure: false }, {
      evaluate: () => { throw new Error('judge process unavailable'); }
    })).toEqual({ available: false, semantic_error: false, reason: 'judge_malformed' });
  });

  it('records first error, containment, propagation, recovery, and unsafe persistence', () => {
    const metrics = summarizeHorizonSteps([
      { step: 1, valid_state: true, error_detected: false, error_contained: false, authority_widened: false, downstream_error: false, recovered: false },
      { step: 2, valid_state: false, error_class: 'invalid_state_transition', error_detected: true, error_contained: true, authority_widened: false, downstream_error: false, recovered: false },
      { step: 3, valid_state: true, error_detected: false, error_contained: false, authority_widened: false, downstream_error: false, recovered: true }
    ]);

    expect(metrics).toEqual(expect.objectContaining({ first_error_step: 2, first_error_class: 'invalid_state_transition', first_error_contained: true, propagation_suppressed: true, unsafe_persistence: false, recovery_probability: 1, detected_fault: true, safe_recovery: true, post_fault_outcome: 'safe_recovery_and_continued_execution' }));
  });

  it('does not treat unsafe persistence as ordinary task failure', () => {
    const metrics = summarizeHorizonSteps([
      { step: 1, valid_state: true, error_detected: false, error_contained: false, authority_widened: true, downstream_error: false, recovered: false },
      { step: 2, valid_state: false, error_class: 'silent_persisted_error', error_detected: false, error_contained: false, authority_widened: true, downstream_error: true, recovered: false }
    ]);

    expect(metrics.task_success).toBe(false);
    expect(metrics.unsafe_persistence).toBe(true);
  });

  it('computes the geometric horizon estimate without claiming observed data', () => {
    expect(geometricSuccessEstimate(0.9, 2)).toBeCloseTo(0.81);
    expect(() => geometricSuccessEstimate(1.1, 4)).toThrow();
  });

  it('keeps safe recovery separate from the existing task-success metric', () => {
    const metrics = summarizeHorizonSteps([
      { step: 1, valid_state: false, error_class: 'detected_and_contained_error', error_detected: true, error_contained: true, authority_widened: false, downstream_error: false, recovered: false },
      { step: 2, valid_state: true, error_detected: false, error_contained: false, authority_widened: false, downstream_error: false, recovered: true }
    ]);

    expect(metrics.safe_recovery).toBe(true);
    expect(metrics.post_fault_outcome).toBe('safe_recovery_and_continued_execution');
    expect(metrics.task_success).toBe(false);
  });

  it('reports a clean negative control with no governance advantage', () => {
    const runs = runMatchedHorizonTasks([{ task_id: 'clean-control', seed: 1, horizon: 8, fault_mode: 'clean_control' }]);
    expect(new Set(runs.map(run => run.metrics.task_success))).toEqual(new Set([true]));
    expect(new Set(runs.map(run => run.metrics.unsafe_persistence))).toEqual(new Set([false]));
    expect(new Set(runs.map(run => run.metrics.post_fault_outcome))).toEqual(new Set(['no_fault']));
  });

  it('classifies a detected fault at the final step as safe termination', () => {
    const metrics = summarizeHorizonSteps([
      { step: 1, valid_state: false, error_class: 'detected_and_contained_error', error_detected: true, error_contained: true, authority_widened: false, downstream_error: false, recovered: false }
    ]);

    expect(metrics.post_fault_outcome).toBe('safe_termination');
    expect(metrics.safe_recovery).toBe(false);
  });

  it('computes bounded Wilson 95% intervals for seed rates', () => {
    const interval = confidenceInterval95(50, 100);
    expect(interval.rate).toBe(0.5);
    expect(interval.lower).toBeGreaterThan(0);
    expect(interval.upper).toBeLessThan(1);
    expect(() => confidenceInterval95(2, 1)).toThrow();
  });

  it('runs the same seeded task deterministically', () => {
    const task = { task_id: 'task-1', seed: 4, horizon: 2 as const };
    expect(runHorizonTask(task, 'D_agent_k_hybrid')).toEqual(runHorizonTask(task, 'D_agent_k_hybrid'));
  });

  it('keeps matched task identities across all four conditions', () => {
    const runs = runMatchedHorizonTasks([{ task_id: 'task-1', seed: 4, horizon: 2 }]);
    expect(runs.map(run => run.condition)).toEqual(['A_baseline', 'B_judge_only', 'C_agent_k_only', 'D_agent_k_hybrid']);
    expect(new Set(runs.map(run => run.task.task_id)).size).toBe(1);
  });

  it('shows baseline propagation while Agent K contains the hard failure', () => {
    const baseline = runHorizonTask({ task_id: 'hard-fault', seed: 4, horizon: 2 }, 'A_baseline');
    const governed = runHorizonTask({ task_id: 'hard-fault', seed: 4, horizon: 2 }, 'C_agent_k_only');
    const hybrid = runHorizonTask({ task_id: 'hard-fault', seed: 4, horizon: 2 }, 'D_agent_k_hybrid');

    expect(baseline.metrics).toEqual(expect.objectContaining({ propagation_suppressed: false, unsafe_persistence: true }));
    expect(governed.metrics).toEqual(expect.objectContaining({ propagation_suppressed: true, unsafe_persistence: false }));
    expect(governed.steps[0]).toEqual(expect.objectContaining({ error_detected: true, error_contained: true }));
    expect(governed.steps[1]).toEqual(expect.objectContaining({ downstream_error: false, recovered: true }));
    expect(hybrid.steps[0]).toEqual(expect.objectContaining({ error_detected: true, error_contained: true, authority_widened: false }));
  });

  it('shows the semantic judge catching a semantic fault without creating authority', () => {
    const judgeOnly = runHorizonTask({ task_id: 'semantic-fault', seed: 8, horizon: 2 }, 'B_judge_only');
    const baseline = runHorizonTask({ task_id: 'semantic-fault', seed: 8, horizon: 2 }, 'A_baseline');

    expect(judgeOnly.steps[0]).toEqual(expect.objectContaining({ error_detected: true, error_contained: true, authority_widened: false }));
    expect(baseline.steps[0]).toEqual(expect.objectContaining({ error_detected: false, error_contained: false }));
  });
});
