import { describe, expect, it } from 'vitest';

import { createHash } from 'node:crypto';

import { DEFAULT_LM_STUDIO_CONFIG, evaluateLiveJudgeWithGovernance, LmStudioSemanticJudge, LmStudioTrajectoryClient } from '../src/research/liveModelEvaluation.js';

function response(body: string, ok = true): Response {
  return new Response(body, { status: ok ? 200 : 503, headers: { 'content-type': 'application/json' } });
}

function completion(content: string): string {
  return JSON.stringify({ choices: [{ message: { content } }] });
}

describe('opt-in live semantic judge boundary', () => {
  it('is disabled by default and preserves deterministic behavior', async () => {
    let calls = 0;
    const judge = new LmStudioSemanticJudge({}, async () => {
      calls += 1;
      return response('unexpected');
    });

    const evaluation = await evaluateLiveJudgeWithGovernance({ step: 1, semantic_claim: 'The action is authorized.', hard_rule_failure: false }, judge);

    expect(DEFAULT_LM_STUDIO_CONFIG.enabled).toBe(false);
    expect(calls).toBe(0);
    expect(evaluation.result).toMatchObject({ available: true, semantic_error: true });
    expect(evaluation.trace.status).toBe('accepted');
    expect(evaluation.trace.raw_model_output).toBeNull();
  });

  it('accepts a semantic-only live judgment', async () => {
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }, async () => response(completion(JSON.stringify({ available: true, semantic_error: true, confidence: 0.8, reason: 'Ambiguous authorization wording.' }))));

    const evaluation = await evaluateLiveJudgeWithGovernance({
      step: 2,
      semantic_claim: 'The wording is ambiguous.',
      hard_rule_failure: false,
      evidence_context: { evidence: 'Two readings use different units.', context: 'The unit is not identified.' }
    }, judge);

    expect(evaluation.result).toMatchObject({ available: true, semantic_error: true, confidence: 0.8 });
    expect(evaluation.trace.status).toBe('accepted');
    expect(evaluation.trace.response_fingerprint).toBeTruthy();
  });

  it('accepts semantic defects when availability is true under the v5 contract', async () => {
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }, async () => response(completion(JSON.stringify({ available: true, semantic_error: true, confidence: 0.9, reason: 'Contradiction detected.' }))));

    const evaluation = await judge.evaluateWithTrace({ step: 1, semantic_claim: 'The claim is supported.', hard_rule_failure: false, evidence_context: { evidence: 'The evidence contradicts the claim.', context: 'Use only the supplied evidence.' } });

    expect(evaluation.trace.status).toBe('accepted');
    expect(evaluation.result).toEqual({ available: true, semantic_error: true, confidence: 0.9, reason: 'Contradiction detected.' });
  });

  it('preserves the canonical evidence flow and records the exact exposed fields', async () => {
    let requestBody = '';
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }, async (_url, init) => {
      requestBody = String(init?.body);
      return response(completion(JSON.stringify({ available: true, semantic_error: false, confidence: 0.8, reason: 'Bounded.' })));
    });
    const input = {
      step: 7,
      semantic_claim: 'The reading may warrant review.',
      hard_rule_failure: false,
      evidence_context: { evidence: 'Evidence A.', context: 'Context A.' }
    };

    const evaluation = await judge.evaluateWithTrace(input);
    const outerRequest = JSON.parse(requestBody) as { messages: Array<{ content: string }> };
    const semanticPayload = JSON.parse(outerRequest.messages[0].content);

    expect(semanticPayload).toEqual(evaluation.trace.canonical_semantic_payload);
    expect(semanticPayload.input).toEqual({ step: input.step, semantic_claim: input.semantic_claim, evidence_context: input.evidence_context });
    expect(evaluation.trace.semantic_exposed_fields).toEqual([
      'input.step',
      'input.semantic_claim',
      'input.evidence_context.evidence',
      'input.evidence_context.context'
    ]);
    expect(evaluation.trace.canonical_semantic_payload_fingerprint).toBe(createHash('sha256').update(JSON.stringify(semanticPayload), 'utf8').digest('hex'));
    expect(evaluation.trace.serialized_request_body).toBe(requestBody);
    expect(evaluation.trace.request_fingerprint).toBe(createHash('sha256').update(requestBody, 'utf8').digest('hex'));
  });

  it('does not inject unrelated Agent K state into the semantic payload', async () => {
    let requestBody = '';
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }, async (_url, init) => {
      requestBody = String(init?.body);
      return response(completion(JSON.stringify({ available: true, semantic_error: false, confidence: 0.8, reason: 'Bounded.' })));
    });

    await judge.evaluateWithTrace({ step: 1, semantic_claim: 'A claim.', hard_rule_failure: false, evidence_context: { evidence: 'E.', context: 'C.' } });
    const request = JSON.parse(requestBody) as { messages: Array<{ content: string }> };
    const payload = JSON.parse(request.messages[0].content) as { input: Record<string, unknown> };

    expect(Object.keys(payload.input).sort()).toEqual(['evidence_context', 'semantic_claim', 'step']);
    expect(payload.input).not.toHaveProperty('hard_rule_failure');
    expect(payload.input).not.toHaveProperty('agent_k_decision');
    expect(payload.input).not.toHaveProperty('integrity_verdict');
    expect(payload.input).not.toHaveProperty('governance');
  });

  it('dispatches independently when hard_rule_failure is true and keeps Agent K authoritative', async () => {
    let calls = 0;
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }, async () => {
      calls += 1;
      return response(completion(JSON.stringify({ available: true, semantic_error: false, confidence: 0.8, reason: 'Bounded.' })));
    });
    const input = { step: 1, semantic_claim: 'The action is authorized.', hard_rule_failure: true, evidence_context: { evidence: 'E.', context: 'C.' } };
    const evaluation = await judge.evaluateWithTrace(input);

    expect(calls).toBe(1);
    expect(evaluation.trace.semantic_dispatch_occurred).toBe(true);
    expect(evaluation.trace.canonical_semantic_payload.input).not.toHaveProperty('hard_rule_failure');
    expect(evaluation.trace.serialized_request_body).not.toContain('hard_rule_failure');
    expect(evaluation.result).toMatchObject({ available: true, semantic_error: false });
  });

  it('gives the live judge a semantic ambiguity role beyond hard-rule checks', async () => {
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://localhost:1234/v1/chat/completions' }, async () => response(completion(JSON.stringify({ available: true, semantic_error: true, confidence: 0.9, reason: 'The claim is ambiguous and overstates what the evidence supports.' }))));

    const evaluation = await evaluateLiveJudgeWithGovernance({ step: 4, semantic_claim: 'The evidence proves the component will fail soon.', hard_rule_failure: false }, judge);

    expect(evaluation.result).toMatchObject({ available: true, semantic_error: true });
    expect(evaluation.trace.status).toBe('accepted');
  });

  it('cannot convert a hard Agent K failure into a pass', async () => {
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }, async () => response(completion(JSON.stringify({ available: true, semantic_error: false, confidence: 1, reason: 'Looks acceptable.' }))));

    const evaluation = await evaluateLiveJudgeWithGovernance({ step: 3, semantic_claim: 'The action is authorized.', hard_rule_failure: true }, judge);

    expect(evaluation.result).toMatchObject({ available: true, semantic_error: false });
    expect(evaluation.governance).toMatchObject({
      agent_k_decision: 'FAIL',
      semantic_judge_available: true,
      semantic_judge_decision: 'PASS',
      evaluator_agreement: 'k_fail_judge_pass',
      governed_disposition: 'FAIL',
      semantic_dispatch_occurred: true
    });
  });

  it('keeps a hard Agent K failure governed FAIL when the semantic judge is unavailable', async () => {
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }, async () => {
      throw new Error('synthetic transport failure');
    });

    const evaluation = await evaluateLiveJudgeWithGovernance({ step: 3, semantic_claim: 'A claim.', hard_rule_failure: true, evidence_context: { evidence: 'E.', context: 'C.' } }, judge);

    expect(evaluation.result).toMatchObject({ available: false, reason: 'judge_unavailable' });
    expect(evaluation.governance).toMatchObject({
      agent_k_decision: 'FAIL',
      semantic_judge_available: false,
      semantic_judge_decision: null,
      evaluator_agreement: 'judge_unavailable',
      governed_disposition: 'FAIL',
      semantic_dispatch_occurred: true
    });
  });

  it('fails closed for malformed JSON, missing fields, refusal, and unavailable endpoint', async () => {
    const cases: Array<{ body: string; status: 'parse_error' | 'malformed_json' | 'missing_fields' | 'invalid_schema' | 'model_refusal' | 'endpoint_unavailable'; ok?: boolean }> = [
      { body: 'not-json', status: 'parse_error' },
      { body: completion(JSON.stringify({ available: true })), status: 'missing_fields' },
      { body: completion(JSON.stringify({ available: false, semantic_error: true, confidence: 0.9, reason: 'Invalid availability combination.' })), status: 'invalid_schema' },
      { body: JSON.stringify({ choices: [{ message: { refusal: 'Cannot comply.' } }] }), status: 'model_refusal' },
      { body: 'unavailable', status: 'endpoint_unavailable', ok: false }
    ] as const;

    for (const testCase of cases) {
      const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }, async () => response(testCase.body, testCase.ok ?? true));
      const evaluation = await judge.evaluateWithTrace({ step: 1, semantic_claim: 'A claim.', hard_rule_failure: false });
      expect(evaluation.result).toEqual({ available: false, semantic_error: false, reason: testCase.status === 'endpoint_unavailable' ? 'judge_unavailable' : 'judge_malformed' });
      expect(evaluation.trace.status).toBe(testCase.status);
    }
  });

  it('classifies structural violations without loosening the semantic contract', async () => {
    const cases = [
      { body: completion(JSON.stringify({ available: false, semantic_error: true, confidence: 0.9, reason: 'No.' })), category: 'available_false_incompatible_fields', status: 'invalid_schema' },
      { body: completion(JSON.stringify({ available: true, semantic_error: false, confidence: 1.1, reason: 'Out of range.' })), category: 'confidence_out_of_range', status: 'malformed_json' },
      { body: completion('Here is the JSON: {"available":true}'), category: 'extra_wrapper_content', status: 'malformed_json' },
      { body: JSON.stringify({ choices: [{ message: { refusal: { reason: 'no' } } }] }), category: 'malformed_refusal', status: 'malformed_refusal' }
    ] as const;

    for (const testCase of cases) {
      const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }, async () => response(testCase.body));
      const evaluation = await judge.evaluateWithTrace({ step: 1, semantic_claim: 'A claim.', hard_rule_failure: false });

      expect(evaluation.result).toEqual({ available: false, semantic_error: false, reason: 'judge_malformed' });
      expect(evaluation.trace.status).toBe(testCase.status);
      expect(evaluation.trace.schema_violation_category).toBe(testCase.category);
      expect(evaluation.trace.violated_rule).toBeTruthy();
      expect(evaluation.trace.raw_model_output).toBe(testCase.body);
      expect(evaluation.trace.response_fingerprint).toBeTruthy();
      expect(evaluation.trace.canonical_semantic_payload_fingerprint).toBeTruthy();
      expect(evaluation.trace.configuration_fingerprint).toBeTruthy();
    }
  });

  it('records authority override attempts while rejecting them', async () => {
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }, async () => response(completion(JSON.stringify({ available: true, semantic_error: false, confidence: 1, reason: 'Pass.', authority: 'authorized' }))));
    const evaluation = await judge.evaluateWithTrace({ step: 1, semantic_claim: 'A claim.', hard_rule_failure: false });

    expect(evaluation.result).toEqual({ available: false, semantic_error: false, reason: 'judge_malformed' });
    expect(evaluation.trace.authority_override_attempted).toBe(true);
    expect(evaluation.trace.raw_model_output).toContain('authorized');
  });

  it('records timeout as unavailable without retrying', async () => {
    let calls = 0;
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions', timeout_ms: 5 }, async (_url, init) => {
      calls += 1;
      await new Promise<void>(resolve => setTimeout(resolve, 20));
      if (init?.signal?.aborted) throw new DOMException('Timed out', 'AbortError');
      return response(completion(JSON.stringify({ available: true, semantic_error: false, confidence: 1, reason: 'late' })));
    });
    const evaluation = await judge.evaluateWithTrace({ step: 1, semantic_claim: 'A claim.', hard_rule_failure: false });

    expect(evaluation.result).toEqual({ available: false, semantic_error: false, reason: 'judge_unavailable' });
    expect(evaluation.trace.status).toBe('timeout');
    expect(calls).toBe(1);
    expect(evaluation.trace.failure_origin).toBe('client_timeout');
    expect(evaluation.trace.stage_timings.time_to_headers_ms).toBeNull();
    expect(evaluation.trace.stage_timings.total_elapsed_ms).toBe(evaluation.trace.elapsed_ms);
  });

  it('rejects non-local enabled endpoints', () => {
    expect(() => new LmStudioSemanticJudge({ enabled: true, endpoint: 'https://example.invalid/v1/chat/completions' })).toThrow('localhost');
  });

  it('captures a model-generated trajectory step without granting authority', async () => {
    const client = new LmStudioTrajectoryClient({ enabled: true, endpoint: 'http://localhost:1234/v1/chat/completions', model: 'pilot-model' }, async () => response(completion(JSON.stringify({ semantic_claim: 'The evidence may indicate ambiguity.', proposed_transition: 'request_human_review' }))));
    const step = await client.generateStep('task-1', 2, 1);

    expect(step).toMatchObject({ available: true, semantic_claim: 'The evidence may indicate ambiguity.', proposed_transition: 'request_human_review' });
    expect(step.trace.raw_model_output).toBeTruthy();
    expect(step.trace.model).toBe('pilot-model');
    expect(step.trace.authority_override_attempted).toBe(false);
  });

  it('fails closed when a trajectory step attempts authority', async () => {
    const client = new LmStudioTrajectoryClient({ enabled: true, endpoint: 'http://localhost:1234/v1/chat/completions' }, async () => response(completion(JSON.stringify({ semantic_claim: 'The action is authorized.', proposed_transition: 'approve', authority: 'system' }))));
    const step = await client.generateStep('task-1', 2, 1);

    expect(step.available).toBe(false);
    expect(step.trace.status).toBe('malformed_json');
    expect(step.trace.authority_override_attempted).toBe(true);
    expect(step.raw_model_output).toContain('authorized');
  });

  it('records request metadata and stage timings without changing the accepted result', async () => {
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://localhost:1234/v1/chat/completions' }, async () => response(completion(JSON.stringify({ available: true, semantic_error: false, confidence: 0.7, reason: 'Bounded claim.' }))));
    const evaluation = await evaluateLiveJudgeWithGovernance({
      step: 1,
      semantic_claim: 'The reading may warrant additional monitoring.',
      hard_rule_failure: false,
      evidence_context: { evidence: 'One elevated reading; no established trend.', context: 'No failure threshold is available.' }
    }, judge);

    expect(evaluation.result).toMatchObject({ available: true, semantic_error: false });
    expect(evaluation.trace.request_size_bytes).toBeGreaterThan(0);
    expect(evaluation.trace.input_token_count).toBeNull();
    expect(evaluation.trace.stage_timings.request_construction_ms).toBeGreaterThanOrEqual(0);
    expect(evaluation.trace.stage_timings.time_to_headers_ms).toBeGreaterThanOrEqual(0);
    expect(evaluation.trace.stage_timings.model_completion_ms).toBeGreaterThanOrEqual(0);
    expect(evaluation.trace.stage_timings.parsing_normalization_ms).toBeGreaterThanOrEqual(0);
    expect(evaluation.trace.stage_timings.governance_evaluation_ms).toBeGreaterThanOrEqual(0);
  });

  it('classifies LM Studio response-format errors as API compatibility failures', async () => {
    const judge = new LmStudioSemanticJudge({ enabled: true, endpoint: 'http://localhost:1234/v1/chat/completions' }, async () => response(JSON.stringify({ error: { message: "Invalid 'response_format'" } }), false));
    const evaluation = await judge.evaluateWithTrace({ step: 1, semantic_claim: 'A claim.', hard_rule_failure: false });

    expect(evaluation.trace.status).toBe('api_compatibility_error');
    expect(evaluation.trace.failure_origin).toBe('api_error');
    expect(evaluation.trace.error_detail).toContain('response_format');
  });
});
