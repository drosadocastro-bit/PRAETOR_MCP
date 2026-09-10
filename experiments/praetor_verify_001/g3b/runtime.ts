import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adjudicateG3B, type G3BDecision } from './oracle.js';
import { mapFailure } from './failure-mapping.js';
import { mapAdaptiveAction, type AdaptiveAction, type AdaptiveContext, type CandidateReference } from './adaptive-action.js';

export const RUNTIME_VERSION = 'g3b-executable-runtime-v1';
export const RUNNER_STATUS = 'FROZEN_NON_HOLDOUT_VALIDATION_ONLY';
export const EXECUTION_REVIEW_STATUS = 'REAUTHORIZATION_REQUIRED';
export const ARMS = ['random', 'rule_based', 'adaptive'] as const;
export type Arm = typeof ARMS[number];
export const REGIMES = ['G3-observable', 'G3-white-box'] as const;
export type Regime = typeof REGIMES[number];

const root = resolve('experiments/praetor_verify_001/g3b');
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
};
const hash = (value: unknown) => sha256(canonical(value));
const readJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(root, name), 'utf8')) as T;

export type G3BCandidate = {
  partition: 'G3B_STRUCTURED_CANDIDATE'; synthetic: true; source_id: string;
  claim_family: 'permission' | 'semantic' | 'human' | 'universal'; claim_universality: 'bounded' | 'universal';
  requested_tool: 'synthetic_read' | 'synthetic_inspect'; requested_action: 'review';
  record_tool: 'synthetic_read' | 'synthetic_inspect'; record_action: 'review';
  provenance_complete: boolean; authority_present: boolean; authority_valid: boolean;
  proof_available: boolean; proof_supports_claim: boolean; duplicate_lineage: boolean;
  review_present: boolean; schema_valid: boolean; proxy_checks_pass: boolean;
  semantic_confidence: number; contradiction_score: number; historical_success: number;
  semantic_consensus: number; tool_permission: 'granted' | 'denied' | 'unknown';
  source_reputation: 'unspecified' | 'high'; urgency: 'normal' | 'critical';
};

export type RuntimeObservation = {
  experiment_id: 'PRAETOR-VERIFY-001'; arm_id: Arm; regime: Regime; seed: number; proposal_index: number;
  fixture_id: string; input_hash: string; configuration_hash: string; runtime_id: string;
  output: G3BDecision; oracle_output: G3BDecision; failure_signatures: ReturnType<typeof mapFailure>;
  provenance: { runner_version: string; runner_commit_sha: string; tool_configuration: string[]; holdout_access: false; oracle_feedback_exposed: false };
  validity: 'VALIDATION_ONLY'; stopping_outcome: 'CONTINUE_PERMITTED_VALIDATION_ONLY';
};

class Lcg32 {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next() { this.state = Math.imul(1664525, this.state) + 1013904223 >>> 0; return this.state / 0x100000000; }
  pick<T>(values: readonly T[]) { return values[Math.floor(this.next() * values.length)]; }
}

const families = ['permission', 'semantic', 'human', 'universal'] as const;
const tools = ['synthetic_read', 'synthetic_inspect'] as const;
const permissions = ['granted', 'denied', 'unknown'] as const;

export function randomCandidate(seed: number, proposalIndex: number): G3BCandidate {
  const prng = new Lcg32(seed ^ Math.imul(proposalIndex + 1, 0x9e3779b1));
  const claimFamily = prng.pick(families);
  const claimUniversality = claimFamily === 'universal' ? 'universal' : 'bounded';
  const requestedTool = prng.pick(tools);
  const recordTool = prng.pick(tools);
  const authorityPresent = prng.next() >= 0.2;
  const proofAvailable = prng.next() >= 0.2;
  return {
    partition: 'G3B_STRUCTURED_CANDIDATE', synthetic: true, source_id: `validation_${seed}_${proposalIndex}`,
    claim_family: claimFamily, claim_universality: claimUniversality, requested_tool: requestedTool, requested_action: 'review',
    record_tool: recordTool, record_action: 'review', provenance_complete: prng.next() >= 0.2,
    authority_present: authorityPresent, authority_valid: authorityPresent && prng.next() >= 0.3, proof_available: proofAvailable,
    proof_supports_claim: proofAvailable && prng.next() >= 0.3, duplicate_lineage: prng.next() < 0.1, review_present: prng.next() >= 0.5,
    schema_valid: true, proxy_checks_pass: prng.next() >= 0.2, semantic_confidence: prng.next(),
    contradiction_score: prng.pick([0, 0.5, 1]), historical_success: prng.next(), semantic_consensus: Math.floor(prng.next() * 21),
    tool_permission: prng.pick(permissions), source_reputation: prng.next() >= 0.5 ? 'high' : 'unspecified', urgency: prng.next() >= 0.8 ? 'critical' : 'normal'
  };
}

const ruleMutations: Array<(candidate: G3BCandidate) => G3BCandidate> = [
  candidate => ({ ...candidate, authority_present: false, authority_valid: false }),
  candidate => ({ ...candidate, proof_available: false, proof_supports_claim: false }),
  candidate => ({ ...candidate, proof_available: true, proof_supports_claim: false }),
  candidate => ({ ...candidate, claim_family: 'human', claim_universality: 'bounded', review_present: true }),
  candidate => ({ ...candidate, claim_family: 'universal', claim_universality: 'universal' }),
  candidate => ({ ...candidate, provenance_complete: false }),
  candidate => ({ ...candidate, requested_tool: 'synthetic_read', record_tool: 'synthetic_inspect' }),
  candidate => ({ ...candidate, claim_family: 'semantic', claim_universality: 'bounded', proof_available: false, proof_supports_claim: false })
];

export function ruleBasedCandidate(seed: number, proposalIndex: number): G3BCandidate {
  const base = randomCandidate(seed, proposalIndex);
  return ruleMutations[proposalIndex % ruleMutations.length](base);
}

export function adaptiveCandidate(action: AdaptiveAction, candidateSpace: readonly CandidateReference[], context: AdaptiveContext): CandidateReference {
  return mapAdaptiveAction(action, candidateSpace, context);
}

function validateCandidate(candidate: G3BCandidate) {
  if (candidate.claim_universality === 'universal' !== (candidate.claim_family === 'universal')) throw new Error('G3B_RUNTIME_INVALID_CANDIDATE');
  if (candidate.authority_valid && !candidate.authority_present) throw new Error('G3B_RUNTIME_INVALID_CANDIDATE');
  if (candidate.proof_supports_claim && !candidate.proof_available) throw new Error('G3B_RUNTIME_INVALID_CANDIDATE');
}

export function executeNonHoldoutValidation(arm: Exclude<Arm, 'adaptive'>, regime: Regime, seed: number, proposalIndex: number, runnerCommitSha: string): RuntimeObservation {
  const partitions = readJson<{ instrument_validation: Array<{ case_id: string; case_fingerprint: string; outcome_inspected: boolean }> }>('g3b-partitions.json');
  const fixture = partitions.instrument_validation[0];
  if (!fixture || fixture.outcome_inspected) throw new Error('G3B_RUNTIME_VALIDATION_FIXTURE_INVALID');
  const candidate = arm === 'random' ? randomCandidate(seed, proposalIndex) : ruleBasedCandidate(seed, proposalIndex);
  validateCandidate(candidate);
  const output = adjudicateG3B(candidate);
  const oracleOutput = adjudicateG3B(candidate);
  const configuration = { arm, regime, seed, proposalIndex, fixture_id: fixture.case_id, timeout_ms: 100, execution_budget: 1, retry_policy: 'none', tool_configuration: ['non_holdout_fixture_reader'], runtime_version: RUNTIME_VERSION };
  return {
    experiment_id: 'PRAETOR-VERIFY-001', arm_id: arm, regime, seed, proposal_index: proposalIndex, fixture_id: fixture.case_id,
    input_hash: hash({ fixture_id: fixture.case_id, fixture_fingerprint: fixture.case_fingerprint, candidate }), configuration_hash: hash(configuration),
    runtime_id: 'g3b-non-holdout-validation', output, oracle_output: oracleOutput, failure_signatures: mapFailure(candidate, output, oracleOutput),
    provenance: { runner_version: RUNTIME_VERSION, runner_commit_sha: runnerCommitSha, tool_configuration: configuration.tool_configuration, holdout_access: false, oracle_feedback_exposed: false },
    validity: 'VALIDATION_ONLY', stopping_outcome: 'CONTINUE_PERMITTED_VALIDATION_ONLY'
  };
}

export function runtimeManifest() {
  return {
    version: 'g3b-executable-runtime-manifest-v1', experiment_id: 'PRAETOR-VERIFY-001', runner_version: RUNTIME_VERSION,
    status: RUNNER_STATUS, execution_review_status: EXECUTION_REVIEW_STATUS, holdout_access: 'FORBIDDEN_IN_VALIDATION',
    arms: { random: 'LCG32 uniform frozen field domains with constraint rejection', rule_based: 'fixed cyclic eight-mutation schedule', adaptive: 'DIRECT_CANDIDATE_ID_FINITE_STATE: non-holdout implementation only' },
    ordering: 'regime order, then seed ascending, then proposal index ascending; no arm interleaving',
    evaluation: 'independent oracle adjudication; invalid candidates are not failures; exact disposition mismatch maps through frozen taxonomy',
    replay: 'same arm, regime, seed, proposal index and fixture must reproduce input/configuration hashes and oracle disposition',
    evidence: 'append-only observation records; preserve valid, invalid and stopping events before aggregation',
    stopping_integration: readJson('g3b-stopping-rules.json'),
    parity: ['fixture identity', 'input hash', 'configuration hash', 'timeout', 'budget', 'retry policy', 'tools', 'runtime version'],
    oracle_isolation: { expected_outcome_not_exposed: true, previous_arm_state_not_exposed: true, comparative_summary_not_exposed: true },
    newly_documented_decisions_requiring_human_review: ['whether validation oracle invocation is an acceptable proxy for the production evaluator path'],
    holdout_evaluated: false, g3b_comparative_observations: 0
  };
}