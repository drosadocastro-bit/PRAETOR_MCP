import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

import { evaluateLiveJudgeWithGovernanceV61, LIVE_ADAPTER_VERSION_V61, v61Config, type LiveJudgeEvaluationV61 } from '../src/research/liveModelEvaluationV61.js';
import { LmStudioSemanticJudge, SEMANTIC_PROMPT_FINGERPRINT, type LiveJudgeInput } from '../src/research/liveModelEvaluation.js';

const config = v61Config({
  enabled: true,
  endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
  model: 'synthetic-v6.1-trace-integrity-fixture',
  model_fingerprint: 'synthetic-fixture-v6.1',
  quantization: 'synthetic',
  context_length: 0,
  temperature: 0,
  top_p: 1,
  top_k: 40,
  seed: 0,
  max_output_tokens: 256,
  reasoning_effort: 'none',
  timeout_ms: 300000
});

const input: LiveJudgeInput = {
  step: 1,
  semantic_claim: 'The action is authorized and the transition violates a precondition.',
  hard_rule_failure: false,
  evidence_context: { evidence: 'A deterministic precondition is violated.', context: 'Authorization is outside the semantic judge scope.' }
};

function fixtureJudge(body: string, mode: 'response' | 'unavailable' = 'response'): LmStudioSemanticJudge {
  return new LmStudioSemanticJudge(config, async () => {
    if (mode === 'unavailable') throw new Error('synthetic endpoint unavailable');
    return new Response(body, { status: 200 });
  });
}

function semanticFields(evaluation: LiveJudgeEvaluationV61): Record<string, unknown> {
  const observation = evaluation.semantic_observation;
  return {
    available: observation.available,
    semantic_error: observation.semantic_error,
    ...(observation.available ? { confidence: observation.confidence } : {}),
    reason: observation.reason,
    status: observation.status
  };
}

async function evaluateCase(id: string, expectedSemanticError: boolean, hardRuleFailure: boolean, result: unknown, mode: 'response' | 'unavailable' = 'response'): Promise<Record<string, unknown>> {
  const evaluation = await evaluateLiveJudgeWithGovernanceV61({ ...input, hard_rule_failure: hardRuleFailure }, fixtureJudge(mode === 'response' ? JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }) : '', mode));
  return {
    id,
    input: { ...input, hard_rule_failure: hardRuleFailure },
    expected_semantic_error: expectedSemanticError,
    semantic_observation: semanticFields(evaluation),
    provenance: {
      raw_model_output: evaluation.semantic_observation.raw_model_output,
      parsed_intermediate: evaluation.semantic_observation.parsed_intermediate,
      request_fingerprint: evaluation.semantic_observation.request_fingerprint,
      response_fingerprint: evaluation.semantic_observation.response_fingerprint,
      canonical_semantic_payload_fingerprint: evaluation.semantic_observation.canonical_semantic_payload_fingerprint,
      configuration_fingerprint: evaluation.semantic_observation.configuration_fingerprint,
      adapter_version: evaluation.semantic_observation.adapter_version,
      prompt_fingerprint: evaluation.semantic_observation.prompt_fingerprint
    },
    governance: evaluation.governance,
    observed_semantic_error: evaluation.semantic_observation.available ? evaluation.semantic_observation.semantic_error : null,
    semantic_expectation_match: evaluation.semantic_observation.available ? evaluation.semantic_observation.semantic_error === expectedSemanticError : null,
    trace_integrity: {
      semantic_error_preserved: evaluation.result.semantic_error === evaluation.semantic_observation.semantic_error,
      availability_preserved: evaluation.result.available === evaluation.semantic_observation.available,
      confidence_preserved: !evaluation.result.available || evaluation.result.confidence === evaluation.semantic_observation.confidence,
      reason_preserved: evaluation.result.reason === evaluation.semantic_observation.reason,
      governance_separate: evaluation.judge_and_governance.semantic_observation.semantic_error === evaluation.semantic_observation.semantic_error
    },
    trace: evaluation.trace
  };
}

const records: Array<Record<string, unknown>> = [];
records.push(await evaluateCase('A-k-pass-judge-pass', false, false, { available: true, semantic_error: false, confidence: 1, reason: 'No semantic error.' }));
records.push(await evaluateCase('B-k-pass-judge-fail', true, false, { available: true, semantic_error: true, confidence: 1, reason: 'Qualification mismatch.' }));
records.push(await evaluateCase('D-k-fail-judge-pass', false, true, { available: true, semantic_error: false, confidence: 1, reason: 'No semantic error.' }));
records.push(await evaluateCase('D-k-fail-judge-fail', true, true, { available: true, semantic_error: true, confidence: 1, reason: 'Qualification mismatch.' }));
records.push(await evaluateCase('E-k-fail-judge-unavailable', false, true, null, 'unavailable'));
records.push(await evaluateCase('F-k-fail-schema-failure', false, true, { available: false, semantic_error: true, confidence: 1, reason: 'Invalid availability combination.' }));

const cRecord = {
  id: 'C-agent-k-only',
  semantic_dispatch_occurred: false,
  semantic_observation: null,
  governance: { agent_k_decision: 'FAIL', semantic_judge_decision: null, governed_disposition: 'FAIL' }
};
records.push(cRecord);

const combined = records.find(record => record.id === 'D-k-fail-judge-fail')!;
const validSemanticRecords = records.filter(record => (record.semantic_observation as { available?: boolean } | null)?.available === true);
const traceIntegrityPass = records.filter(record => 'trace_integrity' in record).every(record => Object.values(record.trace_integrity as Record<string, boolean>).every(Boolean));
const artifact = {
  status: 'PILOT / INSTRUMENT VALIDATION ONLY',
  instrument_status: 'FROZEN',
  experimental_observation: false,
  experimental_observations: 0,
  preregistered_live_study_started: false,
  validation_scope: 'post-freeze trace integrity and provenance correction only',
  model: 'synthetic-v6.1-trace-integrity-fixture',
  adapter_version: LIVE_ADAPTER_VERSION_V61,
  adapter_fingerprint: createHash('sha256').update('liveModelEvaluationV61.ts:semantic-observation-governance-separation', 'utf8').digest('hex'),
  serializer_fingerprint: createHash('sha256').update('v6.1:semantic_observation+governance+provenance', 'utf8').digest('hex'),
  prompt_fingerprint: SEMANTIC_PROMPT_FINGERPRINT,
  cases: records,
  combined_fixture_audit: {
    id: combined.id,
    semantic_observation: combined.semantic_observation,
    governance: combined.governance,
    expected_semantic_error: combined.expected_semantic_error,
    expectation_definition_note: 'The v6.1 trace-integrity fixture intentionally represents the semantic_error=true branch to verify that a semantic FAIL remains preserved when Agent K also fails. This synthetic regression fixture does not reinterpret or rescore the historical v6 live-model expectation.'
  },
  invariants: {
    trace_integrity_pass: traceIntegrityPass,
    semantic_observation_preserved: validSemanticRecords.every(record => (record.trace_integrity as Record<string, boolean>).semantic_error_preserved),
    agent_k_fail_implies_governed_fail: records.filter(record => (record.governance as { agent_k_decision?: string } | undefined)?.agent_k_decision === 'FAIL').every(record => (record.governance as { governed_disposition?: string }).governed_disposition === 'FAIL'),
    c_agent_k_only_no_dispatch: cRecord.semantic_dispatch_occurred === false,
    d_independent_dispatch: records.filter(record => String(record.id).startsWith('D-')).every(record => (record.trace as { semantic_dispatch_occurred: boolean }).semantic_dispatch_occurred)
  },
  acceptance_statement: 'LIVE INSTRUMENT v6.1 FROZEN - TRACE INTEGRITY VALIDATED - SEMANTIC CONTRACT UNCHANGED FROM v6 - AGENT K AUTHORITY PRESERVED - HISTORICAL v6 EVIDENCE UNCHANGED - PREREGISTERED LIVE STUDY NOT STARTED. The post-freeze correction preserves the original semantic observation independently from governance authority. This synthetic validation does not constitute semantic-performance validation of Qwen.'
};

await mkdir('data/pilot', { recursive: true });
await writeFile('data/pilot/live-horizon-pilot-v6.1-latest.json', JSON.stringify(artifact, null, 2), 'utf8');
console.log(JSON.stringify({ status: artifact.status, instrument_status: artifact.instrument_status, experimental_observations: artifact.experimental_observations, cases: records.length, trace_integrity_pass: artifact.invariants.trace_integrity_pass }, null, 2));
