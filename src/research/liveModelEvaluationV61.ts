import {
  LmStudioSemanticJudge,
  SEMANTIC_PROMPT_FINGERPRINT,
  type LiveGovernanceTelemetry,
  type LiveJudgeEvaluation,
  type LiveJudgeInput,
  type LiveJudgeTrace,
  type LmStudioConfig
} from './liveModelEvaluation.js';
import type { HorizonJudgeResult } from './horizonEvaluation.js';

export const LIVE_ADAPTER_VERSION_V61 = 'lm-studio-semantic-judge-v6.1';

export interface LiveSemanticObservation {
  available: boolean;
  semantic_error: boolean;
  confidence?: number;
  reason: string;
  status: LiveJudgeTrace['status'];
  raw_model_output: string | null;
  parsed_intermediate: unknown | null;
  request_fingerprint: string;
  response_fingerprint: string | null;
  canonical_semantic_payload_fingerprint: string;
  configuration_fingerprint: string;
  adapter_version: string;
  prompt_fingerprint: string;
}

export interface LiveGovernanceTelemetryV61 extends LiveGovernanceTelemetry {
  governance_reason: string;
}

export interface LiveJudgeAndGovernance {
  semantic_observation: LiveSemanticObservation;
  governance: LiveGovernanceTelemetryV61;
}

export interface LiveJudgeEvaluationV61 extends Omit<LiveJudgeEvaluation, 'result' | 'governance'> {
  result: HorizonJudgeResult;
  semantic_observation: LiveSemanticObservation;
  judge_and_governance: LiveJudgeAndGovernance;
  governance: LiveGovernanceTelemetryV61;
}

function semanticDecision(result: HorizonJudgeResult): 'PASS' | 'FAIL' | null {
  return result.available ? (result.semantic_error ? 'FAIL' : 'PASS') : null;
}

function evaluatorAgreement(input: LiveJudgeInput, result: HorizonJudgeResult, trace: LiveJudgeTrace): LiveGovernanceTelemetry['evaluator_agreement'] {
  const decision = semanticDecision(result);
  if (!result.available) {
    return trace.status === 'invalid_schema' || trace.status === 'malformed_json' || trace.status === 'missing_fields' || trace.status === 'parse_error'
      ? 'judge_schema_failure'
      : 'judge_unavailable';
  }
  if (input.hard_rule_failure) return decision === 'FAIL' ? 'both_fail' : 'k_fail_judge_pass';
  return decision === 'FAIL' ? 'k_pass_judge_fail' : 'both_pass';
}

function semanticObservation(result: HorizonJudgeResult, trace: LiveJudgeTrace): LiveSemanticObservation {
  return {
    ...result,
    status: trace.status,
    raw_model_output: trace.raw_model_output,
    parsed_intermediate: trace.parsed_intermediate,
    request_fingerprint: trace.request_fingerprint,
    response_fingerprint: trace.response_fingerprint,
    canonical_semantic_payload_fingerprint: trace.canonical_semantic_payload_fingerprint,
    configuration_fingerprint: trace.configuration_fingerprint,
    adapter_version: trace.adapter_version,
    prompt_fingerprint: trace.prompt_fingerprint
  };
}

export function v61Config(config: Partial<LmStudioConfig> = {}): Partial<LmStudioConfig> {
  return {
    ...config,
    adapter_version: LIVE_ADAPTER_VERSION_V61,
    prompt_fingerprint: SEMANTIC_PROMPT_FINGERPRINT,
    system_prompt_fingerprint: SEMANTIC_PROMPT_FINGERPRINT
  };
}

export async function evaluateLiveJudgeWithGovernanceV61(input: LiveJudgeInput, judge: LmStudioSemanticJudge): Promise<LiveJudgeEvaluationV61> {
  const evaluation = await judge.evaluateWithTrace(input);
  const governanceStarted = Date.now();
  const semanticJudgeDecision = semanticDecision(evaluation.result);
  const governance: LiveGovernanceTelemetryV61 = {
    agent_k_decision: input.hard_rule_failure ? 'FAIL' : 'PASS',
    semantic_judge_available: evaluation.result.available,
    semantic_judge_decision: semanticJudgeDecision,
    semantic_judge_status: evaluation.trace.status,
    evaluator_agreement: evaluatorAgreement(input, evaluation.result, evaluation.trace),
    governed_disposition: input.hard_rule_failure ? 'FAIL' : !evaluation.result.available ? 'UNAVAILABLE' : evaluation.result.semantic_error ? 'FAIL' : 'PASS',
    semantic_dispatch_occurred: evaluation.trace.semantic_dispatch_occurred,
    authority_override_attempted: evaluation.trace.authority_override_attempted,
    governance_reason: input.hard_rule_failure
      ? 'Agent K hard-rule failure is non-overridable.'
      : !evaluation.result.available
        ? 'Semantic observation unavailable; governed result is fail-closed.'
        : evaluation.result.semantic_error
          ? 'Semantic observation indicates a semantic error.'
          : 'No semantic error observed.'
  };
  const governanceEvaluationMs = Date.now() - governanceStarted;
  const trace = {
    ...evaluation.trace,
    elapsed_ms: evaluation.trace.elapsed_ms + governanceEvaluationMs,
    stage_timings: {
      ...evaluation.trace.stage_timings,
      governance_evaluation_ms: governanceEvaluationMs,
      total_elapsed_ms: evaluation.trace.elapsed_ms + governanceEvaluationMs
    }
  };
  const observation = semanticObservation(evaluation.result, trace);
  return {
    result: evaluation.result,
    trace,
    semantic_observation: observation,
    governance,
    judge_and_governance: { semantic_observation: observation, governance }
  };
}
