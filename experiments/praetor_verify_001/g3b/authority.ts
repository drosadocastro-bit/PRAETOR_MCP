import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { byteHash } from '../g3a/contract.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const readJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(root, name), 'utf8')) as T;
const sha256 = (name: string) => byteHash(readFileSync(resolve(root, name)));

export type AuthorityInput = {
  experimentId: string;
  technicalPrevalidation: string;
  eligibility: string;
  authorizationStatus: string;
  authorizationDecision: string;
  executionAuthorized: boolean;
  signaturePresent: boolean;
  datePresent: boolean;
  authorizationExperimentMatches: boolean;
  frozenArtifactHashesMatch: boolean;
  repositoryClean: boolean;
  holdoutAccessStatus: string;
  executionPerformed: boolean;
  historicalExecutionAuthorized: boolean;
  historicalHumanAuthorizationSigned: boolean;
  activationArtifactValid: boolean;
  authorizationApplicabilityReview: string | undefined;
};

export type AuthorityDecision = AuthorityInput & {
  authorityChainValid: boolean;
  effectiveExecutionAuthorized: boolean;
  failedConditions: string[];
};

export function deriveG3BExecutionAuthority(input: AuthorityInput): AuthorityDecision {
  const conditions: Array<[string, boolean]> = [
    ['experiment_id_matches', input.experimentId === 'PRAETOR-VERIFY-001'],
    ['technical_prevalidation_pass', input.technicalPrevalidation === 'PASS'],
    ['eligibility_is_for_human_execution_decision', input.eligibility === 'ELIGIBLE_FOR_HUMAN_EXECUTION_DECISION'],
    ['authorization_status_approved_signed', input.authorizationStatus === 'APPROVED_SIGNED'],
    ['authorization_decision_approve_for_execution', input.authorizationDecision === 'APPROVE_FOR_EXECUTION'],
    ['authorization_execution_authorized_true', input.executionAuthorized === true],
    ['signature_present', input.signaturePresent],
    ['date_present', input.datePresent],
    ['authorization_experiment_matches', input.authorizationExperimentMatches],
    ['frozen_artifact_hashes_match', input.frozenArtifactHashesMatch],
    ['repository_clean', input.repositoryClean],
    ['holdout_not_accessed', input.holdoutAccessStatus === 'NOT_ACCESSED'],
    ['execution_not_performed', input.executionPerformed === false],
    ['activation_artifact_valid', input.activationArtifactValid]
  ];
  const failedConditions = conditions.filter(([, passed]) => !passed).map(([name]) => name);
  const authorityChainValid = failedConditions.length === 0;
  const applicabilityPass = input.authorizationApplicabilityReview === 'AUTHORIZATION_REMAINS_APPLICABLE';
  return {
    ...input,
    authorityChainValid,
    effectiveExecutionAuthorized: authorityChainValid && applicabilityPass,
    failedConditions: applicabilityPass ? failedConditions : [...failedConditions, 'authorization_applicability_review_pass']
  };
}

function currentRepositoryIsClean() {
  return execFileSync('git', ['status', '--porcelain'], { cwd: resolve(root, '../../..'), encoding: 'utf8' }).trim() === '';
}

export function readG3BAuthorityInput(repositoryClean = currentRepositoryIsClean()): AuthorityInput {
  const manifest = readJson<{ components: Record<string, string>; g3b_execution_authorized: boolean; execution_ready: boolean }>('G3B_PRE_EXECUTION_MANIFEST.json');
  const receipt = readJson<{ human_g3b_authorization_signed: boolean; g3b_execution_authorized: boolean }>('G3B_START-RECEIPT.json');
  const authorization = readJson<{ version: string; status: string; decision: string; execution_authorized: boolean; reviewer: string | null; signature: string | null; date: string | null }>('G3B_HUMAN_EXECUTION_AUTHORIZATION.json');
  const prevalidation = readJson<{ runtime_prevalidation: string; eligibility: string }>('G3B_RUNTIME_PREVALIDATION.json');
  const activation = readJson<{ experiment_id: string; frozen_references: { manifest_sha256: string; receipt_sha256: string; prevalidation_sha256: string; authorization_sha256: string }; authority_chain: { technical_prevalidation: string; eligibility: string; authorization_status: string; authorization_decision: string; execution_authorized: boolean; authority_chain_valid: boolean }; authorization_applicability_review: string; effective_execution_authorized: boolean; holdout_access_status: string; execution_performed: boolean; append_only_statement: string }>('G3B_EXECUTION_AUTHORITY_ACTIVATION_V2.json');
  const actualComponentHashes = Object.fromEntries(Object.keys(manifest.components).map(name => [name, byteHash(readFileSync(name.includes('/') ? resolve(root, '..', name) : resolve(root, name)))]));
  const frozenArtifactHashesMatch = JSON.stringify(actualComponentHashes) === JSON.stringify(manifest.components)
    && activation.frozen_references.manifest_sha256 === sha256('G3B_PRE_EXECUTION_MANIFEST.json')
    && activation.frozen_references.receipt_sha256 === sha256('G3B_START-RECEIPT.json')
    && activation.frozen_references.prevalidation_sha256 === sha256('G3B_RUNTIME_PREVALIDATION.json')
    && activation.frozen_references.authorization_sha256 === sha256('G3B_HUMAN_EXECUTION_AUTHORIZATION.json');
  const activationArtifactValid = activation.experiment_id === 'PRAETOR-VERIFY-001'
    && activation.authority_chain.technical_prevalidation === prevalidation.runtime_prevalidation
    && activation.authority_chain.eligibility === prevalidation.eligibility
    && activation.authority_chain.authorization_status === authorization.status
    && activation.authority_chain.authorization_decision === authorization.decision
    && activation.authority_chain.execution_authorized === authorization.execution_authorized
    && activation.authority_chain.authority_chain_valid === true
    && activation.effective_execution_authorized === false
    && activation.append_only_statement.length > 0
    && activation.holdout_access_status === 'NOT_ACCESSED'
    && activation.execution_performed === false;
  return {
    experimentId: activation.experiment_id,
    technicalPrevalidation: prevalidation.runtime_prevalidation,
    eligibility: prevalidation.eligibility,
    authorizationStatus: authorization.status,
    authorizationDecision: authorization.decision,
    executionAuthorized: authorization.execution_authorized,
    signaturePresent: typeof authorization.signature === 'string' && authorization.signature.length > 0,
    datePresent: typeof authorization.date === 'string' && authorization.date.length > 0,
    authorizationExperimentMatches: activation.experiment_id === 'PRAETOR-VERIFY-001',
    frozenArtifactHashesMatch,
    repositoryClean,
    holdoutAccessStatus: activation.holdout_access_status,
    executionPerformed: activation.execution_performed,
    historicalExecutionAuthorized: manifest.g3b_execution_authorized,
    historicalHumanAuthorizationSigned: receipt.human_g3b_authorization_signed,
    activationArtifactValid,
    authorizationApplicabilityReview: activation.authorization_applicability_review
  };
}

export function assertG3BEffectiveExecutionAuthority() {
  const decision = deriveG3BExecutionAuthority(readG3BAuthorityInput());
  if (!decision.effectiveExecutionAuthorized) throw new Error(`G3B_EXECUTION_BLOCKED:${decision.failedConditions.join(',')}`);
  return decision;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) assertG3BEffectiveExecutionAuthority();
