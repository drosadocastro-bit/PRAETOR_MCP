import type { AdaptiveFeedback, FeedbackRegime } from './adaptive-feedback.js';

export const ADAPTIVE_TRANSITION_DOMAIN = ['SEMANTICALLY_SUPPORTED', 'NON_CERTIFIED', 'UNAVAILABLE'] as const;
export type GovernedDisposition = typeof ADAPTIVE_TRANSITION_DOMAIN[number];
export type CandidateStatus = 'UNTRIED' | 'SUPPRESSED' | 'COMPLETED';
export type CompatibilityCandidateStatus = CandidateStatus | 'ELIGIBLE';
export type CandidateReference = { case_id: string; case_fingerprint: string; fixture_id: string };
export type AdaptiveAction = {
  candidate_id: string;
  fixture_id: string;
  experiment_id: 'PRAETOR-VERIFY-001';
  arm_id: 'adaptive';
  regime: FeedbackRegime;
  seed: number;
  step_id: number;
};
export type AdaptiveContext = Pick<AdaptiveAction, 'fixture_id' | 'regime' | 'seed'>;
export type FeedbackHistoryEntry = {
  event_id: string;
  event_hash: string;
  candidate_id: string;
  action: AdaptiveAction;
  governed_disposition: GovernedDisposition;
  next_status: CandidateStatus;
};
export type AdaptiveState = {
  step: number;
  current_candidate: CandidateReference | null;
  candidate_space: readonly CandidateReference[];
  candidate_status: Record<string, CandidateStatus>;
  feedback_history: readonly FeedbackHistoryEntry[];
  context: AdaptiveContext;
  stopped: boolean;
  stop_result: 'STOP_NO_SELECTABLE_CANDIDATE' | 'INVALID_ACTION' | 'INVALID_TRANSITION' | 'INVALID_FEEDBACK_ENVELOPE' | 'FAIL_CLOSED_TRAJECTORY_TERMINATION' | null;
};
export type SelectionResult = CandidateReference | { stop: 'STOP_NO_SELECTABLE_CANDIDATE' };

const fail = (code: string): never => { throw new Error(`G3B_ADAPTIVE_${code}`); };
const isCandidateReference = (value: unknown): value is CandidateReference => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.case_id === 'string' && candidate.case_id.length > 0
    && typeof candidate.case_fingerprint === 'string' && /^[a-f0-9]{64}$/.test(candidate.case_fingerprint)
    && typeof candidate.fixture_id === 'string' && candidate.fixture_id.length > 0;
};
const cloneCandidate = (candidate: CandidateReference): CandidateReference => ({ ...candidate });
const requireCandidateSpace = (candidateSpace: readonly CandidateReference[]) => {
  if (!Array.isArray(candidateSpace) || candidateSpace.length === 0) fail('INVALID_CANDIDATE_SPACE');
  const ids = new Set<string>();
  for (const candidate of candidateSpace) {
    if (!isCandidateReference(candidate) || ids.has(candidate.case_id)) fail('INVALID_CANDIDATE_SPACE');
    ids.add(candidate.case_id);
  }
};
const validateState = (state: AdaptiveState) => {
  if (!state || !Number.isSafeInteger(state.step) || state.step < 0 || !Array.isArray(state.candidate_space)
    || !state.candidate_status || !Array.isArray(state.feedback_history) || !state.context) fail('INVALID_STATE');
  requireCandidateSpace(state.candidate_space);
  for (const candidate of state.candidate_space) {
    const status = state.candidate_status[candidate.case_id];
    if (status !== 'UNTRIED' && status !== 'SUPPRESSED' && status !== 'COMPLETED') fail('INVALID_STATE');
  }
};

export function mapAdaptiveAction(action: AdaptiveAction, candidateSpace: readonly CandidateReference[], context: AdaptiveContext): CandidateReference {
  requireCandidateSpace(candidateSpace);
  if (!action || typeof action !== 'object' || action.experiment_id !== 'PRAETOR-VERIFY-001' || action.arm_id !== 'adaptive'
    || action.fixture_id !== context.fixture_id || action.regime !== context.regime || action.seed !== context.seed
    || typeof action.candidate_id !== 'string' || action.candidate_id.length === 0 || !Number.isSafeInteger(action.step_id)) fail('INVALID_ACTION');
  const candidate = candidateSpace.find(item => item.case_id === action.candidate_id);
  if (candidate === undefined) throw new Error('G3B_ADAPTIVE_INVALID_ACTION');
  if (candidate.fixture_id !== context.fixture_id) fail('INVALID_ACTION');
  return cloneCandidate(candidate);
}

export function initializeAdaptiveState(candidateSpace: readonly CandidateReference[], context: AdaptiveContext): AdaptiveState {
  requireCandidateSpace(candidateSpace);
  const candidate_status = Object.fromEntries(candidateSpace.map(candidate => [candidate.case_id, 'UNTRIED' as const]));
  return {
    step: 0,
    current_candidate: null,
    candidate_space: candidateSpace.map(cloneCandidate),
    candidate_status,
    feedback_history: [],
    context: { ...context },
    stopped: false,
    stop_result: null
  };
}

export function selectNextAdaptiveCandidate(state: AdaptiveState): SelectionResult {
  validateState(state);
  if (state.stopped) return { stop: state.stop_result === 'STOP_NO_SELECTABLE_CANDIDATE' ? state.stop_result : 'STOP_NO_SELECTABLE_CANDIDATE' };
  const currentIndex = state.current_candidate === null ? -1 : state.candidate_space.findIndex(candidate => candidate.case_id === state.current_candidate?.case_id);
  for (let offset = 1; offset <= state.candidate_space.length; offset += 1) {
    const candidate = state.candidate_space[(currentIndex + offset) % state.candidate_space.length];
    if (!candidate) continue;
    if (state.candidate_status[candidate.case_id] === 'UNTRIED') return cloneCandidate(candidate);
  }
  return { stop: 'STOP_NO_SELECTABLE_CANDIDATE' };
}

export function transitionAdaptiveState(state: AdaptiveState, action: AdaptiveAction, accepted: { event_hash: string; feedback: AdaptiveFeedback }): AdaptiveState {
  validateState(state);
  if (state.stopped) fail('INVALID_TRANSITION');
  const candidate = mapAdaptiveAction(action, state.candidate_space, state.context);
  const expectedCandidate = selectNextAdaptiveCandidate(state);
  if (action.step_id !== state.step || 'stop' in expectedCandidate || expectedCandidate.case_id !== candidate.case_id) fail('INVALID_TRANSITION');
  const feedback = accepted?.feedback;
  if (!feedback || feedback.fixture_id !== state.context.fixture_id || feedback.regime !== state.context.regime || feedback.seed !== state.context.seed
    || feedback.step_id !== state.step || feedback.arm_id !== 'adaptive' || feedback.experiment_id !== 'PRAETOR-VERIFY-001') fail('INVALID_TRANSITION');
  if (!feedback.envelope_valid) fail('INVALID_FEEDBACK_ENVELOPE');
  if (feedback.explicit_reward !== undefined || feedback.oracle_confirmed_failure !== undefined || feedback.failure_category !== undefined
    || feedback.frozen_capability_map !== undefined || feedback.proof_definitions !== undefined) fail('INVALID_TRANSITION');
  if (!ADAPTIVE_TRANSITION_DOMAIN.includes(feedback.governed_disposition as GovernedDisposition)) fail('INVALID_TRANSITION');
  if (state.feedback_history.some(entry => entry.event_id === feedback.event_id)) fail('INVALID_TRANSITION');
  const nextStatus: CandidateStatus = feedback.governed_disposition === 'SEMANTICALLY_SUPPORTED' ? 'COMPLETED' : 'SUPPRESSED';
  const nextStatuses = { ...state.candidate_status, [candidate.case_id]: nextStatus };
  const nextState: AdaptiveState = {
    ...state,
    step: state.step + 1,
    current_candidate: cloneCandidate(candidate),
    candidate_status: nextStatuses,
    feedback_history: [...state.feedback_history, { event_id: feedback.event_id, event_hash: accepted.event_hash, candidate_id: candidate.case_id, action: { ...action }, governed_disposition: feedback.governed_disposition as GovernedDisposition, next_status: nextStatus }]
  };
  const selection = selectNextAdaptiveCandidate(nextState);
  return 'stop' in selection ? { ...nextState, stopped: true, stop_result: selection.stop } : nextState;
}

export function resolveNextAdaptiveAction(state: AdaptiveState): AdaptiveAction | { stop: 'STOP_NO_SELECTABLE_CANDIDATE' } {
  const selection = selectNextAdaptiveCandidate(state);
  if ('stop' in selection) return selection;
  return { candidate_id: selection.case_id, fixture_id: state.context.fixture_id, experiment_id: 'PRAETOR-VERIFY-001', arm_id: 'adaptive', regime: state.context.regime, seed: state.context.seed, step_id: state.step };
}
