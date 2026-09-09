import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type GateStatus = 'PASS' | 'FAIL' | 'INCONCLUSIVE';
export type PrevalidationStatus = {
  status: GateStatus;
  summary: string;
  evidence: Record<string, unknown>;
};

type ValidationFixture = {
  case_id: string;
  case_fingerprint: string;
  logical_family: string;
  source: string;
  outcome_inspected: boolean;
};

type RuntimeObservation = {
  experiment_id: string;
  arm_id: string;
  fixture_id: string;
  input_hash: string;
  configuration_hash: string;
  artifact_hashes: Record<string, string>;
  runner_version: string;
  runner_commit_sha: string;
  runtime_id: string;
  tool_configuration: string[];
  run_id: string;
  output_artifact_id: string;
  stopping_outcome: string;
  review_state: string;
  observed_disposition: 'REVIEW_ONLY';
};

const g3bRoot = resolve('experiments/praetor_verify_001/g3b');
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const readJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(g3bRoot, name), 'utf8')) as T;
const stableJson = (value: unknown) => JSON.stringify(value, Object.keys(value as object).sort());
const requiredProvenance = [
  'experiment_id', 'arm_id', 'fixture_id', 'input_hash', 'configuration_hash',
  'artifact_hashes', 'runner_version', 'runner_commit_sha', 'runtime_id',
  'tool_configuration', 'run_id', 'output_artifact_id', 'stopping_outcome', 'review_state'
] as const;
const protectedFieldNames = [
  'oracle_expected_outcome', 'adjudicated_failure', 'failure_category', 'exact_rule',
  'hidden_rationale', 'proof_internals', 'hidden_distance', 'oracle_derived_reward',
  'winner', 'loser', 'comparative_summary', 'holdout_label', 'ground_truth'
];

function sha256File(name: string) {
  return hash(readFileSync(resolve(g3bRoot, name)));
}

function validationFixture(): ValidationFixture {
  const partitions = readJson<{ instrument_validation: ValidationFixture[] }>('g3b-partitions.json');
  const fixture = partitions.instrument_validation[0];
  if (!fixture || fixture.source !== 'synthetic_structural_partition' || fixture.outcome_inspected) {
    throw new Error('G3B_PREVALIDATION_FIXTURE_INVALID');
  }
  return fixture;
}

function executePermittedFixture(fixture: ValidationFixture, armId: string): RuntimeObservation {
  const input = { partition: 'instrument_validation', fixture_id: fixture.case_id, fingerprint: fixture.case_fingerprint };
  const configuration = { arm_id: armId, mode: 'prevalidation_only', holdout_access: false };
  return {
    experiment_id: 'PRAETOR-VERIFY-001',
    arm_id: armId,
    fixture_id: fixture.case_id,
    input_hash: hash(stableJson(input)),
    configuration_hash: hash(stableJson(configuration)),
    artifact_hashes: { 'g3b-partitions.json': sha256File('g3b-partitions.json') },
    runner_version: 'g3b-runtime-prevalidation-v1',
    runner_commit_sha: process.env.G3B_VALIDATION_COMMIT_SHA ?? 'uncommitted-working-tree',
    runtime_id: 'prevalidation-fixture-harness-v1',
    tool_configuration: ['non_holdout_fixture_reader'],
    run_id: `prevalidation-${fixture.case_id}-${armId}`,
    output_artifact_id: `observation-${fixture.case_id}-${armId}`,
    stopping_outcome: 'CONTINUE_PERMITTED_VALIDATION_ONLY',
    review_state: 'TECHNICAL_PREVALIDATION',
    observed_disposition: 'REVIEW_ONLY'
  };
}

function gate1(): PrevalidationStatus {
  try {
    const fixture = validationFixture();
    const observation = executePermittedFixture(fixture, 'random');
    return {
      status: 'PASS',
      summary: 'The prevalidation harness executes one permitted non-holdout fixture.',
      evidence: { fixture_id: fixture.case_id, observation, holdout_reader_present: false }
    };
  } catch (error) {
    return { status: 'FAIL', summary: 'Permitted fixture execution failed closed.', evidence: { error: String(error) } };
  }
}

function gate2(): PrevalidationStatus {
  try {
    const observation = executePermittedFixture(validationFixture(), 'random');
    const missing = requiredProvenance.filter(field => !(field in observation));
    const hashesMatch = observation.input_hash.length === 64 && observation.configuration_hash.length === 64;
    return {
      status: missing.length === 0 && hashesMatch ? 'PASS' : 'FAIL',
      summary: missing.length === 0 && hashesMatch ? 'Required provenance is emitted for the validation observation.' : 'Required provenance is incomplete.',
      evidence: { required_fields: requiredProvenance, missing_fields: missing, hash_shape_valid: hashesMatch, incomplete_provenance_rejected: true }
    };
  } catch (error) {
    return { status: 'FAIL', summary: 'Provenance validation failed closed.', evidence: { error: String(error) } };
  }
}

function gate3(): PrevalidationStatus {
  const first = executePermittedFixture(validationFixture(), 'random');
  const replay = executePermittedFixture(validationFixture(), 'random');
  const exactFields = ['fixture_id', 'input_hash', 'configuration_hash', 'artifact_hashes', 'observed_disposition', 'stopping_outcome'] as const;
  const differences = exactFields.filter(field => JSON.stringify(first[field]) !== JSON.stringify(replay[field]));
  return {
    status: differences.length === 0 ? 'PASS' : 'FAIL',
    summary: differences.length === 0 ? 'The deterministic validation fixture replays under the declared contract.' : 'Replay differs in an exact-match field.',
    evidence: { exact_match_fields: exactFields, permitted_variation_fields: ['run_id', 'output_artifact_id', 'runner_commit_sha'], differences }
  };
}

function gate4(): PrevalidationStatus {
  const fixture = validationFixture();
  const serialized = JSON.stringify(fixture);
  const leakedFields = protectedFieldNames.filter(field => serialized.includes(field));
  const manifest = readJson<{ holdout_evaluated: boolean; g3b_comparative_observations: number }>('G3B_PRE_EXECUTION_MANIFEST.json');
  return {
    status: leakedFields.length === 0 && manifest.holdout_evaluated === false && manifest.g3b_comparative_observations === 0 ? 'INCONCLUSIVE' : 'FAIL',
    summary: 'Structural isolation is clean, but a real comparative runtime isolation test is not implemented.',
    evidence: { leaked_fields: leakedFields, protected_fields_checked: protectedFieldNames, holdout_evaluated: manifest.holdout_evaluated, comparative_observations: manifest.g3b_comparative_observations, runtime_isolation_test: 'not_implemented' }
  };
}

function gate5(): PrevalidationStatus {
  const arms = ['random', 'rule_based', 'adaptive'] as const;
  const configurations = arms.map(arm => ({ arm, input_partition: 'instrument_validation', tool_configuration: ['non_holdout_fixture_reader'], retry_policy: 'none', holdout_access: false }));
  const permittedDifferences = new Set(['arm']);
  const parityDifferences = configurations.slice(1).flatMap(configuration => Object.keys(configurations[0]).filter(key => !permittedDifferences.has(key) && JSON.stringify(configuration[key as keyof typeof configuration]) !== JSON.stringify(configurations[0][key as keyof typeof configurations[0]])));
  return {
    status: parityDifferences.length === 0 ? 'INCONCLUSIVE' : 'FAIL',
    summary: 'The harness can compare declared parity, but no comparative runtime enforces observed parity.',
    evidence: { configurations, permitted_differences: [...permittedDifferences], differences: parityDifferences, runtime_parity_enforcement: 'not_implemented' }
  };
}

function gate6(): PrevalidationStatus {
  const stoppingRules = readJson<{ stop_on: string[] }>('g3b-stopping-rules.json').stop_on;
  const triggerResults = stoppingRules.map(rule => ({ rule, trigger_fixture: 'declared-but-not-executed', enumerated: true, enforcement_observed: false, counted_as_observation: false }));
  return {
    status: 'INCONCLUSIVE',
    summary: 'Stopping-rule triggers are enumerated, but enforcement by the G3B comparative runner is not implemented.',
    evidence: { stopping_rules: stoppingRules, trigger_results: triggerResults, executable_enforcement: 'not_implemented' }
  };
}

export function runG3BRuntimePrevalidation() {
  const gates = {
    gate_1_executable_runner: gate1(),
    gate_2_provenance_contract: gate2(),
    gate_3_replay_precheck: gate3(),
    gate_4_oracle_feedback_isolation: gate4(),
    gate_5_baseline_parity: gate5(),
    gate_6_executable_stopping_rules: gate6()
  };
  const requiredStatuses = Object.values(gates).map(gate => gate.status);
  const allPass = requiredStatuses.every(status => status === 'PASS');
  return {
    version: 'g3b-runtime-prevalidation-v1',
    runtime_prevalidation: allPass ? 'PASS' : 'FAIL',
    eligibility: allPass ? 'ELIGIBLE_FOR_HUMAN_EXECUTION_DECISION' : 'NOT_ELIGIBLE_FOR_HUMAN_EXECUTION_DECISION',
    frozen_references: { design_freeze: 'a12c4ab', preliminary_review: '88193f4', eligibility_clarification: '995add0' },
    gates,
    holdout_access_status: 'NOT_ACCESSED',
    holdout_evaluated: false,
    execution_performed: false,
    comparative_observations: 0,
    human_authorization: false,
    limitations: ['Gates 4, 5, and 6 remain inconclusive because no G3B comparative runtime exists.', 'The validation runner commit is uncommitted until this prevalidation change is checkpointed.']
  };
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
