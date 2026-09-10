import { describe, expect, it } from 'vitest';
import { initializeAdaptiveState, mapAdaptiveAction, transitionAdaptiveState } from '../experiments/praetor_verify_001/g3b/adaptive-action.js';

describe('G3B adaptive action and state semantics boundary', () => {
  it('rejects action mapping while candidate semantics are unresolved', () => {
    expect(() => mapAdaptiveAction()).toThrow('action_to_candidate_mapping_unresolved');
  });

  it('rejects adaptive state initialization until the complete state contract is frozen', () => {
    expect(() => initializeAdaptiveState()).toThrow('state_initialization_transition_contract_unresolved');
  });

  it('rejects every state transition without a frozen G3B formula', () => {
    expect(() => transitionAdaptiveState()).toThrow('state_transition_formula_unresolved');
  });
});
