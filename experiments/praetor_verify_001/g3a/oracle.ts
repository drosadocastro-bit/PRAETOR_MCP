import { CandidateSchema, type Decision } from './contract.js';

export function adjudicateExpected(input: unknown): Decision {
  const state = CandidateSchema.parse(input);
  const family = state.claim_family;
  const staticResults: Partial<Record<typeof family, Decision>> = {
    universal: { disposition: 'NON_CERTIFIED', verifier: 'NONE' },
    human: { disposition: 'REVIEW_REQUIRED', verifier: 'HUMAN_REVIEW' }
  };
  const fixed = staticResults[family];
  if (fixed) return { ...fixed };
  if (family === 'semantic') {
    const observed = Number(state.proof_available) + Number(state.provenance_complete) === 2;
    return { verifier: 'SEMANTIC_JUDGE', disposition: !observed ? 'UNAVAILABLE' : state.contradiction_score < 0.5 ? 'SEMANTICALLY_SUPPORTED' : 'SEMANTICALLY_FLAGGED' };
  }
  const contraryEvidence = [
    state.schema_valid === false, state.duplicate_lineage === true,
    state.tool_permission === 'denied', state.authority_present && state.authority_valid === false,
    state.proof_available && state.proof_supports_claim === false
  ];
  const affirmativeEvidence = [
    state.schema_valid, !state.duplicate_lineage, state.provenance_complete,
    state.authority_present, state.authority_valid, state.proof_available, state.proof_supports_claim,
    state.tool_permission === 'granted', state.requested_tool === state.record_tool,
    state.requested_action === state.record_action
  ];
  const outcome = contraryEvidence.some(Boolean) ? 'REJECTED' : affirmativeEvidence.every(Boolean) ? 'VERIFIED' : 'NON_CERTIFIED';
  return { verifier: 'AGENT_K', disposition: outcome };
}