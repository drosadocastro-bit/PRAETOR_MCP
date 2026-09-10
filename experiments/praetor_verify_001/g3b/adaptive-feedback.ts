import { createHash } from 'node:crypto';
import { transitionAdaptiveState, type AdaptiveAction, type AdaptiveState } from './adaptive-action.js';

export const ADAPTIVE_FEEDBACK_ADAPTER_VERSION = 'g3b-adaptive-feedback-adapter-v1';
export type FeedbackRegime = 'G3-observable' | 'G3-white-box';

type Provenance = {
  experiment_id: 'PRAETOR-VERIFY-001'; arm_id: 'adaptive'; regime: FeedbackRegime;
  seed: number; step_id: number; fixture_id: string; source: 'instrument_validation'; event_id: string;
};
export type AdaptiveFeedback = Provenance & {
  selected_verifier: string; governed_disposition: string; envelope_valid: boolean;
  frozen_capability_map?: Record<string, unknown>; proof_definitions?: Record<string, unknown>;
  oracle_confirmed_failure?: boolean; failure_category?: string | null; explicit_reward?: number | null;
};
export type FeedbackAcceptance = { status: 'ACCEPTED'; event_hash: string; feedback: AdaptiveFeedback };

const observableFields = new Set(['experiment_id', 'event_id', 'step_id', 'arm_id', 'regime', 'seed', 'fixture_id', 'selected_verifier', 'governed_disposition', 'envelope_valid', 'source', 'provenance']);
const whiteBoxFields = new Set([...observableFields, 'frozen_capability_map', 'proof_definitions', 'oracle_confirmed_failure', 'failure_category', 'explicit_reward']);
const forbiddenFields = new Set(['ground_truth', 'expected_outcome', 'oracle_only_label', 'adjudicated_failure', 'hidden_rationale', 'winner', 'loser', 'comparative_score', 'comparative_summary', 'holdout_label', 'future_step_information', 'post_run_summary', 'prior_arm_feedback', 'previous_arm_scores', 'g3a_toy_reward', 'reward']);
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
};
const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
const fail = (reason: string): never => { throw new Error(`G3B_ADAPTIVE_FEEDBACK_REJECTED:${reason}`); };

export class AdaptiveFeedbackAdapter {
  #lastStep = -1;
  #seen = new Set<string>();
  #stopped = false;
  #fixtureId: string | undefined;
  #lastAccepted: FeedbackAcceptance | undefined;

  constructor(fixtureId?: string) { this.#fixtureId = fixtureId; }

  accept(input: unknown): FeedbackAcceptance {
    if (this.#stopped) return fail('after_stopping_condition');
    if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('malformed_schema');
    const candidate = input as Record<string, unknown>;
    const keys = new Set(Object.keys(candidate));
    for (const key of keys) if (forbiddenFields.has(key)) return fail(`protected_field:${key}`);
    const regime = candidate.regime;
    if (regime !== 'G3-observable' && regime !== 'G3-white-box') return fail('invalid_regime');
    const allowed = regime === 'G3-observable' ? observableFields : whiteBoxFields;
    for (const key of keys) if (!allowed.has(key)) return fail(`unknown_field:${key}`);
    const required = ['event_id', 'step_id', 'arm_id', 'regime', 'seed', 'fixture_id', 'selected_verifier', 'governed_disposition', 'envelope_valid', 'source'];
    for (const key of required) if (!(key in candidate)) return fail(`missing_field:${key}`);
    if (candidate.experiment_id !== 'PRAETOR-VERIFY-001' || candidate.arm_id !== 'adaptive' || candidate.source !== 'instrument_validation' || this.#fixtureId !== undefined && candidate.fixture_id !== this.#fixtureId) return fail('provenance_mismatch');
    const seed = candidate.seed;
    const stepId = candidate.step_id;
    if (candidate.regime !== regime || typeof seed !== 'number' || !Number.isSafeInteger(seed) || typeof stepId !== 'number' || !Number.isSafeInteger(stepId) || stepId !== this.#lastStep + 1) return fail('ordering');
    if (typeof candidate.event_id !== 'string' || typeof candidate.fixture_id !== 'string' || typeof candidate.selected_verifier !== 'string' || typeof candidate.governed_disposition !== 'string' || typeof candidate.envelope_valid !== 'boolean') return fail('malformed_schema');
    if (typeof candidate.provenance !== 'object' || candidate.provenance === null) return fail('missing_provenance');
    const expectedProvenance = { experiment_id: candidate.experiment_id, arm_id: candidate.arm_id, regime, seed: candidate.seed, step_id: candidate.step_id, fixture_id: candidate.fixture_id, source: candidate.source, event_id: candidate.event_id };
    if (canonical(candidate.provenance) !== canonical(expectedProvenance)) return fail('provenance_mismatch');
    if (this.#seen.has(candidate.event_id)) return fail('duplicate_event');
    if (regime === 'G3-white-box') {
      if (typeof candidate.oracle_confirmed_failure !== 'boolean') return fail('malformed_schema');
      if (candidate.failure_category !== null && typeof candidate.failure_category !== 'string') return fail('malformed_schema');
      if (candidate.explicit_reward !== null && candidate.explicit_reward !== undefined && (typeof candidate.explicit_reward !== 'number' || !Number.isFinite(candidate.explicit_reward))) return fail('scalar_reward_malformed');
    }
    const feedback = structuredClone(candidate) as AdaptiveFeedback;
    const eventHash = hash(feedback);
    this.#seen.add(feedback.event_id);
    this.#lastStep = feedback.step_id;
    this.#lastAccepted = { status: 'ACCEPTED', event_hash: eventHash, feedback };
    return this.#lastAccepted;
  }

  stop() { this.#stopped = true; }

  transition(state: AdaptiveState, action: AdaptiveAction) {
    if (!this.#lastAccepted) return fail('missing_accepted_feedback');
    return transitionAdaptiveState(state, action, this.#lastAccepted);
  }
}
