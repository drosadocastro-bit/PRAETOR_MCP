import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveG3BExecutionAuthority, readG3BAuthorityInput, type AuthorityInput } from '../experiments/praetor_verify_001/g3b/authority.js';
import { validateG3BActivationArtifact, type ActivationValidityContext } from '../experiments/praetor_verify_001/g3b/activation-validity.js';

const root = new URL('../experiments/praetor_verify_001/g3b/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8')) as Record<string, any>;
const hash = (name: string) => createHash('sha256').update(readFileSync(new URL(name, root))).digest('hex');

function context(): ActivationValidityContext {
  return {
    activation: read('G3B_EXECUTION_AUTHORITY_ACTIVATION_V2.json'),
    activationV1: read('G3B_EXECUTION_AUTHORITY_ACTIVATION.json'),
    contract: read('G3B_EXECUTION_AUTHORITY_CONTRACT_V2.json'),
    manifest: read('G3B_PRE_EXECUTION_MANIFEST.json'),
    receipt: read('G3B_START-RECEIPT.json'),
    prevalidation: read('G3B_RUNTIME_PREVALIDATION.json'),
    authorization: read('G3B_HUMAN_EXECUTION_AUTHORIZATION.json'),
    supersession: read('G3B_EXECUTION_AUTHORITY_SUPERSESSION.json'),
    actualHashes: {
      manifest: hash('G3B_PRE_EXECUTION_MANIFEST.json'),
      receipt: hash('G3B_START-RECEIPT.json'),
      prevalidation: hash('G3B_RUNTIME_PREVALIDATION.json'),
      authorization: hash('G3B_HUMAN_EXECUTION_AUTHORIZATION.json')
    },
    currentCommitSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  };
}

describe('G3B activation artifact validity contract', () => {
  it('validates the real v2 activation without changing applicability', () => {
    const result = validateG3BActivationArtifact(context());
    expect(result.activationArtifactValid).toBe(true);
    expect(result.failedChecks).toEqual([]);
    const authorityInput = readG3BAuthorityInput(true);
    expect(authorityInput.activationArtifactValid).toBe(true);
    expect(authorityInput.activationArtifactFailedChecks).toEqual([]);
    const evidence = read('G3B_ACTIVATION_ARTIFACT_VALIDATION.json');
    expect(evidence.activation_artifact_valid).toBe(result.activationArtifactValid);
    expect(evidence.checks).toEqual(result.checks);
    expect(evidence.failed_checks).toEqual(result.failedChecks);
    expect(evidence.holdout_access_status).toBe('NOT_ACCESSED');
    expect(evidence.execution_performed).toBe(false);
    expect(evidence.comparative_observations).toBe(0);
  });

  it.each([
    ['wrong activation version', (value: ActivationValidityContext) => { value.activation.version = 'wrong'; }],
    ['wrong experiment id', (value: ActivationValidityContext) => { value.activation.experiment_id = 'wrong'; }],
    ['wrong contract version', (value: ActivationValidityContext) => { value.contract.version = 'wrong'; }],
    ['manifest hash mismatch', (value: ActivationValidityContext) => { value.activation.frozen_references.manifest_sha256 = '0'.repeat(64); }],
    ['receipt hash mismatch', (value: ActivationValidityContext) => { value.activation.frozen_references.receipt_sha256 = '0'.repeat(64); }],
    ['prevalidation hash mismatch', (value: ActivationValidityContext) => { value.activation.frozen_references.prevalidation_sha256 = '0'.repeat(64); }],
    ['authorization hash mismatch', (value: ActivationValidityContext) => { value.activation.frozen_references.authorization_sha256 = '0'.repeat(64); }],
    ['invalid authorization commit', (value: ActivationValidityContext) => { value.activationV1.later_human_authorization.authorization_commit = '0'.repeat(40); }],
    ['missing supersession', (value: ActivationValidityContext) => { value.activation.supersedes_activation = undefined; }],
    ['circular supersession', (value: ActivationValidityContext) => { value.activation.supersedes_activation = 'g3b-execution-authority-activation-v2'; }],
    ['historical state rewrite', (value: ActivationValidityContext) => { value.activation.historical_state.historical_execution_authorized = true; }],
    ['pending with effective authority', (value: ActivationValidityContext) => { value.activation.effective_execution_authorized = true; }],
    ['reauthorization with effective authority', (value: ActivationValidityContext) => { value.activation.authorization_applicability_review = 'REAUTHORIZATION_REQUIRED'; value.activation.effective_execution_authorized = true; }],
    ['inconsistent holdout access', (value: ActivationValidityContext) => { value.activation.holdout_access_status = 'ACCESSED'; }],
    ['execution before authorization', (value: ActivationValidityContext) => { value.activation.execution_performed = true; }],
    ['comparative observations before execution', (value: ActivationValidityContext) => { value.activation.comparative_observations = 1; }],
    ['self-referential commit provenance', (value: ActivationValidityContext) => { value.activation.activation_parent_commit_sha = value.currentCommitSha; }],
    ['malformed activation schema', (value: ActivationValidityContext) => { value.activation = {}; }]
  ])('fails closed for %s', (_name, mutate) => {
    const value = context();
    mutate(value);
    const result = validateG3BActivationArtifact(value);
    expect(result.activationArtifactValid).toBe(false);
    expect(result.failedChecks.length).toBeGreaterThan(0);
  });

  it('reports the failed activation subcheck through the execution guard', () => {
    const authority: AuthorityInput = {
      experimentId: 'PRAETOR-VERIFY-001', technicalPrevalidation: 'PASS', eligibility: 'ELIGIBLE_FOR_HUMAN_EXECUTION_DECISION',
      authorizationStatus: 'APPROVED_SIGNED', authorizationDecision: 'APPROVE_FOR_EXECUTION', executionAuthorized: true,
      signaturePresent: true, datePresent: true, authorizationExperimentMatches: true, frozenArtifactHashesMatch: true,
      repositoryClean: true, holdoutAccessStatus: 'NOT_ACCESSED', executionPerformed: false,
      historicalExecutionAuthorized: false, historicalHumanAuthorizationSigned: false,
      activationArtifactValid: false,
      activationArtifactFailedChecks: ['activation_artifact_valid.manifest_sha256_matches'],
      applicabilityArtifactValid: true,
      authorizationApplicabilityReview: 'AUTHORIZATION_REMAINS_APPLICABLE'
    };
    const decision = deriveG3BExecutionAuthority(authority);
    expect(decision.effectiveExecutionAuthorized).toBe(false);
    expect(decision.failedConditions).toContain('activation_artifact_valid.manifest_sha256_matches');
  });
});
