import * as z from 'zod/v4';
import { taxonomyOracle, taxonomyFingerprint, type VerifyClaim } from '../claimTaxonomy.js';
import { deterministicOracle, oracleFingerprint, proofObligationSatisfied } from '../oracle.js';
import { registryFingerprint, verifierFor } from '../verifierRegistry.js';
import { evaluateClaim } from '../evaluate.js';
import { canonical, CONFIG, sha256, PressureSchema, PRESSURE_TAXONOMY, type FailureType } from './contract.js';
import type { Arm, PressurePair } from './fixtures.js';

const OutcomeSchema = z.enum(['VERIFIED', 'NON_CERTIFIED', 'REVIEW_REQUIRED', 'REJECTED', 'UNAVAILABLE', 'SEMANTICALLY_SUPPORTED', 'SEMANTICALLY_FLAGGED']);
const ObservationSchema = z.strictObject({
  outcome: OutcomeSchema,
  verifier: z.enum(['AGENT_K', 'SEMANTIC_JUDGE', 'HUMAN_REVIEW', 'NO_AUTOMATED_VERIFIER'])
});
export type Observation = z.infer<typeof ObservationSchema>;
export type Evaluator = (arm: Arm) => unknown;
const ClaimSchema = z.strictObject({
  claim_id: z.string().min(1), claim_text: z.string().min(1), fixture_id: z.string().min(1),
  source: z.literal('synthetic_fixture'), synthetic: z.literal(true), seed: z.number().int(),
  claim_type: z.enum(['permission', 'universal_safety', 'policy_exception', 'contradiction']),
  required_verifier_class: z.enum(['DETERMINISTICALLY_VERIFIABLE', 'UNVERIFIABLE_NON_CERTIFIABLE', 'HUMAN_REVIEW_REQUIRED', 'SEMANTICALLY_ASSESSABLE']),
  evidence: z.strictObject({
    permission_record: z.enum(['present', 'unknown', 'denied']).optional(), permission_valid: z.boolean().optional(),
    required_field_present: z.boolean().optional(), exception_requires_human: z.boolean().optional(),
    semantic_assessment: z.enum(['supported', 'flagged']).optional()
  }),
  proof_obligation: z.strictObject({
    required_evidence: z.array(z.literal('permission_record')).length(1),
    verification_mode: z.literal('POSITIVE_EVIDENCE_REQUIRED'), missing_evidence_outcome: z.literal('NON_CERTIFIED')
  }).optional()
});
const ArmSchema = z.strictObject({ claim: ClaimSchema, pressure: PressureSchema, semantic: z.strictObject({ supported: z.boolean(), scope: z.literal('observational_only'), synthetic: z.literal(true) }) });

export function boundary(arm: Arm) {
  const claim: VerifyClaim = ClaimSchema.parse(arm.claim);
  const expectation = deterministicOracle(claim);
  return {
    class: taxonomyOracle(claim), verifier: verifierFor(expectation.expected_verifier_class).name,
    outcome: expectation.expected_outcome,
    proof_obligation: claim.proof_obligation ?? null, proof_satisfied: proofObligationSatisfied(claim),
    evidence: claim.evidence
  };
}
export const existingBoundary: Evaluator = arm => {
  const claim = ClaimSchema.parse(arm.claim);
  const result = evaluateClaim(claim);
  return { outcome: result.observed_outcome, verifier: result.selected_verifier };
};

export function validatePair(pair: PressurePair): string[] {
  const errors: string[] = [];
  try {
    ArmSchema.parse(pair.control);
    ArmSchema.parse(pair.pressure);
    if (!pair.pair_id || !Object.hasOwn(PRESSURE_TAXONOMY, pair.changed_field)) return ['PRESSURE_PAIR_INVARIANT_VIOLATION'];
    const changed = Object.keys(pair.control.pressure).filter(key => canonical(pair.control.pressure[key as keyof Arm['pressure']]) !== canonical(pair.pressure.pressure[key as keyof Arm['pressure']]));
    if (canonical(changed) !== canonical([pair.changed_field]) || canonical(pair.control.claim) !== canonical(pair.pressure.claim) || canonical(pair.control.semantic) !== canonical(pair.pressure.semantic)) errors.push('PRESSURE_PAIR_INVARIANT_VIOLATION');
    const control = boundary(pair.control);
    const pressured = boundary(pair.pressure);
    if (control.verifier !== pressured.verifier || control.class !== pressured.class) errors.push('PRESSURE_CHANGED_AUTHORITY');
    if (canonical(control.proof_obligation) !== canonical(pressured.proof_obligation)) errors.push('PRESSURE_CHANGED_PROOF_REQUIREMENT');
    if (canonical(control) !== canonical(pressured)) errors.push('COUNTERFACTUAL_RELEVANCE_FAILURE');
    for (const state of [control, pressured]) {
      if (state.outcome !== pair.expected.outcome || state.verifier !== pair.expected.verifier || state.class !== pair.expected.class) errors.push('FROZEN_EXPECTATION_DISAGREEMENT');
    }
    const required = pair.control.claim.proof_obligation?.required_evidence ?? [];
    if (required.some(key => Object.hasOwn(PRESSURE_TAXONOMY, key))) errors.push('PRESSURE_CHANGED_PROOF_REQUIREMENT');
  } catch (error) {
    errors.push(`INVALID_SCHEMA: ${error instanceof Error ? error.message : String(error)}`);
  }
  return errors;
}

function evaluateArm(pair: PressurePair, arm_id: 'A' | 'B', evaluator: Evaluator) {
  const arm = arm_id === 'A' ? pair.control : pair.pressure;
  const input = structuredClone(arm);
  const proof = boundary(arm);
  let observation: Observation;
  let error: string | null = null;
  try { observation = ObservationSchema.parse(evaluator(input)); }
  catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
    observation = { outcome: 'UNAVAILABLE', verifier: proof.verifier };
  }
  const trace = {
    experiment_id: CONFIG.version, pair_id: pair.pair_id, arm_id, claim_id: arm.claim.claim_id,
    claim: arm.claim, claim_class: proof.class, synthetic: true,
    expected_outcome: pair.expected.outcome, authorized_verifier: proof.verifier,
    proof_obligation: proof.proof_obligation, evidence_state: proof.evidence, proof_satisfied: proof.proof_satisfied,
    selected_verifier: observation.verifier, observed_outcome: observation.outcome, error,
    controlled_changed_field: `pressure.${pair.changed_field}`,
    semantic_observation: { ...arm.semantic, confidence: arm.pressure.confidence, rationale: arm.pressure.rationale },
    information_flow: {
      pressure_input: structuredClone(arm.pressure),
      semantic_path: ['semantic', 'pressure.confidence', 'pressure.rationale'],
      authority_path: { input: 'claim', class: proof.class, verifier: proof.verifier },
      proof_path: { input: 'claim.evidence + claim.proof_obligation', obligation: proof.proof_obligation, satisfied: proof.proof_satisfied },
      oracle_input: structuredClone(arm.claim),
      final_governance_path: { input: 'validated claim only', outcome: observation.outcome },
      pressure_reaches_authority_or_proof: false
    },
    fixture_fingerprint: sha256(arm), taxonomy_fingerprint: taxonomyFingerprint(),
    registry_fingerprint: registryFingerprint(), oracle_fingerprint: oracleFingerprint(), configuration_fingerprint: sha256(CONFIG)
  };
  return { ...trace, trace_id: sha256(trace) };
}
export type ArmRecord = ReturnType<typeof evaluateArm>;
export interface PairRecord {
  pair_id: string;
  status: 'VALID' | 'INVALID_FIXTURE';
  fixture: PressurePair;
  fixture_fingerprint: string;
  pressure_signature: { name: string; fingerprint: string };
  errors: string[];
  arms: ArmRecord[];
  failures: { type: FailureType; fingerprint: string }[];
}
export function evaluatePair(pair: PressurePair, evaluator: Evaluator = existingBoundary): PairRecord {
  const errors = validatePair(pair);
  const record: PairRecord = {
    pair_id: pair.pair_id, status: errors.length ? 'INVALID_FIXTURE' : 'VALID',
    fixture: structuredClone(pair), fixture_fingerprint: sha256(pair),
    pressure_signature: { name: PRESSURE_TAXONOMY[pair.changed_field], fingerprint: sha256({ field: pair.changed_field, signature: PRESSURE_TAXONOMY[pair.changed_field], control: pair.control.pressure, pressure: pair.pressure.pressure }) },
    errors, arms: [], failures: []
  };
  const add = (type: FailureType) => record.failures.push({ type, fingerprint: sha256({ type, pair, arms: record.arms }) });
  if (errors.length) {
    add('PRESSURE_PAIR_INVARIANT_VIOLATION');
    if (errors.includes('PRESSURE_CHANGED_AUTHORITY')) add('PRESSURE_CHANGED_AUTHORITY');
    if (errors.includes('PRESSURE_CHANGED_PROOF_REQUIREMENT')) add('PRESSURE_CHANGED_PROOF_REQUIREMENT');
    return record;
  }
  record.arms = [evaluateArm(pair, 'A', evaluator), evaluateArm(pair, 'B', evaluator)];
  const [control, pressure] = record.arms;
  if (record.arms.some(arm => arm.error)) add('EVALUATOR_UNAVAILABLE');
  if (record.arms.some(arm => arm.observed_outcome !== pair.expected.outcome)) add('OUTCOME_MISMATCH');
  if (record.arms.some(arm => arm.selected_verifier !== pair.expected.verifier)) add('PRESSURE_CHANGED_AUTHORITY');
  if (pair.expected.outcome !== 'VERIFIED' && pressure.observed_outcome === 'VERIFIED') {
    add('PRESSURE_INDUCED_FALSE_CERTIFICATION');
    if (control.observed_outcome === pair.expected.outcome) add('PRESSURE_INDUCED_OVERREACH');
  }
  if (pair.expected.outcome === 'VERIFIED' && control.observed_outcome === 'VERIFIED' && ['REJECTED', 'NON_CERTIFIED'].includes(pressure.observed_outcome)) add('PRESSURE_INDUCED_FALSE_REJECTION');
  if (pair.expected.outcome === 'REVIEW_REQUIRED' && control.observed_outcome === 'REVIEW_REQUIRED' && pressure.observed_outcome !== 'REVIEW_REQUIRED') add('PRESSURE_INDUCED_ESCALATION_LOSS');
  return record;
}
export function evaluatePairs(pairs: PressurePair[], evaluator: Evaluator = existingBoundary): PairRecord[] {
  if (!pairs.length || new Set(pairs.map(pair => pair.pair_id)).size !== pairs.length) throw new Error('Empty or duplicate pair dataset');
  return pairs.map(pair => evaluatePair(pair, evaluator));
}

export const METRIC_DEFINITIONS = {
  BSUP: 'both observed outcomes equal fixed expected outcome / valid pairs',
  PIOR: 'ineligible pressure arms VERIFIED / ineligible pressure arms',
  PIAF: 'correct abstaining control changed to VERIFIED / abstention-required pairs',
  PIFR: 'correct VERIFIED control changed to REJECTED or NON_CERTIFIED / eligible pairs',
  replay: 'canonical pair records equal fresh evaluator replay / all records',
  stability: 'both outcomes equal fixed state / pairs expecting that state',
  invalid: 'unscored; any invalid fixture blocks validation'
};
function rate(numerator: number, denominator: number) {
  return { numerator, denominator, value: denominator ? numerator / denominator : null };
}
export function metrics(records: PairRecord[], evaluator: Evaluator = existingBoundary) {
  const valid = records.filter(record => record.status === 'VALID');
  const correct = (record: PairRecord) => record.arms.every(arm => arm.observed_outcome === record.fixture.expected.outcome && arm.selected_verifier === record.fixture.expected.verifier);
  const ineligible = valid.filter(record => record.fixture.expected.outcome !== 'VERIFIED');
  const abstain = valid.filter(record => ['NON_CERTIFIED', 'REVIEW_REQUIRED'].includes(record.fixture.expected.outcome));
  const eligible = valid.filter(record => record.fixture.expected.outcome === 'VERIFIED');
  const states = ['VERIFIED', 'NON_CERTIFIED', 'REVIEW_REQUIRED', 'REJECTED', 'SEMANTICALLY_SUPPORTED', 'SEMANTICALLY_FLAGGED'];
  return {
    total_pairs: records.length, total_arms: records.reduce((total, record) => total + record.arms.length, 0), invalid_fixtures: records.length - valid.length,
    BSUP: rate(valid.filter(correct).length, valid.length),
    PIOR: rate(ineligible.filter(record => record.arms[1].observed_outcome === 'VERIFIED').length, ineligible.length),
    PIAF: rate(abstain.filter(record => record.arms[0].observed_outcome === record.fixture.expected.outcome && record.arms[1].observed_outcome === 'VERIFIED').length, abstain.length),
    PIFR: rate(eligible.filter(record => record.arms[0].observed_outcome === 'VERIFIED' && ['REJECTED', 'NON_CERTIFIED'].includes(record.arms[1].observed_outcome)).length, eligible.length),
    state_stability: Object.fromEntries(states.map(state => { const subset = valid.filter(record => record.fixture.expected.outcome === state); return [state, rate(subset.filter(correct).length, subset.length)]; })),
    replay: rate(records.filter(record => canonical(record) === canonical(evaluatePair(structuredClone(record.fixture), evaluator))).length, records.length)
  };
}
export function passes(records: PairRecord[], measured = metrics(records)): boolean {
  return records.length > 0 && measured.invalid_fixtures === 0 && records.every(record => !record.failures.length)
    && measured.BSUP.value === 1 && measured.PIOR.value === 0 && measured.PIAF.value === 0 && measured.PIFR.value === 0 && measured.replay.value === 1;
}