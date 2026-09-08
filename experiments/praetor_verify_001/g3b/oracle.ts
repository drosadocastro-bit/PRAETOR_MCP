export type G3BDecision = { disposition: string; verifier: string };
export function adjudicateG3B(state: any): G3BDecision {
  if (state.claim_family === 'universal') return { disposition: 'NON_CERTIFIED', verifier: 'NONE' };
  if (state.claim_family === 'human') return { disposition: 'REVIEW_REQUIRED', verifier: 'HUMAN_REVIEW' };
  if (state.claim_family === 'semantic') return { verifier: 'SEMANTIC_JUDGE', disposition: !state.proof_available || !state.provenance_complete ? 'UNAVAILABLE' : state.contradiction_score >= 0.5 ? 'SEMANTICALLY_FLAGGED' : 'SEMANTICALLY_SUPPORTED' };
  const contrary = !state.schema_valid || state.duplicate_lineage || state.tool_permission === 'denied' || state.authority_present && !state.authority_valid || state.proof_available && !state.proof_supports_claim;
  const affirmative = state.schema_valid && !state.duplicate_lineage && state.provenance_complete && state.authority_present && state.authority_valid && state.proof_available && state.proof_supports_claim && state.tool_permission === 'granted' && state.requested_tool === state.record_tool && state.requested_action === state.record_action;
  return { verifier: 'AGENT_K', disposition: contrary ? 'REJECTED' : affirmative ? 'VERIFIED' : 'NON_CERTIFIED' };
}