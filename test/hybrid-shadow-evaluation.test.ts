import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { scenarioFixtures } from '../src/scenarios.js';
import { LmStudioSemanticJudge } from '../src/research/liveModelEvaluation.js';
import { v61Config } from '../src/research/liveModelEvaluationV61.js';
import {
  appendHybridShadowRecord,
  evaluateHybridShadow,
  readHybridShadowRecords,
  summarizeHybridShadow
} from '../experiments/hybrid_shadow/hybridShadowEvaluation.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

function response(semanticError: boolean, confidence = 0.9): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ available: true, semantic_error: semanticError, confidence, reason: semanticError ? 'Candidate qualification mismatch.' : 'No semantic error observed.' }) } }]
  }), { status: 200 });
}

function judge(semanticError: boolean, confidence = 0.9): LmStudioSemanticJudge {
  return new LmStudioSemanticJudge(
    v61Config({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions', model: 'synthetic-shadow-judge', model_fingerprint: 'synthetic-fixture' }),
    async () => response(semanticError, confidence)
  );
}

const safePacket = scenarioFixtures.find(fixture => fixture.expected_verdict === 'safe')!.packet;
const blockedPacket = scenarioFixtures.find(fixture => fixture.expected_verdict === 'unsafe')!.packet;

describe('hybrid shadow evaluation', () => {
  it('records agreement without changing deterministic authority', async () => {
    const record = await evaluateHybridShadow({ packet: safePacket, judge: judge(false), trace_id: 'shadow-agree-safe' });

    expect(record.hybrid_shadow_interpretation.disagreement_class).toBe('AGREE_SAFE');
    expect(record.final_authority_decision).toMatchObject({ source: 'evaluateAdvisoryPacket', accepted: true, unchanged_by_shadow: true });
    expect(record.semantic_observation).toMatchObject({ available: true, semantic_error: false, adapter_version: 'lm-studio-semantic-judge-v6.1' });
    expect(record.metrics.trace_complete).toBe(true);
    expect(Object.values(record.authority_effect).some(Boolean)).toBe(false);
  });

  it('preserves a deterministic block when the semantic judge says safe', async () => {
    const record = await evaluateHybridShadow({ packet: blockedPacket, judge: judge(false), trace_id: 'shadow-contained' });

    expect(record.hybrid_shadow_interpretation).toMatchObject({
      disagreement_class: 'SEMANTIC_SAFE_DETERMINISTIC_BLOCK',
      false_positive_candidate: true
    });
    expect(record.final_authority_decision).toMatchObject({ accepted: false, unchanged_by_shadow: true });
    expect(record.metrics.deterministic_containment_applied).toBe(true);
  });

  it('records a semantic concern against deterministic allow only as a candidate disagreement', async () => {
    const record = await evaluateHybridShadow({ packet: safePacket, judge: judge(true), trace_id: 'shadow-review-candidate' });

    expect(record.hybrid_shadow_interpretation).toMatchObject({
      disagreement_class: 'SEMANTIC_BLOCK_DETERMINISTIC_ALLOW',
      false_negative_candidate: true
    });
    expect(record.final_authority_decision.accepted).toBe(true);
    expect(record.authority_effect.execution_authorized).toBe(false);
  });

  it('reports an omitted judge as unavailable without substituting a fake result', async () => {
    const record = await evaluateHybridShadow({ packet: safePacket, trace_id: 'shadow-unavailable' });

    expect(record.hybrid_shadow_interpretation.disagreement_class).toBe('JUDGE_UNAVAILABLE');
    expect(record.semantic_observation).toBeNull();
    expect(record.semantic_trace).toBeNull();
    expect(record.metrics.semantic_judge_available).toBe(false);
    expect(record.final_authority_decision.accepted).toBe(true);
  });

  it('keeps malformed semantic output separate from deterministic authority', async () => {
    const malformedJudge = new LmStudioSemanticJudge(
      v61Config({ enabled: true, endpoint: 'http://127.0.0.1:1234/v1/chat/completions' }),
      async () => new Response(JSON.stringify({ choices: [{ message: { content: '{not-json' } }] }), { status: 200 })
    );
    const record = await evaluateHybridShadow({ packet: blockedPacket, judge: malformedJudge, trace_id: 'shadow-schema-failure' });

    expect(record.hybrid_shadow_interpretation.disagreement_class).toBe('SEMANTIC_UNCERTAIN');
    expect(record.metrics.schema_failure).toBe(true);
    expect(record.final_authority_decision.accepted).toBe(false);
  });

  it('appends shadow records separately and summarizes bounded candidate metrics', async () => {
    const root = await mkdtemp(join(tmpdir(), 'praetor-hybrid-shadow-'));
    temporaryRoots.push(root);
    const path = join(root, 'shadow-results.ndjson');
    const records = [
      await evaluateHybridShadow({ packet: safePacket, judge: judge(false), trace_id: 'agree' }),
      await evaluateHybridShadow({ packet: blockedPacket, judge: judge(false), trace_id: 'candidate-fp' }),
      await evaluateHybridShadow({ packet: safePacket, judge: judge(true), trace_id: 'candidate-fn' })
    ];
    for (const record of records) await appendHybridShadowRecord(path, record);

    expect(await readHybridShadowRecords(path)).toHaveLength(3);
    expect(summarizeHybridShadow(records)).toMatchObject({
      total_records: 3,
      agreement_rate: 1 / 3,
      disagreement_rate: 2 / 3,
      semantic_judge_availability_rate: 1,
      deterministic_containment_rate: 1,
      false_positive_candidate_cases: [blockedPacket.packet_id],
      false_negative_candidate_cases: [safePacket.packet_id],
      trace_completeness_rate: 1
    });
  });
});
