import { CandidateSchema, type Decision } from './contract.js';

export function evaluatePraetorExperimental(input: unknown): Decision {
  const candidate = CandidateSchema.parse(input);
  switch (candidate.claim_family) {
    case 'universal': return { disposition: 'NON_CERTIFIED', verifier: 'NONE' };
    case 'human': return { disposition: 'REVIEW_REQUIRED', verifier: 'HUMAN_REVIEW' };
    case 'semantic': {
      if (!candidate.proof_available || !candidate.provenance_complete) return { disposition: 'UNAVAILABLE', verifier: 'SEMANTIC_JUDGE' };
      return { disposition: candidate.contradiction_score >= 0.5 ? 'SEMANTICALLY_FLAGGED' : 'SEMANTICALLY_SUPPORTED', verifier: 'SEMANTIC_JUDGE' };
    }
    case 'permission': {
      if (!candidate.schema_valid || candidate.duplicate_lineage || candidate.tool_permission === 'denied'
        || (candidate.authority_present && !candidate.authority_valid)
        || (candidate.proof_available && !candidate.proof_supports_claim)) return { disposition: 'REJECTED', verifier: 'AGENT_K' };
      if (!candidate.provenance_complete || !candidate.authority_present || !candidate.proof_available
        || candidate.tool_permission === 'unknown' || candidate.requested_tool !== candidate.record_tool
        || candidate.requested_action !== candidate.record_action) return { disposition: 'NON_CERTIFIED', verifier: 'AGENT_K' };
      return { disposition: 'VERIFIED', verifier: 'AGENT_K' };
    }
  }
}