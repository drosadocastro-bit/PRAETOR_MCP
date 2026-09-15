export const G3B_EXPERIMENT_ID = 'PRAETOR-VERIFY-001';
export const G3B_AUTHORITY_CONTRACT_VERSION = 'g3b-execution-authority-contract-v2';
export const G3B_ACTIVATION_VERSION = 'g3b-execution-authority-activation-v2';
export const G3B_AUTHORIZATION_COMMIT = 'ac54ec64cfea12bb1aa0d6dc2b497a1eb0b3845c';
export const G3B_DESIGN_FREEZE_COMMIT = 'a12c4ab2da5b79cdfdd77ea9213c29c7943a2428';

export type ActivationValidityResult = {
  activationArtifactValid: boolean;
  checks: Record<string, boolean>;
  failedChecks: string[];
};

type JsonObject = Record<string, any>;

export type ActivationValidityContext = {
  activation: JsonObject;
  activationV1: JsonObject;
  contract: JsonObject;
  manifest: JsonObject;
  receipt: JsonObject;
  prevalidation: JsonObject;
  authorization: JsonObject;
  supersession: JsonObject;
  actualHashes: {
    manifest: string;
    receipt: string;
    prevalidation: string;
    authorization: string;
  };
  currentCommitSha?: string;
};

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const isSha256 = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isCommitSha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const hasString = (object: JsonObject, key: string) => typeof object[key] === 'string' && object[key].length > 0;
const same = (left: unknown, right: unknown) => left === right;

export function validateG3BActivationArtifact(context: ActivationValidityContext): ActivationValidityResult {
  const { activation, activationV1, contract, manifest, receipt, prevalidation, authorization, supersession } = context;
  const references = isObject(activation.frozen_references) ? activation.frozen_references : {};
  const chain = isObject(activation.authority_chain) ? activation.authority_chain : {};
  const historical = isObject(activation.historical_state) ? activation.historical_state : {};
  const checks: Record<string, boolean> = {
    version_valid: activation.version === G3B_ACTIVATION_VERSION,
    experiment_matches: activation.experiment_id === G3B_EXPERIMENT_ID,
    contract_matches: contract.version === G3B_AUTHORITY_CONTRACT_VERSION
      && supersession.superseding_contract === G3B_AUTHORITY_CONTRACT_VERSION,
    frozen_references_match: references.design_freeze_commit === G3B_DESIGN_FREEZE_COMMIT,
    manifest_sha256_matches: references.manifest_sha256 === context.actualHashes.manifest
      && isSha256(references.manifest_sha256),
    receipt_sha256_matches: references.receipt_sha256 === context.actualHashes.receipt
      && isSha256(references.receipt_sha256),
    prevalidation_sha256_matches: references.prevalidation_sha256 === context.actualHashes.prevalidation
      && isSha256(references.prevalidation_sha256),
    authorization_sha256_matches: references.authorization_sha256 === context.actualHashes.authorization
      && isSha256(references.authorization_sha256),
    authorization_commit_matches: activationV1.later_human_authorization?.authorization_commit === G3B_AUTHORIZATION_COMMIT,
    supersession_lineage_valid: activation.supersedes_activation === 'g3b-execution-authority-activation-v1'
      && activationV1.version === 'g3b-execution-authority-activation-v1'
      && supersession.experiment_id === G3B_EXPERIMENT_ID
      && supersession.supersedes_activation === 'g3b-execution-authority-activation-v1'
      && supersession.superseding_activation === 'g3b-execution-authority-activation-v2'
      && supersession.supersedes_activation !== supersession.superseding_activation
      && supersession.superseding_activation !== supersession.supersedes_contract,
    append_only_statement_present: hasString(activation, 'append_only_statement'),
    historical_state_preserved: historical.historical_execution_authorized === manifest.g3b_execution_authorized
      && historical.historical_human_authorization_signed === receipt.human_g3b_authorization_signed
      && historical.historical_execution_authorized === false
      && historical.historical_human_authorization_signed === false,
    effective_authority_fields_consistent: ((activation.authorization_applicability_review === 'PENDING'
      || activation.authorization_applicability_review === 'REAUTHORIZATION_REQUIRED')
      && activation.effective_execution_authorized === false
      || activation.authorization_applicability_review === 'AUTHORIZATION_REMAINS_APPLICABLE')
      && chain.authority_chain_valid === true
      && chain.execution_authorized === authorization.execution_authorized
      && chain.authorization_status === authorization.status
      && chain.authorization_decision === authorization.decision
      && chain.technical_prevalidation === prevalidation.runtime_prevalidation
      && chain.eligibility === prevalidation.eligibility,
    holdout_state_consistent: activation.holdout_access_status === 'NOT_ACCESSED'
      && activation.holdout_evaluated === false,
    execution_state_consistent: activation.execution_performed === false
      && activation.effective_execution_authorized === false,
    comparative_observation_count_consistent: activation.comparative_observations === 0,
    provenance_non_self_referential: isCommitSha(activation.activation_parent_commit_sha)
      && activation.activation_parent_commit_sha !== context.currentCommitSha,
    schema_valid: isObject(activation)
      && hasString(activation, 'version')
      && hasString(activation, 'activation_status')
      && hasString(activation, 'experiment_id')
      && isObject(activation.frozen_references)
      && isObject(activation.authority_chain)
      && isObject(activation.historical_state)
      && typeof activation.effective_execution_authorized === 'boolean'
      && typeof activation.holdout_evaluated === 'boolean'
      && typeof activation.execution_performed === 'boolean'
      && Number.isInteger(activation.comparative_observations)
      && hasString(activation, 'activation_parent_commit_sha')
      && hasString(activation, 'append_only_statement')
  };
  const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => `activation_artifact_valid.${name}`);
  return { activationArtifactValid: failedChecks.length === 0, checks, failedChecks };
}
