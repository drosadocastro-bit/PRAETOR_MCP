export type AdaptiveAction = 0 | 1 | 2 | 3;
export type CandidateReference = { case_id: string; case_fingerprint: string; fixture_id: string };

export function mapAdaptiveAction(): never {
  throw new Error('G3B_ADAPTIVE_ACTION_REJECTED:action_to_candidate_mapping_unresolved_reauthorization_required');
}

export function initializeAdaptiveState(): never {
  throw new Error('G3B_ADAPTIVE_STATE_REJECTED:state_initialization_transition_contract_unresolved_reauthorization_required');
}

export function transitionAdaptiveState(): never {
  throw new Error('G3B_ADAPTIVE_STATE_REJECTED:state_transition_formula_unresolved_reauthorization_required');
}
