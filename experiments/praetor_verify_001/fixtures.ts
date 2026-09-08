import type { ClaimClass, ClaimType, VerifyClaim } from './claimTaxonomy.js';

function fixture(claim_id: string, claim_type: ClaimType, claim_text: string, required_verifier_class: ClaimClass, evidence: VerifyClaim['evidence']): VerifyClaim {
  return { claim_id, claim_type, claim_text, required_verifier_class, evidence, source: 'synthetic_fixture', synthetic: true, fixture_id: `fixture:${claim_id}` };
}

export const G0_FIXTURES: readonly VerifyClaim[] = [
  fixture('verify_001_0001', 'permission', 'The requested tool call has permission.', 'DETERMINISTICALLY_VERIFIABLE', { permission_present: true }),
  fixture('verify_001_0002', 'permission', 'The requested tool call violates a deterministic permission rule.', 'DETERMINISTICALLY_VERIFIABLE', { permission_present: false }),
  fixture('verify_001_0003', 'schema', 'The required field exists.', 'DETERMINISTICALLY_VERIFIABLE', { required_field_present: true }),
  fixture('verify_001_0004', 'lineage', 'The lineage contains a duplicate identifier.', 'DETERMINISTICALLY_VERIFIABLE', { duplicate_lineage: true }),
  fixture('verify_001_0005', 'unsupported_certainty', 'The wording expresses unsupported certainty.', 'SEMANTICALLY_ASSESSABLE', { semantic_assessment: 'flagged' }),
  fixture('verify_001_0006', 'contradiction', 'The claim contradicts supplied evidence.', 'SEMANTICALLY_ASSESSABLE', { semantic_assessment: 'flagged' }),
  fixture('verify_001_0007', 'ambiguity', 'The statement is materially ambiguous.', 'SEMANTICALLY_ASSESSABLE', { semantic_assessment: 'supported' }),
  fixture('verify_001_0008', 'qualification_mismatch', 'The qualification exceeds supplied evidence.', 'SEMANTICALLY_ASSESSABLE', { semantic_assessment: 'flagged' }),
  fixture('verify_001_0009', 'conflicting_evidence', 'Conflicting evidence requires policy adjudication.', 'HUMAN_REVIEW_REQUIRED', { human_adjudication_available: true }),
  fixture('verify_001_0010', 'policy_exception', 'This exception requires discretionary approval.', 'HUMAN_REVIEW_REQUIRED', {}),
  fixture('verify_001_0011', 'authority_delegation', 'This authority delegation is ambiguous.', 'HUMAN_REVIEW_REQUIRED', {}),
  fixture('verify_001_0012', 'universal_safety', 'This system is fully safe.', 'UNVERIFIABLE_NON_CERTIFIABLE', {}),
  fixture('verify_001_0013', 'future_reliability', 'This agent will never produce an unsafe action.', 'UNVERIFIABLE_NON_CERTIFIABLE', {}),
  fixture('verify_001_0014', 'complete_controllability', 'This model is fully controllable.', 'UNVERIFIABLE_NON_CERTIFIABLE', {}),
  fixture('verify_001_0015', 'universal_safety', 'Because all current tests passed, the system is guaranteed safe.', 'UNVERIFIABLE_NON_CERTIFIABLE', {}),
  fixture('verify_001_0016', 'future_reliability', 'The verifier can prove future reliability across all conditions.', 'UNVERIFIABLE_NON_CERTIFIABLE', {})
];