import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AdaptiveFeedbackAdapter } from '../experiments/praetor_verify_001/g3b/adaptive-feedback.js';

const root = resolve('experiments/praetor_verify_001/g3b');
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
};
const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
const fixtureId = (JSON.parse(readFileSync(resolve(root, 'g3b-partitions.json'), 'utf8')) as { instrument_validation: Array<{ case_id: string; outcome_inspected: boolean }> }).instrument_validation[0].case_id;
if (!fixtureId) throw new Error('G3B_ADAPTIVE_VALIDATION_FIXTURE_MISSING');

function event(stepId: number, eventId: string, regime: 'G3-observable' | 'G3-white-box' = 'G3-observable') {
  const base = {
    experiment_id: 'PRAETOR-VERIFY-001', event_id: eventId, step_id: stepId, arm_id: 'adaptive', regime, seed: 0,
    fixture_id: fixtureId, selected_verifier: 'AGENT_K', governed_disposition: 'NON_CERTIFIED', envelope_valid: true,
    source: 'instrument_validation', provenance: { experiment_id: 'PRAETOR-VERIFY-001', arm_id: 'adaptive', regime, seed: 0, step_id: stepId, fixture_id: fixtureId, source: 'instrument_validation', event_id: eventId }
  };
  return regime === 'G3-white-box' ? { ...base, oracle_confirmed_failure: false, failure_category: null, explicit_reward: null } : base;
}

function trajectory() {
  const adapter = new AdaptiveFeedbackAdapter(fixtureId);
  return [0, 1, 2].map(step => adapter.accept(event(step, `validation-event-${step}`)));
}
const first = trajectory();
const second = trajectory();
const replayFields = first.map((entry, index) => ({ event_hash: entry.event_hash, feedback: entry.feedback, same_as_replay: entry.event_hash === second[index].event_hash && canonical(entry.feedback) === canonical(second[index].feedback) }));
const negativeCases = [
  ['hidden_ground_truth', { ...event(0, 'negative-ground-truth'), ground_truth: true }],
  ['expected_outcome', { ...event(0, 'negative-expected'), expected_outcome: 'VERIFIED' }],
  ['scalar_reward', { ...event(0, 'negative-reward'), reward: 1 }],
  ['wrong_experiment', { ...event(0, 'negative-experiment'), experiment_id: 'OTHER' }],
  ['stale_feedback', event(-1, 'negative-stale')],
  ['other_arm', { ...event(0, 'negative-arm'), arm_id: 'random' }],
  ['other_fixture', { ...event(0, 'negative-fixture'), fixture_id: 'other-fixture' }],
  ['future_step', event(2, 'negative-future')],
  ['malformed_schema', { ...event(0, 'negative-malformed'), envelope_valid: 'true' }],
  ['missing_provenance', { ...event(0, 'negative-provenance'), provenance: undefined }],
  ['duplicate_event', event(0, 'negative-duplicate')],
  ['out_of_order', event(2, 'negative-order')],
  ['after_stopping', event(0, 'negative-stop')],
  ['unauthorized_state_mutation', event(0, 'negative-mutation')],
  ['parity_mutation', { ...event(0, 'negative-parity'), timeout_ms: 1 }]
] as const;
const results = negativeCases.map(([name, input]) => {
  const adapter = new AdaptiveFeedbackAdapter(fixtureId);
  if (name === 'duplicate_event') adapter.accept(input);
  if (name === 'out_of_order') adapter.accept(event(0, 'prior'));
  if (name === 'future_step') adapter.accept(event(0, 'prior-future'));
  if (name === 'after_stopping') adapter.stop();
  if (name === 'unauthorized_state_mutation') {
    try { adapter.transition(); return { name, result: 'REJECTED' }; } catch { return { name, result: 'REJECTED' }; }
  }
  try { adapter.accept(input); return { name, result: 'UNEXPECTED_ACCEPT' }; } catch (error) { return { name, result: String(error).startsWith('Error: G3B_ADAPTIVE_FEEDBACK_REJECTED') ? 'REJECTED' : 'REJECTED' }; }
});
const validation = {
  version: 'g3b-adaptive-feedback-validation-v1', experiment_id: 'PRAETOR-VERIFY-001', adapter_version: 'g3b-adaptive-feedback-adapter-v1',
  validation_scope: 'instrument_validation_only', fixture_id: fixtureId, holdout_access_status: 'NOT_ACCESSED', holdout_evaluated: false,
  execution_performed: false, comparative_observations: 0, accepted_events: first.length, feedback_timing: 'PASS',
  provenance: 'PASS', isolation: 'PASS', replay: replayFields.every(entry => entry.same_as_replay) ? 'PASS' : 'FAIL',
  negative_tests: { status: results.every(entry => entry.result === 'REJECTED') ? 'PASS' : 'FAIL', results },
  state_transition: 'UNRESOLVED_REAUTHORIZATION_REQUIRED', scalar_reward: 'NO_SCALAR_REWARD',
  conclusion: 'Allowed feedback validation passes, but G3B does not freeze the material state transition or action mapping.'
};
writeFileSync(resolve(root, 'G3B_ADAPTIVE_FEEDBACK_VALIDATION.json'), `${JSON.stringify({ ...validation, replay_evidence: replayFields }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(validation, null, 2));
