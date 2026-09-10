import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { byteHash } from '../g3a/contract.js';
import { validateG3BActivationArtifact } from './activation-validity.js';

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
  activationArtifactFailedChecks?: string[];
  applicabilityArtifactValid: boolean;
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
    ['activation_artifact_valid', input.activationArtifactValid],
    ['applicability_artifact_valid', input.applicabilityArtifactValid]
  ];
  const failedConditions = conditions.flatMap(([name, passed]) => {
    if (passed) return [];
    if (name === 'activation_artifact_valid' && input.activationArtifactFailedChecks?.length) {
      return input.activationArtifactFailedChecks;
    }
    return [name];
  });
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
  const activation = readJson<any>('G3B_EXECUTION_AUTHORITY_ACTIVATION_V2.json');
  const activationV1 = readJson<any>('G3B_EXECUTION_AUTHORITY_ACTIVATION.json');
  const authorityContract = readJson<any>('G3B_EXECUTION_AUTHORITY_CONTRACT_V2.json');
  const supersession = readJson<any>('G3B_EXECUTION_AUTHORITY_SUPERSESSION.json');
  const applicability = readJson<{ version: string; experiment_id: string; reviewer: string; referenced_original_authorization_artifact: string; referenced_original_authorization_sha256: string; referenced_authority_contract_v2: string; referenced_authority_activation_v2: string; referenced_remediation_commit: string; referenced_revalidation_commit: string; decision: string; signature: string | null; date: string | null; human_confirmation: boolean; confirmation_source: string; confirmation_timestamp: string; holdout_access_status: string; execution_performed: boolean; comparative_observations: number; authorization_scope_statement: string }>('G3B_HUMAN_AUTHORIZATION_APPLICABILITY.json');
  const actualComponentHashes = Object.fromEntries(Object.keys(manifest.components).map(name => [name, byteHash(readFileSync(name.includes('/') ? resolve(root, '..', name) : resolve(root, name)))]));
  const frozenArtifactHashesMatch = JSON.stringify(actualComponentHashes) === JSON.stringify(manifest.components)
    && activation.frozen_references.manifest_sha256 === sha256('G3B_PRE_EXECUTION_MANIFEST.json')
    && activation.frozen_references.receipt_sha256 === sha256('G3B_START-RECEIPT.json')
    && activation.frozen_references.prevalidation_sha256 === sha256('G3B_RUNTIME_PREVALIDATION.json')
    && activation.frozen_references.authorization_sha256 === sha256('G3B_HUMAN_EXECUTION_AUTHORIZATION.json');
  const activationValidity = validateG3BActivationArtifact({
    activation,
    activationV1,
    contract: authorityContract,
    manifest,
    receipt,
    prevalidation,
    authorization,
    supersession,
    actualHashes: {
      manifest: sha256('G3B_PRE_EXECUTION_MANIFEST.json'),
      receipt: sha256('G3B_START-RECEIPT.json'),
      prevalidation: sha256('G3B_RUNTIME_PREVALIDATION.json'),
      authorization: sha256('G3B_HUMAN_EXECUTION_AUTHORIZATION.json')
    },
    currentCommitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(root, '../../..'), encoding: 'utf8' }).trim()
  });
  const applicabilityArtifactValid = applicability.version === 'g3b-human-authorization-applicability-v1'
    && applicability.experiment_id === 'PRAETOR-VERIFY-001'
    && applicability.reviewer === authorization.reviewer
    && applicability.referenced_original_authorization_artifact === 'G3B_HUMAN_EXECUTION_AUTHORIZATION.json'
    && applicability.referenced_original_authorization_sha256 === sha256('G3B_HUMAN_EXECUTION_AUTHORIZATION.json')
    && applicability.referenced_authority_contract_v2 === 'G3B_EXECUTION_AUTHORITY_CONTRACT_V2.json'
    && applicability.referenced_authority_activation_v2 === 'G3B_EXECUTION_AUTHORITY_ACTIVATION_V2.json'
    && applicability.referenced_remediation_commit === 'b7e988f156b2bacf51541fc5ecf3b06c3d11ebae'
    && applicability.referenced_revalidation_commit === '97fbe092a8486268d0755145f437c99a7c5e98c7'
    && applicability.decision === 'AUTHORIZATION_REMAINS_APPLICABLE'
    && applicability.signature === null
    && applicability.date === null
    && applicability.human_confirmation === true
    && applicability.confirmation_source === 'EXPLICIT_USER_INSTRUCTION_CURRENT_SESSION'
    && applicability.confirmation_timestamp.length > 0
    && applicability.holdout_access_status === 'NOT_ACCESSED'
    && applicability.execution_performed === false
    && applicability.comparative_observations === 0
    && applicability.authorization_scope_statement.length > 0;
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
    activationArtifactValid: activationValidity.activationArtifactValid,
    activationArtifactFailedChecks: activationValidity.failedChecks,
    applicabilityArtifactValid,
    authorizationApplicabilityReview: applicability.decision
  };
}

export function assertG3BEffectiveExecutionAuthority() {
  const decision = deriveG3BExecutionAuthority(readG3BAuthorityInput());
  if (!decision.effectiveExecutionAuthorized) throw new Error(`G3B_EXECUTION_BLOCKED:${decision.failedConditions.join(',')}`);
  return decision;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) assertG3BEffectiveExecutionAuthority();
