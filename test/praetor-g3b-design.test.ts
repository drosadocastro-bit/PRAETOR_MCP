import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { adjudicateG3B } from '../experiments/praetor_verify_001/g3b/oracle.js';
import { caseFingerprint } from '../experiments/praetor_verify_001/g3b/package.js';
import { assertG3BExecutionBlocked } from '../experiments/praetor_verify_001/g3b/run.js';
import { deriveG3BExecutionAuthority, type AuthorityInput } from '../experiments/praetor_verify_001/g3b/authority.js';

describe('G3B design integration without execution', () => {
  it('keeps the future execution gate closed', () => expect(() => assertG3BExecutionBlocked()).toThrow('G3B_EXECUTION_BLOCKED'));
  it('keeps a valid authority chain blocked while applicability review is pending', () => {
    const authority: AuthorityInput = {
      experimentId: 'PRAETOR-VERIFY-001', technicalPrevalidation: 'PASS', eligibility: 'ELIGIBLE_FOR_HUMAN_EXECUTION_DECISION',
      authorizationStatus: 'APPROVED_SIGNED', authorizationDecision: 'APPROVE_FOR_EXECUTION', executionAuthorized: true,
      signaturePresent: true, datePresent: true, authorizationExperimentMatches: true, frozenArtifactHashesMatch: true,
      repositoryClean: true, holdoutAccessStatus: 'NOT_ACCESSED', executionPerformed: false,
      historicalExecutionAuthorized: false, historicalHumanAuthorizationSigned: false, activationArtifactValid: true,
      applicabilityArtifactValid: true,
      authorizationApplicabilityReview: 'PENDING'
    };
    const result = deriveG3BExecutionAuthority(authority);
    expect(result.authorityChainValid).toBe(true);
    expect(result.effectiveExecutionAuthorized).toBe(false);
    expect(result.historicalExecutionAuthorized).toBe(false);
    expect(result.historicalHumanAuthorizationSigned).toBe(false);
  });
  it.each([
    ['missing authorization', { authorizationStatus: 'MISSING' }],
    ['unsigned authorization', { signaturePresent: false }],
    ['do not authorize decision', { authorizationDecision: 'DO_NOT_AUTHORIZE' }],
    ['execution authorization false', { executionAuthorized: false }],
    ['wrong experiment', { authorizationExperimentMatches: false }],
    ['authorization hash mismatch', { frozenArtifactHashesMatch: false }],
    ['frozen manifest mismatch', { frozenArtifactHashesMatch: false }],
    ['technical prevalidation not pass', { technicalPrevalidation: 'FAIL' }],
    ['modified authorization after signature', { activationArtifactValid: false }],
    ['missing applicability review', { authorizationApplicabilityReview: undefined }],
    ['unknown applicability review', { authorizationApplicabilityReview: 'UNKNOWN' }],
    ['reauthorization required', { authorizationApplicabilityReview: 'REAUTHORIZATION_REQUIRED' }]
  ])('blocks %s', (_name, override) => {
    const authority: AuthorityInput = {
      experimentId: 'PRAETOR-VERIFY-001', technicalPrevalidation: 'PASS', eligibility: 'ELIGIBLE_FOR_HUMAN_EXECUTION_DECISION',
      authorizationStatus: 'APPROVED_SIGNED', authorizationDecision: 'APPROVE_FOR_EXECUTION', executionAuthorized: true,
      signaturePresent: true, datePresent: true, authorizationExperimentMatches: true, frozenArtifactHashesMatch: true,
      repositoryClean: true, holdoutAccessStatus: 'NOT_ACCESSED', executionPerformed: false,
      historicalExecutionAuthorized: false, historicalHumanAuthorizationSigned: false, activationArtifactValid: true,
      applicabilityArtifactValid: true,
      authorizationApplicabilityReview: 'PENDING',
      ...override
    };
    expect(deriveG3BExecutionAuthority(authority).effectiveExecutionAuthorized).toBe(false);
  });
  it('permits effective authority only after explicit applicability approval', () => {
    const authority: AuthorityInput = {
      experimentId: 'PRAETOR-VERIFY-001', technicalPrevalidation: 'PASS', eligibility: 'ELIGIBLE_FOR_HUMAN_EXECUTION_DECISION',
      authorizationStatus: 'APPROVED_SIGNED', authorizationDecision: 'APPROVE_FOR_EXECUTION', executionAuthorized: true,
      signaturePresent: true, datePresent: true, authorizationExperimentMatches: true, frozenArtifactHashesMatch: true,
      repositoryClean: true, holdoutAccessStatus: 'NOT_ACCESSED', executionPerformed: false,
      historicalExecutionAuthorized: false, historicalHumanAuthorizationSigned: false, activationArtifactValid: true,
      applicabilityArtifactValid: true,
      authorizationApplicabilityReview: 'AUTHORIZATION_REMAINS_APPLICABLE'
    };
    expect(deriveG3BExecutionAuthority(authority).effectiveExecutionAuthorized).toBe(true);
  });
  it('keeps missing evidence distinct from contradictory evidence', () => {
    const base = { claim_family: 'permission', schema_valid: true, duplicate_lineage: false, provenance_complete: true, authority_present: true, authority_valid: true, proof_available: true, proof_supports_claim: true, tool_permission: 'granted', requested_tool: 'synthetic_read', record_tool: 'synthetic_read', requested_action: 'review', record_action: 'review' };
    expect(adjudicateG3B({ ...base, proof_available: false, proof_supports_claim: false }).disposition).toBe('NON_CERTIFIED');
    expect(adjudicateG3B({ ...base, proof_supports_claim: false }).disposition).toBe('REJECTED');
  });
  it('uses the same case fingerprint independently of search condition', () => {
    const candidate = { partition: 'G3B_STRUCTURED_CANDIDATE', source_id: 'same', claim_family: 'permission', contradiction_score: 0 };
    expect(caseFingerprint(candidate)).toBe(caseFingerprint({ ...candidate }));
  });
  it('verifies the frozen design matrix and keeps holdout unevaluated', () => {
    const root = new URL('../experiments/praetor_verify_001/g3b/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('G3B_PRE_EXECUTION_MANIFEST.json', root), 'utf8'));
    const partitions = JSON.parse(readFileSync(new URL('g3b-partitions.json', root), 'utf8'));
    expect(manifest.design_cells).toBe(60);
    expect(manifest.g3b_execution_authorized).toBe(false);
    expect(manifest.g3b_comparative_observations).toBe(0);
    expect(manifest.holdout_evaluated).toBe(false);
    expect(partitions.structural_contamination_audit.result).toBe('PASS');
    for (const [name, expected] of Object.entries(manifest.components)) {
      const bytes = readFileSync(new URL(name.includes('/') ? `../${name}` : name, root));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected);
    }
  });
});