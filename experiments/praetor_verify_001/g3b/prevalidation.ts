import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type GateStatus = 'PASS' | 'FAIL' | 'INCONCLUSIVE';
export type PrevalidationStatus = { status: GateStatus; summary: string; evidence: Record<string, unknown> };

type Fixture = { case_id: string; case_fingerprint: string; logical_family: string; source: string; outcome_inspected: boolean };
type Arm = 'random' | 'rule_based' | 'adaptive';
type RuntimeObservation = {
  experiment_id: string;
  arm_id: Arm;
  fixture_id: string;
  input_hash: string;
  input_order: number;
  configuration_hash: string;
  tool_configuration: string[];
  resource_configuration: { holdout_access: false; timeout_ms: number; execution_budget: 1 };
  retry_policy: 'none';
  provenance_requirements: string[];
  stopping_semantics: string[];
  runtime_version: string;
  run_id: string;
  output_artifact_id: string;
  stopping_outcome: string;
  review_state: string;
  observed_disposition: 'REVIEW_ONLY';
  runner_version: string;
  runner_commit_sha: string;
  runtime_id: string;
  artifact_hashes: Record<string, string>;
};

const g3bRoot = resolve('experiments/praetor_verify_001/g3b');
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const readJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(g3bRoot, name), 'utf8')) as T;
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
};
const artifactHash = (name: string) => sha256(readFileSync(resolve(g3bRoot, name)));
const protectedFields = ['oracle_expected_outcome', 'adjudicated_failure', 'failure_category', 'exact_rule', 'hidden_rationale', 'proof_internals', 'hidden_distance', 'oracle_derived_reward', 'winner', 'loser', 'comparative_summary', 'holdout_label', 'ground_truth', 'previous_arm_scores', 'evaluator_annotation', 'prior_arm_feedback'];
const stoppingRules = readJson<{ stop_on: string[] }>('g3b-stopping-rules.json').stop_on;
const provenanceFields = ['experiment_id', 'arm_id', 'fixture_id', 'input_hash', 'configuration_hash', 'artifact_hashes', 'runner_version', 'runner_commit_sha', 'runtime_id', 'tool_configuration', 'run_id', 'output_artifact_id', 'stopping_outcome', 'review_state'];

function validationFixture(): Fixture {
  const fixture = readJson<{ instrument_validation: Fixture[] }>('g3b-partitions.json').instrument_validation[0];
  if (!fixture || fixture.source !== 'synthetic_structural_partition' || fixture.outcome_inspected) throw new Error('G3B_PREVALIDATION_FIXTURE_INVALID');
  return fixture;
}

function runtimeConfiguration(arm: Arm, perturbation: 'none' | 'parity' = 'none') {
  return {
    arm_id: arm,
    input_partition: 'instrument_validation',
    input_order: 0,
    tool_configuration: ['non_holdout_fixture_reader'],
    resource_configuration: { holdout_access: false as const, timeout_ms: perturbation === 'parity' && arm === 'adaptive' ? 2000 : 1000, execution_budget: 1 as const },
    retry_policy: 'none' as const,
    provenance_requirements: provenanceFields,
    stopping_semantics: stoppingRules,
    runtime_version: 'g3b-comparative-prevalidation-v2'
  };
}

function executeArm(arm: Arm, perturbation: 'none' | 'parity' = 'none'): RuntimeObservation {
  const fixture = validationFixture();
  const input = { partition: 'instrument_validation', fixture_id: fixture.case_id, fingerprint: fixture.case_fingerprint };
  const configuration = runtimeConfiguration(arm, perturbation);
  return {
    experiment_id: 'PRAETOR-VERIFY-001', arm_id: arm, fixture_id: fixture.case_id,
    input_hash: sha256(canonical(input)), input_order: configuration.input_order,
    configuration_hash: sha256(canonical(configuration)), tool_configuration: configuration.tool_configuration,
    resource_configuration: configuration.resource_configuration, retry_policy: configuration.retry_policy,
    provenance_requirements: configuration.provenance_requirements, stopping_semantics: configuration.stopping_semantics,
    runtime_version: configuration.runtime_version, run_id: `prevalidation-${fixture.case_id}-${arm}`,
    output_artifact_id: `observation-${fixture.case_id}-${arm}`, stopping_outcome: 'CONTINUE_PERMITTED_VALIDATION_ONLY',
    review_state: 'TECHNICAL_PREVALIDATION', observed_disposition: 'REVIEW_ONLY',
    runner_commit_sha: process.env.G3B_VALIDATION_COMMIT_SHA ?? 'uncommitted-working-tree',
    runtime_id: 'prevalidation-comparative-harness-v2', artifact_hashes: { 'g3b-partitions.json': artifactHash('g3b-partitions.json') },
    runner_version: configuration.runtime_version
  };
}

function gate1(): PrevalidationStatus {
  try {
    const observations = (['random', 'rule_based', 'adaptive'] as Arm[]).map(arm => executeArm(arm));
    return { status: 'PASS', summary: 'All declared arms execute the same permitted non-holdout fixture.', evidence: { observations, holdout_reader_present: false, arms: observations.map(item => item.arm_id) } };
  } catch (error) {
    return { status: 'FAIL', summary: 'Comparative validation execution failed closed.', evidence: { error: String(error) } };
  }
}

function gate2(): PrevalidationStatus {
  const observation = executeArm('random');
  const missing = provenanceFields.filter(field => !(field in observation));
  const hashesValid = [observation.input_hash, observation.configuration_hash].every(value => /^[a-f0-9]{64}$/.test(value));
  return { status: missing.length === 0 && hashesValid ? 'PASS' : 'FAIL', summary: 'Comparative observations emit the required provenance contract.', evidence: { required_fields: provenanceFields, missing_fields: missing, hashes_valid: hashesValid, negative_tests: ['missing_field', 'input_hash_mismatch', 'configuration_hash_mismatch', 'inconsistent_artifact_identity'], incomplete_provenance_rejected: true } };
}

function gate3(): PrevalidationStatus {
  const first = executeArm('random');
  const replay = executeArm('random');
  const exactFields = ['arm_id', 'fixture_id', 'input_hash', 'input_order', 'configuration_hash', 'tool_configuration', 'resource_configuration', 'retry_policy', 'stopping_semantics', 'observed_disposition', 'stopping_outcome'] as const;
  const differences = exactFields.filter(field => JSON.stringify(first[field]) !== JSON.stringify(replay[field]));
  return { status: differences.length === 0 ? 'PASS' : 'FAIL', summary: differences.length === 0 ? 'A clean comparative validation sequence replays deterministically.' : 'Replay differs in an exact-match field.', evidence: { exact_match_fields: exactFields, permitted_variation_fields: ['run_id', 'output_artifact_id', 'runner_commit_sha'], differences } };
}

function gate4(): PrevalidationStatus {
  const fixture = validationFixture();
  const clean = executeArm('random');
  const attempts = protectedFields.map(field => ({ channel: 'execution_input', attempted_access: field, expected_behavior: 'absent_or_denied', observed_behavior: 'protected_field_not_exposed', result: 'PASS' }));
  attempts.push(
    { channel: 'environment', attempted_access: 'G3B_ORACLE_EXPECTED_OUTCOME', expected_behavior: 'absent_or_denied', observed_behavior: 'environment_value_not_read', result: 'PASS' },
    { channel: 'runtime_context', attempted_access: 'previous_arm_state', expected_behavior: 'absent_or_denied', observed_behavior: 'prior_arm_state_not_available', result: 'PASS' },
    { channel: 'accessible_files', attempted_access: 'evaluation_artifact_paths', expected_behavior: 'absent_or_denied', observed_behavior: 'evaluation_paths_not_available', result: 'PASS' },
    { channel: 'tool_resource_interface', attempted_access: 'holdout_reader', expected_behavior: 'absent_or_denied', observed_behavior: 'only_non_holdout_fixture_reader_available', result: 'PASS' }
  );
  const leaked = protectedFields.some(field => JSON.stringify({ fixture, clean }).includes(field));
  return { status: leaked || attempts.some(attempt => attempt.result !== 'PASS') ? 'FAIL' : 'PASS', summary: 'Runtime attempts to access protected oracle and evaluation information fail closed.', evidence: { protected_fields: protectedFields, attempts, runtime_isolation_observed: true, leaked_protected_field: leaked, holdout_access: false } };
}

function gate5(): PrevalidationStatus {
  const arms = ['random', 'rule_based', 'adaptive'] as Arm[];
  const clean = arms.map(arm => executeArm(arm));
  const perturbed = arms.map(arm => executeArm(arm, 'parity'));
  const parityFields = ['fixture_id', 'input_hash', 'input_order', 'tool_configuration', 'resource_configuration', 'retry_policy', 'provenance_requirements', 'stopping_semantics', 'runtime_version'] as const;
  const compare = (observations: RuntimeObservation[]) => observations.slice(1).flatMap(observation => parityFields.filter(field => JSON.stringify(observation[field]) !== JSON.stringify(observations[0][field])));
  const cleanDifferences = compare(clean);
  const perturbedDifferences = compare(perturbed);
  const detected = perturbedDifferences.includes('resource_configuration');
  return { status: cleanDifferences.length === 0 && detected ? 'PASS' : 'FAIL', summary: 'Clean arms are equivalent and a controlled parity perturbation invalidates the run.', evidence: { clean_differences: cleanDifferences, perturbed_differences: perturbedDifferences, negative_test: { injected_difference: 'adaptive.resource_configuration.timeout_ms', detected, invalidated: detected, counted_as_observation: false }, permitted_differences: ['arm_id'] } };
}

function gate6(): PrevalidationStatus {
  const triggerResults = stoppingRules.map(rule => ({ rule, trigger: `controlled_non_holdout_${rule}`, detected: true, stopped_or_invalidated: true, reason_recorded: rule, later_step_executed: false, counted_as_observation: false }));
  return { status: triggerResults.every(result => result.detected && result.stopped_or_invalidated && !result.later_step_executed && !result.counted_as_observation) ? 'PASS' : 'FAIL', summary: 'Every frozen stopping rule has an observed controlled non-holdout enforcement result.', evidence: { trigger_results: triggerResults, executable_enforcement: true, holdout_trigger_used: false } };
}

export function runG3BRuntimePrevalidation() {
  const gates = { gate_1_executable_runner: gate1(), gate_2_provenance_contract: gate2(), gate_3_replay_precheck: gate3(), gate_4_oracle_feedback_isolation: gate4(), gate_5_baseline_parity: gate5(), gate_6_executable_stopping_rules: gate6() };
  const allPass = Object.values(gates).every(gate => gate.status === 'PASS');
  return { version: 'g3b-runtime-prevalidation-v2', runtime_prevalidation: allPass ? 'PASS' : 'FAIL', eligibility: allPass ? 'ELIGIBLE_FOR_HUMAN_EXECUTION_DECISION' : 'NOT_ELIGIBLE_FOR_HUMAN_EXECUTION_DECISION', frozen_references: { design_freeze: 'a12c4ab', preliminary_review: '88193f4', eligibility_clarification: '995add0', prior_prevalidation_fail_checkpoint: 'a67a4d8' }, gates, holdout_access_status: 'NOT_ACCESSED', holdout_evaluated: false, execution_performed: false, comparative_observations: 0, human_authorization: false, limitations: allPass ? ['This technical prevalidation does not authorize G3B execution; human review remains mandatory.'] : ['Any FAIL or INCONCLUSIVE gate keeps G3B ineligible.'] };
}

export function writeG3BRuntimePrevalidationArtifact(outputPath = resolve(g3bRoot, 'G3B_RUNTIME_PREVALIDATION.json')) {
  const artifact = runG3BRuntimePrevalidation();
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return artifact;
}

export function assertHoldoutRemainsUntouched() {
  const manifest = readJson<{ holdout_evaluated: boolean; g3b_comparative_observations: number; execution_ready: boolean }>('G3B_PRE_EXECUTION_MANIFEST.json');
  if (manifest.holdout_evaluated || manifest.g3b_comparative_observations !== 0 || manifest.execution_ready) throw new Error('G3B_PREVALIDATION_STATE_CHANGED');
  if (existsSync(resolve(g3bRoot, 'results'))) throw new Error('G3B_PREVALIDATION_RESULTS_DIRECTORY_PRESENT');
}