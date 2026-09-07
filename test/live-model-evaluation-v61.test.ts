import { describe, expect, it } from 'vitest';

import { evaluateLiveJudgeWithGovernanceV61, LIVE_ADAPTER_VERSION_V61, v61Config } from '../src/research/liveModelEvaluationV61.js';
import { LmStudioSemanticJudge } from '../src/research/liveModelEvaluation.js';

function response(content: unknown): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 });
}

function judge(result: unknown): LmStudioSemanticJudge {
  return new LmStudioSemanticJudge(v61Config({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }), async () => response(result));
}

describe('v6.1 trace integrity boundary', () => {
  it.each([
    ['K PASS, Judge PASS', false, false, 'PASS', 'both_pass'],
    ['K PASS, Judge FAIL', false, true, 'FAIL', 'k_pass_judge_fail'],
    ['K FAIL, Judge PASS', true, false, 'FAIL', 'k_fail_judge_pass'],
    ['K FAIL, Judge FAIL', true, true, 'FAIL', 'both_fail']
  ])('%s keeps semantic observation separate from governance', async (_label, hardRuleFailure, semanticError, disposition, agreement) => {
    const evaluation = await evaluateLiveJudgeWithGovernanceV61(
      { step: 1, semantic_claim: 'The action is authorized and the transition violates a precondition.', hard_rule_failure: hardRuleFailure, evidence_context: { evidence: 'Synthetic evidence.', context: 'Synthetic context.' } },
      judge({ available: true, semantic_error: semanticError, confidence: 1, reason: semanticError ? 'Qualification mismatch.' : 'No semantic error.' })
    );

    expect(evaluation.semantic_observation).toMatchObject({ available: true, semantic_error: semanticError, confidence: 1 });
    expect(evaluation.judge_and_governance.semantic_observation.semantic_error).toBe(semanticError);
    expect(evaluation.governance).toMatchObject({ governed_disposition: disposition, evaluator_agreement: agreement });
    expect(evaluation.semantic_observation).toMatchObject(evaluation.result);
    expect(evaluation.trace.adapter_version).toBe(LIVE_ADAPTER_VERSION_V61);
  });

  it('keeps an unavailable semantic observation unavailable while Agent K remains authoritative', async () => {
    const evaluation = await evaluateLiveJudgeWithGovernanceV61(
      { step: 1, semantic_claim: 'A claim.', hard_rule_failure: true },
      new LmStudioSemanticJudge(v61Config({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }), async () => { throw new Error('synthetic transport failure'); })
    );

    expect(evaluation.semantic_observation).toMatchObject({ available: false, semantic_error: false });
    expect(evaluation.governance).toMatchObject({ agent_k_decision: 'FAIL', semantic_judge_decision: null, governed_disposition: 'FAIL' });
    expect(evaluation.governance.governance_reason).toContain('non-overridable');
  });

  it('preserves schema failure separately from governance', async () => {
    const evaluation = await evaluateLiveJudgeWithGovernanceV61(
      { step: 1, semantic_claim: 'A claim.', hard_rule_failure: false },
      judge({ available: false, semantic_error: true, confidence: 1, reason: 'Invalid availability combination.' })
    );

    expect(evaluation.semantic_observation).toMatchObject({ available: false, semantic_error: false, status: 'invalid_schema' });
    expect(evaluation.trace.schema_violation_category).toBe('available_false_incompatible_fields');
    expect(evaluation.governance).toMatchObject({ governed_disposition: 'UNAVAILABLE', governance_reason: 'Semantic observation unavailable; governed result is fail-closed.' });
  });

  it('preserves semantic provenance and derives expectation fields only from the observation', async () => {
    const evaluation = await evaluateLiveJudgeWithGovernanceV61(
      { step: 1, semantic_claim: 'A claim.', hard_rule_failure: true },
      judge({ available: true, semantic_error: true, confidence: 0.8, reason: 'Qualification mismatch.' })
    );

    expect(evaluation.semantic_observation.semantic_error).toBe(true);
    expect(evaluation.semantic_observation.raw_model_output).toBe(evaluation.trace.raw_model_output);
    expect(evaluation.semantic_observation.response_fingerprint).toBe(evaluation.trace.response_fingerprint);
    expect(evaluation.semantic_observation.request_fingerprint).toBe(evaluation.trace.request_fingerprint);
    expect(evaluation.semantic_observation.canonical_semantic_payload_fingerprint).toBe(evaluation.trace.canonical_semantic_payload_fingerprint);
    expect(evaluation.semantic_observation.adapter_version).toBe(LIVE_ADAPTER_VERSION_V61);
    expect(evaluation.governance.governed_disposition).toBe('FAIL');
  });
});
