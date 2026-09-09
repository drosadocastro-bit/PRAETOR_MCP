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
};

export type AuthorityDecision = AuthorityInput & {
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
  return { ...input, effectiveExecutionAuthorized: failedConditions.length === 0, failedConditions };
}

function currentRepositoryIsClean() {
  return execFileSync('git', ['status', '--porcelain'], { cwd: resolve(root, '../../..'), encoding: 'utf8' }).trim() === '';
}

export function readG3BAuthorityInput(repositoryClean = currentRepositoryIsClean()): AuthorityInput {
  const manifest = readJson<{ components: Record<string, string>; g3b_execution_authorized: boolean; execution_ready: boolean }>('G3B_PRE_EXECUTION_MANIFEST.json');
  const receipt = readJson<{ human_g3b_authorization_signed: boolean; g3b_execution_authorized: boolean }>('G3B_START-RECEIPT.json');
  const authorization = readJson<{ version: string; status: string; decision: string; execution_authorized: boolean; reviewer: string | null; signature: string | null; date: string | null }>('G3B_HUMAN_EXECUTION_AUTHORIZATION.json');
  const prevalidation = readJson<{ runtime_prevalidation: string; eligibility: string }>('G3B_RUNTIME_PREVALIDATION.json');
  const activation = readJson<{ experiment_id: string; frozen_references: { manifest: { path: string; sha256: string }; receipt: { path: string; sha256: string } }; technical_prevalidation: { artifact: string; sha256: string; result: string; eligibility: string }; later_human_authorization: { artifact: string; sha256: string; status: string; decision: string; execution_authorized: boolean }; derived_state: { holdout_access_status: string; execution_performed: boolean }; append_only_statement: string }>('G3B_EXECUTION_AUTHORITY_ACTIVATION.json');
  const actualComponentHashes = Object.fromEntries(Object.keys(manifest.components).map(name => [name, byteHash(readFileSync(name.includes('/') ? resolve(root, '..', name) : resolve(root, name)))]));
  const frozenArtifactHashesMatch = JSON.stringify(actualComponentHashes) === JSON.stringify(manifest.components)
    && activation.frozen_references.manifest.sha256 === sha256('G3B_PRE_EXECUTION_MANIFEST.json')
    && activation.frozen_references.receipt.sha256 === sha256('G3B_START-RECEIPT.json')
    && activation.technical_prevalidation.sha256 === sha256('G3B_RUNTIME_PREVALIDATION.json')
    && activation.later_human_authorization.sha256 === sha256('G3B_HUMAN_EXECUTION_AUTHORIZATION.json');
  const activationArtifactValid = activation.experiment_id === 'PRAETOR-VERIFY-001'
    && activation.technical_prevalidation.result === prevalidation.runtime_prevalidation
    && activation.technical_prevalidation.eligibility === prevalidation.eligibility
    && activation.later_human_authorization.status === authorization.status
    && activation.later_human_authorization.decision === authorization.decision
    && activation.later_human_authorization.execution_authorized === authorization.execution_authorized
    && activation.append_only_statement.length > 0
    && activation.derived_state.holdout_access_status === 'NOT_ACCESSED'
    && activation.derived_state.execution_performed === false;
  return {
    experimentId: activation.experiment_id,
    technicalPrevalidation: prevalidation.runtime_prevalidation,
    eligibility: prevalidation.eligibility,
    authorizationStatus: authorization.status,
    authorizationDecision: authorization.decision,
    executionAuthorized: authorization.execution_authorized,
    signaturePresent: typeof authorization.signature === 'string' && authorization.signature.length > 0,
    datePresent: typeof authorization.date === 'string' && authorization.date.length > 0,
    authorizationExperimentMatches: activation.experiment_id === 'PRAETOR-VERIFY-001' && activation.later_human_authorization.artifact === 'G3B_HUMAN_EXECUTION_AUTHORIZATION.json',
    frozenArtifactHashesMatch,
    repositoryClean,
    holdoutAccessStatus: activation.derived_state.holdout_access_status,
    executionPerformed: activation.derived_state.execution_performed,
    historicalExecutionAuthorized: manifest.g3b_execution_authorized,
    historicalHumanAuthorizationSigned: receipt.human_g3b_authorization_signed,
    activationArtifactValid
  };
}

export function assertG3BEffectiveExecutionAuthority() {
  const decision = deriveG3BExecutionAuthority(readG3BAuthorityInput());
  if (!decision.effectiveExecutionAuthorized) throw new Error(`G3B_EXECUTION_BLOCKED:${decision.failedConditions.join(',')}`);
  return decision;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) assertG3BEffectiveExecutionAuthority();
