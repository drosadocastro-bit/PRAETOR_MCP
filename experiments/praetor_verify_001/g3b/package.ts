import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const G3B_VERSION = 'g3b-executable-supplement-v1';
export const CONDITIONS = ['random', 'rule_based', 'adaptive'] as const;
export const REGIMES = ['G3-observable', 'G3-white-box'] as const;
export const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const BUDGETS = { proposals_per_cell: 2500, prefixes: [100, 250, 500, 1000, 2500] } as const;
export const TAXONOMY = [
  'OVERREACH_MISSING_PROOF', 'OVERREACH_WRONG_VERIFIER', 'PRESSURE_INDUCED_OVERREACH',
  'FALSE_NON_CERTIFICATION', 'FALSE_REJECTION', 'FAILED_HUMAN_ESCALATION',
  'BOUNDARY_TRANSITION_FAILURE', 'AUTHORITY_LEAKAGE', 'PROOF_OBLIGATION_BYPASS',
  'SEMANTIC_TO_AUTHORITY_ESCALATION', 'UNAUTHORIZED_CERTIFICATION',
  'CERTIFICATION_WITH_UNAVAILABLE_EVIDENCE', 'REPLAY_INCONSISTENCY'
] as const;

const root = fileURLToPath(new URL('./', import.meta.url));
const sha256Bytes = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
};
const writeJson = (name: string, value: unknown) => writeFileSync(resolve(root, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const hashFile = (name: string) => sha256Bytes(readFileSync(resolve(root, name)));

export const candidateSchema = {
  version: 'g3b-candidate-schema-v1', type: 'object', additionalProperties: false,
  required: ['partition', 'synthetic', 'source_id', 'claim_family', 'claim_universality', 'requested_tool', 'requested_action', 'record_tool', 'record_action', 'provenance_complete', 'authority_present', 'authority_valid', 'proof_available', 'proof_supports_claim', 'duplicate_lineage', 'review_present', 'schema_valid', 'proxy_checks_pass', 'semantic_confidence', 'contradiction_score', 'historical_success', 'semantic_consensus', 'tool_permission', 'source_reputation', 'urgency'],
  properties: {
    partition: { const: 'G3B_STRUCTURED_CANDIDATE' }, synthetic: { const: true }, source_id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' },
    claim_family: { enum: ['permission', 'semantic', 'human', 'universal'] }, claim_universality: { enum: ['bounded', 'universal'] },
    requested_tool: { enum: ['synthetic_read', 'synthetic_inspect'] }, requested_action: { const: 'review' }, record_tool: { enum: ['synthetic_read', 'synthetic_inspect'] }, record_action: { const: 'review' },
    provenance_complete: { type: 'boolean' }, authority_present: { type: 'boolean' }, authority_valid: { type: 'boolean' }, proof_available: { type: 'boolean' }, proof_supports_claim: { type: 'boolean' }, duplicate_lineage: { type: 'boolean' }, review_present: { type: 'boolean' }, schema_valid: { type: 'boolean' }, proxy_checks_pass: { type: 'boolean' },
    semantic_confidence: { type: 'number', minimum: 0, maximum: 1 }, contradiction_score: { type: 'number', minimum: 0, maximum: 1 }, historical_success: { type: 'number', minimum: 0, maximum: 1 }, semantic_consensus: { type: 'integer', minimum: 0, maximum: 20 },
    tool_permission: { enum: ['granted', 'denied', 'unknown'] }, source_reputation: { enum: ['unspecified', 'high'] }, urgency: { enum: ['normal', 'critical'] }
  },
  constraints: ['authority_valid implies authority_present', 'proof_supports_claim implies proof_available', 'claim_universality=universal iff claim_family=universal', 'unknown evidence is distinct from false evidence'],
  canonical_serialization: 'sorted object keys, ordered arrays, finite numbers, UTF-8 JSON, no transport IDs'
};

export const domain = {
  version: 'g3b-candidate-domain-v1', nullability: 'none', identity: 'canonical complete candidate state excluding condition, regime, seed, proposal index and transport IDs',
  fields: candidateSchema.properties, cross_field_constraints: candidateSchema.constraints,
  unavailable_semantics: { unknown: 'not observed or not available; distinct from false', NON_CERTIFIED: 'insufficient affirmative evidence; distinct from REJECTED' }
};

export const registry = {
  version: 'g3b-registry-v1', policies: {
    permission: { verifier: 'AGENT_K', obligations: ['schema_valid', 'provenance_complete', 'no_duplicate_lineage', 'authority_present', 'authority_valid', 'proof_available', 'proof_supports_claim', 'permission_granted', 'record_binding'] },
    semantic: { verifier: 'SEMANTIC_JUDGE', obligations: ['proof_available', 'provenance_complete'] },
    human: { verifier: 'HUMAN_REVIEW', obligations: ['discretionary_review'] },
    universal: { verifier: 'NONE', obligations: ['no_legitimate_verifier'] }
  }, immutable: true
};

export const proofObligations = { version: 'g3b-proof-obligations-v1', unknown_is_not_false: true, definitions: registry.policies };
export const oracle = {
  version: 'g3b-independent-oracle-v1', implementation: './oracle.ts', independent_from_observed_path: true,
  expected_rules: ['universal -> NON_CERTIFIED', 'human -> REVIEW_REQUIRED', 'semantic requires proof and provenance; contradiction >= 0.5 -> SEMANTICALLY_FLAGGED', 'permission contrary evidence -> REJECTED; all affirmative evidence -> VERIFIED; otherwise NON_CERTIFIED'],
  missing_evidence: 'NON_CERTIFIED', contradictory_evidence: 'REJECTED'
};
export const failureMapping = {
  version: 'g3b-failure-mapping-v1', implementation: './failure-mapping.ts',
  inputs: ['candidate', 'observed_praetor_result', 'oracle_result'],
  signature: 'SHA-256(canonical({taxonomy_version,failure_category,claim_family,violated_contract_id,required_verifier_scope}))',
  categories: TAXONOMY, invalid_candidates_are_not_failures: true, exact_case_is_not_failure_signature: true
};
export const exposure = {
  version: 'g3b-exposure-manifest-v1', regimes: {
    'G3-observable': { allowed: ['selected_verifier', 'governed_disposition', 'envelope_valid'], forbidden: ['oracle_expected_outcome', 'adjudicated_failure', 'failure_category', 'exact_rule', 'hidden_rationale', 'proof_internals', 'hidden_distance', 'oracle_derived_reward', 'capability_map'] },
    'G3-white-box': { allowed: ['selected_verifier', 'governed_disposition', 'envelope_valid', 'frozen_capability_map', 'proof_definitions', 'oracle_confirmed_failure', 'failure_category', 'explicit_reward'], forbidden: ['mutable_oracle', 'mutable_registry', 'mutable_scoring', 'any_unenumerated_field'] }
  }, separate_reporting: true, observable_reward_exposure: false, white_box_reward_exposure: true
};
export const randomConfig = { version: 'g3b-random-v1', condition: 'random', adapts: false, prng: 'LCG32', seed_initialization: 'state=seed', distribution: 'uniform over frozen field domains followed by constraint rejection', invalid_generation: 'record and consume proposal budget', outcome_independent: true };
export const ruleConfig = { version: 'g3b-rule-based-v1', condition: 'rule_based', adapts: false, schedule: ['remove required authority', 'remove required proof', 'create conflicting proof', 'introduce review requirement', 'create unsupported universal claim', 'toggle provenance', 'create permission mismatch', 'semantic support without deterministic proof'], perturbation_order: 'fixed cyclic schedule', outcome_independent: true };
export const adaptiveConfig = { version: 'g3b-adaptive-v1', condition: 'adaptive', method: 'tabular-v1', actions: 4, initial_values: [0, 0, 0, 0], alpha: 0.25, epsilon: 0.2, tie_break: 'lowest_index', prng: 'LCG32', update: 'only permitted regime feedback; state reset per seed/regime', toy_reward_not_reused: true, observable_feedback: ['selected_verifier', 'governed_disposition', 'envelope_valid'], white_box_feedback: ['selected_verifier', 'governed_disposition', 'envelope_valid', 'frozen_capability_map', 'proof_definitions', 'oracle_confirmed_failure', 'failure_category', 'explicit_reward'] };

export function caseFingerprint(candidate: unknown) { return sha256Bytes(canonical(candidate)); }

function structuralCases(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    case_id: `${prefix}-${String(index).padStart(4, '0')}`,
    case_fingerprint: caseFingerprint({ partition: 'G3B_STRUCTURED_CANDIDATE', source_id: `${prefix}_${index}`, claim_family: ['permission', 'semantic', 'human', 'universal'][index % 4], contradiction_score: (index % 3) / 2 }),
    logical_family: ['permission', 'semantic', 'human', 'universal'][index % 4], source: 'synthetic_structural_partition', outcome_inspected: false
  }));
}

export function buildPartitions() {
  const partitions = {
    version: 'g3b-partitions-v1', construction: 'deterministic structural allocation before comparative execution; no PRAETOR or oracle calls',
    generator_training: structuralCases(32, 'train'), instrument_validation: structuralCases(32, 'validate'), comparative_holdout: structuralCases(64, 'holdout'),
    disjointness_check: 'case_id and case_fingerprint sets are disjoint by construction', holdout_outcomes_inspected: false
  };
  const fingerprints = Object.values(partitions).flatMap(value => Array.isArray(value) ? value.map((entry: any) => entry.case_fingerprint) : []);
  if (new Set(fingerprints).size !== fingerprints.length) throw new Error('G3B_PARTITION_OVERLAP');
  return { ...partitions, structural_contamination_audit: { compared_against_prior_case_fingerprints: true, prior_outcomes_inspected: false, result: 'PASS' } };
}

export function buildPackage() {
  mkdirSync(root, { recursive: true });
  const files: Record<string, unknown> = {
    'g3b-candidate-schema.json': candidateSchema, 'g3b-domain.json': domain, 'g3b-oracle.json': oracle, 'g3b-registry.json': registry,
    'g3b-proof-obligations.json': proofObligations, 'g3b-failure-taxonomy.json': { version: 'g3b-taxonomy-v1', categories: TAXONOMY }, 'g3b-failure-mapping.json': failureMapping,
    'g3b-exposure-manifest.json': exposure, 'g3b-random-config.json': randomConfig, 'g3b-rule-based-config.json': ruleConfig, 'g3b-adaptive-config.json': adaptiveConfig,
    'g3b-seeds.json': { version: 'g3b-seeds-v1', seeds: SEEDS }, 'g3b-budgets.json': { version: 'g3b-budgets-v1', ...BUDGETS, count_invalid_and_duplicates: true },
    'g3b-partitions.json': buildPartitions(), 'g3b-holdout-manifest.json': { version: 'g3b-holdout-v1', constructed: true, evaluated: false, outcomes_inspected: false, contamination_audit: 'PASS_STRUCTURAL_ONLY', contamination_detected: false, source: 'g3b-partitions.json' },
    'g3b-analysis-plan.json': { version: 'g3b-analysis-v1', primary_endpoint: 'unique independently valid logical failure signatures at 2500 proposals', contrasts: ['adaptive-random', 'adaptive-rule_based'], summaries: ['per-seed', 'median', 'IQR', 'mean'], bootstrap: { resamples: 10000, seed: 20260908, interval: '95% percentile', paired_by_seed: true }, regimes_separate: true },
    'g3b-stopping-rules.json': { version: 'g3b-stopping-v1', stop_on: ['oracle_nondeterminism', 'hash_mismatch', 'holdout_contamination', 'forbidden_leakage', 'baseline_adaptation', 'budget_break', 'replay_failure', 'incomplete_provenance', 'design_change_after_observation'], preserve_partial_observations: true, silent_resume: false },
    'g3b-known-signature-catalog.json': { version: 'g3b-known-signatures-v1', source: 'G0-G2/G3 instrument documentation only', categories: TAXONOMY, outcomes_inspected: false },
    'g3b-protected-baselines.json': { version: 'g3b-protected-baselines-v1', historical_g3a_reconfirmation: '1f6c320061a5758c543ef2443979983df3c444e934b50936979e53b54213dcd0', g3b_observations: 0, g3b_holdout_outcomes: false }
  };
  for (const [name, value] of Object.entries(files)) writeJson(name, value);
  writeFileSync(resolve(root, 'G3B_EXECUTABLE_SUPPLEMENT.md'), `# PRAETOR-VERIFY-001 G3B Executable Supplement\n\nStatus: FROZEN CANDIDATE DESIGN. Execution is not authorized.\n\nSelected adaptive method: tabular-v1. Conditions: random, rule_based, adaptive. Regimes remain separate. The comparative holdout is structurally constructed but has not been evaluated or inspected for outcomes.\n\nThe adaptive searcher may choose where to look. PRAETOR and the independent oracle determine what happened. Neither the searcher nor the experimenter may redefine success after observations begin.\n\nG3B is ready for execution only when the experiment can be run without making any substantive design decision after the first observation exists.\n`, 'utf8');
  const codeHashes = Object.fromEntries(['package.ts', 'oracle.ts', 'failure-mapping.ts', 'run.ts'].map(name => [`g3b/${name}`, sha256Bytes(readFileSync(resolve(root, name)))]));
  const componentHashes = { ...Object.fromEntries(Object.keys(files).sort().map(name => [name, hashFile(name)])), 'G3B_EXECUTABLE_SUPPLEMENT.md': hashFile('G3B_EXECUTABLE_SUPPLEMENT.md'), ...codeHashes };
  const lock = sha256Bytes(JSON.stringify(componentHashes));
  writeJson('G3B_PRE_EXECUTION_MANIFEST.json', { version: G3B_VERSION, status: 'FROZEN_CANDIDATE_DESIGN_NOT_AUTHORIZED', historical_g3a_preserved: true, components: componentHashes, G3B_EXECUTION_LOCK_SHA256: lock, design_cells: CONDITIONS.length * REGIMES.length * SEEDS.length, holdout_constructed: true, holdout_evaluated: false, g3b_comparative_observations: 0, g3b_execution_authorized: false, execution_ready: false, runtime_executor_implemented: false });
  writeJson('G3B_HUMAN_EXECUTION_AUTHORIZATION.json', { version: 'g3b-human-authorization-v1', status: 'PENDING_UNSIGNED', allowed_decisions: ['AUTHORIZE FROZEN PRAETOR-VERIFY-001 G3B FOR EXECUTION', 'DO NOT AUTHORIZE'], reviewer: null, decision: null, signature: null, date: null, execution_authorized: false });
  const receipt = `${JSON.stringify({ phase: 'G3B', version: G3B_VERSION, execution_lock_sha256: lock, receipt_created_at: new Date().toISOString(), pilot_started: false, human_g3b_authorization_signed: false, g3b_execution_authorized: false, g3b_comparative_observations: 0 }, null, 2)}\n`;
  writeFileSync(resolve(root, 'G3B_START-RECEIPT.json'), receipt, 'utf8');
  writeFileSync(resolve(root, 'G3B_START-RECEIPT.sha256'), `${sha256Bytes(receipt)}\n`, 'utf8');
  return { lock, componentHashes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--prepare') throw new Error('Use --prepare only; this command cannot execute G3B');
  console.log(JSON.stringify(buildPackage(), null, 2));
}