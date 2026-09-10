import { describe, expect, it } from 'vitest';
import { AdaptiveFeedbackAdapter } from '../experiments/praetor_verify_001/g3b/adaptive-feedback.js';

function feedback(overrides: Record<string, unknown> = {}) {
  const base = {
    experiment_id: 'PRAETOR-VERIFY-001', event_id: 'event-0', step_id: 0, arm_id: 'adaptive', regime: 'G3-observable', seed: 0,
    fixture_id: 'validate-0000', selected_verifier: 'AGENT_K', governed_disposition: 'NON_CERTIFIED', envelope_valid: true,
    source: 'instrument_validation', provenance: {
      experiment_id: 'PRAETOR-VERIFY-001', arm_id: 'adaptive', regime: 'G3-observable', seed: 0, step_id: 0,
      fixture_id: 'validate-0000', source: 'instrument_validation', event_id: 'event-0'
    }
  };
  return { ...base, ...overrides };
}

describe('G3B adaptive feedback adapter', () => {
  it('accepts a valid observable validation event and preserves its hashable evidence', () => {
    const result = new AdaptiveFeedbackAdapter().accept(feedback());
    expect(result.status).toBe('ACCEPTED');
    expect(result.event_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.feedback.source).toBe('instrument_validation');
  });

  it.each([
    ['ground truth', { ground_truth: true }],
    ['expected outcome', { expected_outcome: 'VERIFIED' }],
    ['scalar reward', { reward: 1 }],
    ['wrong experiment', { experiment_id: 'OTHER' }],
    ['unknown field', { unexpected: true }],
    ['missing provenance', { provenance: undefined }],
    ['wrong arm', { arm_id: 'random' }]
  ])('rejects %s', (_name, override) => {
    expect(() => new AdaptiveFeedbackAdapter().accept(feedback(override))).toThrow('G3B_ADAPTIVE_FEEDBACK_REJECTED');
  });

  it('rejects stale, duplicate, and out-of-order events', () => {
    const adapter = new AdaptiveFeedbackAdapter();
    adapter.accept(feedback());
    expect(() => adapter.accept(feedback({ event_id: 'event-1', step_id: 0 }))).toThrow('ordering');
    expect(() => adapter.accept(feedback({ event_id: 'event-0', step_id: 1, provenance: { ...feedback().provenance, step_id: 1 } }))).toThrow('duplicate_event');
    expect(() => adapter.accept(feedback({ event_id: 'event-2', step_id: 1, provenance: { ...feedback().provenance, step_id: 1, event_id: 'wrong' } }))).toThrow('provenance_mismatch');
  });

  it('accepts only declared white-box fields and does not use explicit reward as a transition', () => {
    const adapter = new AdaptiveFeedbackAdapter();
    const event = feedback({
      event_id: 'white-0', regime: 'G3-white-box', oracle_confirmed_failure: true, failure_category: 'BOUNDARY_TRANSITION_FAILURE', explicit_reward: 0,
      provenance: { ...feedback().provenance, event_id: 'white-0', regime: 'G3-white-box' }
    });
    expect(adapter.accept(event).status).toBe('ACCEPTED');
    expect(() => adapter.transition()).toThrow('state_transition_semantics_unresolved_reauthorization_required');
  });

  it('rejects events after a stopping condition', () => {
    const adapter = new AdaptiveFeedbackAdapter();
    adapter.stop();
    expect(() => adapter.accept(feedback())).toThrow('after_stopping_condition');
  });
});
