import { describe, expect, it } from 'vitest';
import { initializeAdaptiveState, mapAdaptiveAction, resolveNextAdaptiveAction, selectNextAdaptiveCandidate, transitionAdaptiveState, type AdaptiveAction, type CandidateReference } from '../experiments/praetor_verify_001/g3b/adaptive-action.js';
import type { AdaptiveFeedback } from '../experiments/praetor_verify_001/g3b/adaptive-feedback.js';

const context = { fixture_id: 'validate-0000', regime: 'G3-observable' as const, seed: 7 };
const candidates: CandidateReference[] = [
  { case_id: 'validate-0000', case_fingerprint: 'a'.repeat(64), fixture_id: context.fixture_id },
  { case_id: 'validate-0001', case_fingerprint: 'b'.repeat(64), fixture_id: context.fixture_id },
  { case_id: 'validate-0002', case_fingerprint: 'c'.repeat(64), fixture_id: context.fixture_id }
];
const actionFor = (candidateId: string, stepId = 0): AdaptiveAction => ({ candidate_id: candidateId, ...context, experiment_id: 'PRAETOR-VERIFY-001', arm_id: 'adaptive', step_id: stepId });
const feedbackFor = (eventId: string, disposition: string, stepId = 0, envelopeValid = true) => {
  const feedback: AdaptiveFeedback = {
    experiment_id: 'PRAETOR-VERIFY-001', event_id: eventId, step_id: stepId, arm_id: 'adaptive', regime: context.regime,
    seed: context.seed, fixture_id: context.fixture_id, selected_verifier: 'AGENT_K', governed_disposition: disposition,
    envelope_valid: envelopeValid, source: 'instrument_validation'
  };
  return { status: 'ACCEPTED' as const, event_hash: `hash-${eventId}`, feedback };
};

describe('G3B adaptive action and state semantics', () => {
  it('resolves an exact candidate ID and preserves provenance', () => {
    expect(mapAdaptiveAction(actionFor('validate-0001'), candidates, context)).toEqual(candidates[1]);
    expect(() => mapAdaptiveAction(actionFor('validate-404'), candidates, context)).toThrow('G3B_ADAPTIVE_INVALID_ACTION');
  });

  it.each([
    ['SEMANTICALLY_SUPPORTED', 'COMPLETED'],
    ['NON_CERTIFIED', 'SUPPRESSED'],
    ['UNAVAILABLE', 'SUPPRESSED']
  ] as const)('maps %s to %s', (disposition, expectedStatus) => {
    const state = initializeAdaptiveState(candidates, context);
    const next = transitionAdaptiveState(state, actionFor(candidates[0].case_id), feedbackFor(`event-${disposition}`, disposition));
    expect(next.candidate_status[candidates[0].case_id]).toBe(expectedStatus);
    expect(next.feedback_history).toHaveLength(1);
  });

  it('selects remaining UNTRIED candidates in deterministic round-robin order and wraps', () => {
    let state = initializeAdaptiveState(candidates, context);
    expect(selectNextAdaptiveCandidate(state)).toEqual(candidates[0]);
    state = transitionAdaptiveState(state, actionFor(candidates[0].case_id), feedbackFor('event-1', 'NON_CERTIFIED'));
    expect(resolveNextAdaptiveAction(state)).toMatchObject({ candidate_id: candidates[1].case_id, step_id: 1 });
    state = transitionAdaptiveState(state, actionFor(candidates[1].case_id, 1), feedbackFor('event-2', 'UNAVAILABLE', 1));
    state = transitionAdaptiveState(state, actionFor(candidates[2].case_id, 2), feedbackFor('event-3', 'SEMANTICALLY_SUPPORTED', 2));
    expect(selectNextAdaptiveCandidate(state)).toEqual({ stop: 'STOP_NO_SELECTABLE_CANDIDATE' });
    expect(state.stopped).toBe(true);
    expect(resolveNextAdaptiveAction(state)).toEqual({ stop: 'STOP_NO_SELECTABLE_CANDIDATE' });
  });

  it('replays to identical state and event history', () => {
    const run = () => {
      const state = initializeAdaptiveState(candidates, context);
      return transitionAdaptiveState(state, actionFor(candidates[0].case_id), feedbackFor('replay-event', 'SEMANTICALLY_SUPPORTED'));
    };
    expect(run()).toEqual(run());
  });

  it.each([
    ['unknown disposition', feedbackFor('invalid-1', 'UNKNOWN')],
    ['invalid envelope', feedbackFor('invalid-2', 'SEMANTICALLY_SUPPORTED', 0, false)]
  ])('fails closed for %s', (_label, accepted) => {
    const state = initializeAdaptiveState(candidates, context);
    expect(() => transitionAdaptiveState(state, actionFor(candidates[0].case_id), accepted)).toThrow();
  });

  it('rejects malformed provenance, wrong fixture, wrong action, duplicate, future, and forbidden fields', () => {
    const state = initializeAdaptiveState(candidates, context);
    expect(() => mapAdaptiveAction({ ...actionFor(candidates[0].case_id), candidate_id: '' }, candidates, context)).toThrow('INVALID_ACTION');
    expect(() => mapAdaptiveAction({ ...actionFor(candidates[0].case_id), fixture_id: 'other' }, candidates, context)).toThrow('INVALID_ACTION');
    expect(() => transitionAdaptiveState(state, actionFor(candidates[1].case_id), feedbackFor('mismatch', 'NON_CERTIFIED'))).toThrow('INVALID_TRANSITION');
    const accepted = feedbackFor('duplicate', 'NON_CERTIFIED');
    const once = transitionAdaptiveState(state, actionFor(candidates[0].case_id), accepted);
    expect(() => transitionAdaptiveState(once, actionFor(candidates[1].case_id, 1), accepted)).toThrow('INVALID_TRANSITION');
    expect(() => transitionAdaptiveState(state, actionFor(candidates[0].case_id, 1), feedbackFor('future', 'NON_CERTIFIED', 1))).toThrow('INVALID_TRANSITION');
    const forbidden = { ...feedbackFor('reward', 'NON_CERTIFIED').feedback, explicit_reward: 0 };
    expect(() => transitionAdaptiveState(state, actionFor(candidates[0].case_id), { event_hash: 'hash', feedback: forbidden })).toThrow('INVALID_TRANSITION');
  });
});
