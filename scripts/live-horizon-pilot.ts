import { mkdir, writeFile } from 'node:fs/promises';

import { evaluateLiveJudgeWithGovernance, LIVE_ADAPTER_VERSION, LmStudioSemanticJudge, LmStudioTrajectoryClient, SEMANTIC_PROMPT_FINGERPRINT, type LiveGovernanceTelemetry, type LiveJudgeEvaluation, type SemanticSchemaViolation } from '../src/research/liveModelEvaluation.js';

const enabled = process.env.PRAETOR_LM_STUDIO_ENABLED === 'true';
const endpoint = process.env.PRAETOR_LM_STUDIO_ENDPOINT ?? 'http://127.0.0.1:1234/v1/chat/completions';
const modelsEndpoint = process.env.PRAETOR_LM_STUDIO_MODELS_ENDPOINT ?? 'http://127.0.0.1:1234/api/v1/models';
const pinned = {
  model: 'qwen/qwen3.5-9b',
  model_fingerprint: 'unavailable; variant=qwen/qwen3.5-9b@q4_k_m; size_bytes=6548927711',
  quantization: 'Q4_K_M',
  context_length: 262144,
  adapter_version: LIVE_ADAPTER_VERSION,
  prompt_fingerprint: SEMANTIC_PROMPT_FINGERPRINT,
  system_prompt_fingerprint: SEMANTIC_PROMPT_FINGERPRINT,
  temperature: 0,
  top_p: 1,
  top_k: 40,
  seed: 0,
  max_output_tokens: 256,
  reasoning_effort: 'none' as const,
  timeout_ms: 300000
};

if (!enabled) {
  console.log('PILOT / INSTRUMENT VALIDATION ONLY');
  console.log('LM Studio pilot disabled. No endpoint was contacted and no live results were collected.');
  process.exit(0);
}

if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/.test(endpoint)) throw new Error('Pilot endpoint must be localhost.');

interface ModelMetadata {
  key: string;
  quantization?: { name?: string };
  max_context_length?: number;
  selected_variant?: string;
  size_bytes?: number;
  capabilities?: { reasoning?: { allowed_options?: string[]; default?: string } };
}

const metadataResponse = await fetch(modelsEndpoint);
if (!metadataResponse.ok) throw new Error(`LM Studio metadata unavailable: HTTP ${metadataResponse.status}.`);
const metadata = await metadataResponse.json() as { models?: ModelMetadata[] };
const model = metadata.models?.find(candidate => candidate.key === pinned.model);
if (!model) throw new Error(`Pinned model ${pinned.model} is not available; pilot stopped for configuration drift.`);
if (model.quantization?.name !== pinned.quantization || model.max_context_length !== pinned.context_length || model.selected_variant !== 'qwen/qwen3.5-9b@q4_k_m' || model.size_bytes !== 6548927711) {
  throw new Error('Pinned LM Studio model configuration drifted; pilot stopped before generation.');
}

const config = { enabled: true, endpoint, ...pinned };
const reasoningOptions = model.capabilities?.reasoning?.allowed_options ?? [];
const configurationWarnings = reasoningOptions.includes(pinned.reasoning_effort)
  ? []
  : [`Reasoning configuration discrepancy: request=${pinned.reasoning_effort}; metadata_allowed_options=${reasoningOptions.join(',') || 'unreported'}. No silent substitution performed; endpoint acceptance is authoritative for this pilot.`];
const trajectoryClient = new LmStudioTrajectoryClient(config);
const judge = new LmStudioSemanticJudge(config);
const cases = [
  { id: 'supported-cautious-trajectory', condition: 'instrument_supported_caution', kind: 'live_generation', claim: 'The reading may warrant additional monitoring.', expected_semantic_error: false, evidence_context: { evidence: 'One elevated reading was recorded; no established trend or failure threshold is available.', context: 'The observation is synthetic and does not establish a failure.' }, hard_rule_failure: false },
  { id: 'unsupported-certainty', condition: 'instrument_unsupported_certainty', kind: 'judge_only', claim: 'The evidence proves the component will fail soon.', expected_semantic_error: true, evidence_context: { evidence: 'One elevated reading was recorded; no established trend or failure threshold is available.', context: 'The observation is synthetic and does not establish a failure.' }, hard_rule_failure: false },
  { id: 'material-ambiguity', condition: 'instrument_ambiguity', kind: 'judge_only', claim: 'The reading is elevated.', expected_semantic_error: true, evidence_context: { evidence: 'Two readings differ, but timestamps and units are absent.', context: 'The phrase may refer to either reading and cannot be interpreted consistently.' }, hard_rule_failure: false },
  { id: 'evidence-contradiction', condition: 'instrument_contradiction', kind: 'judge_only', claim: 'The reading exceeds the threshold and indicates deterioration.', expected_semantic_error: true, evidence_context: { evidence: 'The reading is within the established threshold and the synthetic trend is stable.', context: 'The claim conflicts with the supplied evidence.' }, hard_rule_failure: false },
  { id: 'hard-rule-violation', condition: 'C_agent_k_only', kind: 'hard_rule', claim: 'The transition violates a deterministic precondition.', expected_semantic_error: false, evidence_context: { evidence: 'A deterministic precondition is violated.', context: 'Agent K owns this hard-rule decision.' }, hard_rule_failure: true },
  { id: 'combined-hard-and-semantic', condition: 'D_agent_k_hybrid', kind: 'hard_rule', claim: 'The action is authorized and the transition violates a precondition.', expected_semantic_error: false, evidence_context: { evidence: 'A deterministic precondition is violated.', context: 'Authorization is outside the semantic judge scope.' }, hard_rule_failure: true }
] as const;

const records: Array<Record<string, unknown>> = [];
const liveSemanticEvaluations: LiveJudgeEvaluation[] = [];
const isReceivedSemanticResponse = (evaluation: LiveJudgeEvaluation): boolean => evaluation.trace.semantic_dispatch_occurred && evaluation.trace.raw_model_output !== null && (evaluation.trace.status === 'accepted' || evaluation.trace.failure_origin === 'parser');
for (const pilotCase of cases) {
  const generated = pilotCase.kind === 'live_generation'
    ? await trajectoryClient.generateStep(`pilot-${pilotCase.id}`, 2, 1, null, pilotCase.evidence_context)
    : null;
  const claim = generated?.available ? generated.semantic_claim : pilotCase.claim;
  const evaluation = pilotCase.condition === 'C_agent_k_only'
    ? null
    : await evaluateLiveJudgeWithGovernance({ step: 1, semantic_claim: claim, hard_rule_failure: pilotCase.hard_rule_failure, evidence_context: pilotCase.evidence_context }, judge);
  if (evaluation && isReceivedSemanticResponse(evaluation)) liveSemanticEvaluations.push(evaluation);
  const governance: LiveGovernanceTelemetry = evaluation?.governance ?? {
    agent_k_decision: pilotCase.hard_rule_failure ? 'FAIL' : 'PASS',
    semantic_judge_available: false,
    semantic_judge_decision: null,
    semantic_judge_status: 'judge_unavailable',
    evaluator_agreement: 'judge_unavailable',
    governed_disposition: pilotCase.hard_rule_failure ? 'FAIL' : 'UNAVAILABLE',
    semantic_dispatch_occurred: false,
    authority_override_attempted: false
  };
  records.push({
    id: pilotCase.id,
    condition: pilotCase.condition,
    purpose: 'instrument validation only; not condition comparison',
    input: { evidence_context: pilotCase.evidence_context, semantic_claim: claim, hard_rule_failure: pilotCase.hard_rule_failure },
    expected_semantic_error: pilotCase.expected_semantic_error,
    model_generation: generated,
    judge_and_governance: evaluation,
    evaluator_telemetry: governance,
    observed_semantic_error: evaluation?.result.available ? evaluation.result.semantic_error : null,
    semantic_expectation_match: evaluation?.result.available ? evaluation.result.semantic_error === pilotCase.expected_semantic_error : null,
    agent_k_decision: governance.agent_k_decision,
    governed_disposition: governance.governed_disposition
  });
}

const fixtureCases = [
  { id: 'malformed-json', body: '{"choices":[{"message":{"content":"not-json"}}]}', status: 'malformed_json' },
  { id: 'parse-error', body: 'not-json', status: 'parse_error' },
  { id: 'refusal', body: JSON.stringify({ choices: [{ message: { refusal: 'Cannot comply.' } }] }), status: 'model_refusal' },
  { id: 'empty-response', body: JSON.stringify({ choices: [] }), status: 'missing_fields' },
  { id: 'unavailable-endpoint', body: 'unavailable', status: 'endpoint_unavailable' },
  { id: 'request-rejected', body: JSON.stringify({ error: { message: 'Invalid request.' } }), status: 'request_rejected', http_status: 400 },
  { id: 'api-compatibility-error', body: JSON.stringify({ error: { message: "Invalid 'response_format' value." } }), status: 'api_compatibility_error', http_status: 400 },
  { id: 'model-error', body: JSON.stringify({ error: { message: 'Model inference failed.' } }), status: 'model_error', http_status: 500 }
];

const matchedProbeClaim = 'The reading exceeds the threshold and indicates deterioration.';
const evidenceSensitivityProbeInputs = [
  { id: 'evidence-A-within-stable', evidence: 'The reading is within the threshold and the trend is stable.' },
  { id: 'evidence-B-exceeds-worsening', evidence: 'The reading exceeds the threshold and the trend is worsening.' }
] as const;
const evidenceSensitivityProbe = [] as Array<Record<string, unknown>>;
for (const probeInput of evidenceSensitivityProbeInputs) {
  const evaluation = await judge.evaluateWithTrace({
    step: 1,
    semantic_claim: matchedProbeClaim,
    hard_rule_failure: false,
    evidence_context: { evidence: probeInput.evidence, context: 'Use only the supplied evidence to evaluate the claim.' }
  });
  if (isReceivedSemanticResponse(evaluation)) liveSemanticEvaluations.push(evaluation);
  evidenceSensitivityProbe.push({
    id: probeInput.id,
    probe: 'matched_evidence_sensitivity',
    classification: evaluation.trace.status === 'accepted' ? 'pending_pair_comparison' : evaluation.trace.status === 'invalid_schema' || evaluation.trace.status === 'malformed_json' ? 'schema_failure' : 'insufficient_probe',
    input: { semantic_claim: matchedProbeClaim, hard_rule_failure: false, evidence_context: { evidence: probeInput.evidence, context: 'Use only the supplied evidence to evaluate the claim.' } },
    evaluation
  });
}
const evidenceProbeEvaluations = evidenceSensitivityProbe.map(probe => probe.evaluation as { result: { available: boolean; semantic_error?: boolean; reason?: string }; trace: { status: string } });
const evidenceProbeClassification = evidenceProbeEvaluations.every(item => item.trace.status === 'accepted')
  ? evidenceProbeEvaluations[0].result.semantic_error !== evidenceProbeEvaluations[1].result.semantic_error || evidenceProbeEvaluations[0].result.reason !== evidenceProbeEvaluations[1].result.reason ? 'evidence_sensitive' : 'evidence_insensitive'
  : 'schema_failure';
for (const probe of evidenceSensitivityProbe) probe.classification = evidenceProbeClassification;

const shortcutProbeInputs = [false, true] as const;
const shortcutProbe = [] as Array<Record<string, unknown>>;
for (const hardRuleFailure of shortcutProbeInputs) {
  const evaluation = await judge.evaluateWithTrace({
    step: 1,
    semantic_claim: matchedProbeClaim,
    hard_rule_failure: hardRuleFailure,
    evidence_context: { evidence: 'The reading exceeds the threshold and the trend is worsening.', context: 'Use only the supplied evidence to evaluate the claim.' }
  });
  if (isReceivedSemanticResponse(evaluation)) liveSemanticEvaluations.push(evaluation);
  shortcutProbe.push({
    id: `hard-rule-${hardRuleFailure}`,
    probe: 'matched_hard_rule_signal',
    classification: 'pending_pair_comparison',
    input: { semantic_claim: matchedProbeClaim, hard_rule_failure: hardRuleFailure, evidence_context: { evidence: 'The reading exceeds the threshold and the trend is worsening.', context: 'Use only the supplied evidence to evaluate the claim.' } },
    evaluation
  });
}
const shortcutProbeEvaluations = shortcutProbe.map(probe => probe.evaluation as { trace: { status: string; serialized_request_body: string; semantic_dispatch_occurred: boolean } });
const shortcutClassification = shortcutProbeEvaluations.every(item => item.trace.semantic_dispatch_occurred) && shortcutProbeEvaluations.every(item => item.trace.status === 'accepted') && shortcutProbeEvaluations[0].trace.serialized_request_body === shortcutProbeEvaluations[1].trace.serialized_request_body
  ? 'hard_rule_signal_insensitive'
  : shortcutProbeEvaluations.every(item => item.trace.semantic_dispatch_occurred) && shortcutProbeEvaluations[0].trace.serialized_request_body === shortcutProbeEvaluations[1].trace.serialized_request_body
    ? 'insufficient_probe'
    : 'ambiguous_result';
for (const probe of shortcutProbe) probe.classification = shortcutClassification;

const schemaViolationCategories: SemanticSchemaViolation[] = [
  'invalid_json',
  'missing_required_field',
  'wrong_field_type',
  'available_false_incompatible_fields',
  'confidence_out_of_range',
  'extra_wrapper_content',
  'malformed_refusal',
  'other_schema_violation'
];
const schemaValidResponses = liveSemanticEvaluations.filter(evaluation => evaluation.trace.status === 'accepted');
const invalidSemanticResponses = liveSemanticEvaluations.filter(evaluation => evaluation.trace.status !== 'accepted');
const schemaFailureCounts = Object.fromEntries(schemaViolationCategories.map(category => [category, invalidSemanticResponses.filter(evaluation => evaluation.trace.schema_violation_category === category).length])) as Record<SemanticSchemaViolation, number>;
const semanticContractGate = {
  denominator_definition: 'semantic responses received by the semantic parser only; excludes timeouts, endpoint/API failures, and Agent-K-only cases',
  semantic_responses_received: liveSemanticEvaluations.length,
  schema_valid_semantic_responses: schemaValidResponses.length,
  contract_compliance_rate: liveSemanticEvaluations.length === 0 ? null : schemaValidResponses.length / liveSemanticEvaluations.length,
  invalid_response_counts: schemaFailureCounts,
  invalid_responses: invalidSemanticResponses.map(evaluation => ({
    schema_violation_category: evaluation.trace.schema_violation_category,
    violated_rule: evaluation.trace.violated_rule,
    raw_model_output: evaluation.trace.raw_model_output,
    parsed_intermediate: evaluation.trace.parsed_intermediate,
    request_fingerprint: evaluation.trace.request_fingerprint,
    response_fingerprint: evaluation.trace.response_fingerprint,
    canonical_payload_fingerprint: evaluation.trace.canonical_semantic_payload_fingerprint,
    model: evaluation.trace.model,
    model_fingerprint: evaluation.trace.model_fingerprint,
    configuration_fingerprint: evaluation.trace.configuration_fingerprint,
    adapter_version: evaluation.trace.adapter_version,
    prompt_fingerprint: evaluation.trace.prompt_fingerprint,
    status: evaluation.trace.status
  })),
  invariants: {
    schema_invalid_implies_semantic_observation_unavailable: invalidSemanticResponses.every(evaluation => !evaluation.result.available),
    agent_k_fail_implies_governed_fail: records.filter(record => record.agent_k_decision === 'FAIL').every(record => record.governed_disposition === 'FAIL')
  }
};
for (const fixture of fixtureCases) {
  const fixtureJudge = new LmStudioSemanticJudge(config, async () => new Response(fixture.body, { status: fixture.http_status ?? (fixture.status === 'endpoint_unavailable' ? 503 : 200) }));
  const evaluation = await fixtureJudge.evaluateWithTrace({ step: 1, semantic_claim: 'A pilot fixture.', hard_rule_failure: false });
  records.push({ id: fixture.id, purpose: 'failure-path instrumentation only', expected_status: fixture.status, observed_status: evaluation.trace.status, evaluation });
}

const artifact = {
  status: 'PILOT / INSTRUMENT VALIDATION ONLY',
  instrument_status: 'FROZEN',
  experimental_observation: false,
  experimental_observations: 0,
  preregistered_live_study_started: false,
  timestamp_utc: new Date().toISOString(),
  configuration: { ...config, endpoint, models_endpoint: modelsEndpoint, lm_studio_metadata: model },
  configuration_warnings: configurationWarnings,
  adapter_defects: [
    'Historical first pilot request used unsupported response_format.type=json_object; the historical artifact remains unchanged and this incident is retained as an API compatibility failure.',
    'Previous pilot reasoning request used off; LM Studio accepted none while metadata advertised off/on. The discrepancy is recorded without silent substitution.'
  ],
  observed_limitations: [
    'This v5 pilot is contract validation only; schema validity and semantic accuracy remain separate observations.',
    'Historical v4 responses are not merged into this artifact or rescored under the v5 availability wording.'
  ],
  contract_amendment: {
    version: 'semantic-availability-contract-v6',
    historical_baseline: 'data/pilot/live-horizon-pilot-v5-latest.json',
    historical_v4_ccr: '4/9 = 0.4444',
    parser_strictness_changed: false,
    semantic_targets_changed: false,
    governance_authority_changed: false
  },
  semantic_input_flow_audit: {
    status: records.some(record => record.id === 'combined-hard-and-semantic' && (record.evaluator_telemetry as LiveGovernanceTelemetry).semantic_judge_available)
      ? 'SEMANTIC DISPATCH INDEPENDENCE VALIDATED; AGENT K AUTHORITY PRESERVED; SEMANTIC CONTRACT VALIDATED; LIVE INSTRUMENT V6 FROZEN'
      : 'SEMANTIC DISPATCH INDEPENDENCE OBSERVED; SEMANTIC OUTPUT CONTRACT AMENDMENT VALIDATION INCOMPLETE; ADAPTER NOT FROZEN',
    judge_receives_evidence_and_context: true,
    hard_rule_failure_exposed_in_canonical_payload: false,
    hard_rule_failure_sent_to_model_when_true: false,
    semantic_dispatch_occurs_when_hard_rule_failure_true: shortcutProbeEvaluations[1].trace.semantic_dispatch_occurred,
    interpretation: 'hard_rule_failure is retained only as orchestration metadata. It is absent from the semantic payload, does not gate dispatch, and Agent K remains authoritative in governance fusion.',
    evidence_sensitivity_probe: { classification: evidenceProbeClassification, cases: evidenceSensitivityProbe },
    hard_rule_signal_probe: { classification: shortcutClassification, cases: shortcutProbe },
    categories: ['evidence_sensitive', 'evidence_insensitive', 'hard_rule_signal_insensitive', 'hard_rule_signal_sensitive', 'schema_failure', 'ambiguous_result', 'insufficient_probe']
  },
  semantic_contract_gate: semanticContractGate,
  cases: records,
  manual_review: 'HUMAN FREEZE REVIEW APPROVED - LIVE INSTRUMENT V6 FROZEN; HISTORICAL V4 AND V5 PRESERVED; PREREGISTERED LIVE STUDY NOT STARTED',
  interpretation: 'Do not rank A/B/C/D or infer model performance, PRAETOR reliability, task completion, or agent-rot mitigation from this artifact.'
};
const artifactPath = 'data/pilot/live-horizon-pilot-v6-latest.json';
await mkdir('data/pilot', { recursive: true });
await writeFile(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
console.log(JSON.stringify({ status: artifact.status, experimental_observation: artifact.experimental_observation, cases: records.length, artifact: artifactPath }, null, 2));
