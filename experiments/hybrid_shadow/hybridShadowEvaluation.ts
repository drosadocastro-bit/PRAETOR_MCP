import { createHash, randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { canonicalJson } from '../post_g3b/evidence_store/canonicalJson.js';
import { evaluateAdvisoryPacket, type GovernanceOutcome } from '../../src/governance.js';
import type { AdvisoryPacketDraft } from '../../src/types.js';
import { LmStudioSemanticJudge, type LiveJudgeStatus, type LiveJudgeTrace } from '../../src/research/liveModelEvaluation.js';
import {
  evaluateLiveJudgeWithGovernanceV61,
  LIVE_ADAPTER_VERSION_V61,
  type LiveGovernanceTelemetryV61,
  type LiveJudgeEvaluationV61,
  type LiveSemanticObservation
} from '../../src/research/liveModelEvaluationV61.js';

export const HYBRID_SHADOW_STATUS = 'HYBRID_SHADOW_RESEARCH_CANDIDATE' as const;
export const HYBRID_SHADOW_MODE = 'OFFLINE_SHADOW_NON_AUTHORITATIVE' as const;

export type HybridShadowDisagreementClass =
  | 'AGREE_SAFE'
  | 'AGREE_BLOCK'
  | 'SEMANTIC_SAFE_DETERMINISTIC_BLOCK'
  | 'SEMANTIC_BLOCK_DETERMINISTIC_ALLOW'
  | 'SEMANTIC_UNCERTAIN'
  | 'SHADOW_ERROR'
  | 'JUDGE_UNAVAILABLE';

export interface HybridShadowInput {
  packet: AdvisoryPacketDraft;
  /** Current v6.1-compatible local adapter. Omit it to record judge unavailability. */
  judge?: LmStudioSemanticJudge;
  trace_id?: string;
  step?: number;
  recorded_at?: string;
  uncertainty_confidence_threshold?: number;
}

export interface HybridShadowRecord {
  schema_version: 'praetor-hybrid-shadow-record-v1';
  research_status: typeof HYBRID_SHADOW_STATUS;
  mode: typeof HYBRID_SHADOW_MODE;
  trace_id: string;
  recorded_at: string;
  packet_id: string;
  input_fingerprints: {
    finding_sha256: string;
    semantic_evidence_sha256: string;
  };
  evidence_lineage: {
    source_ids: string[];
    independence_groups: string[];
    derived_from_source_ids: string[];
  };
  deterministic_outcome: GovernanceOutcome;
  semantic_observation: LiveSemanticObservation | null;
  semantic_trace: LiveJudgeTrace | null;
  v61_governance_telemetry: LiveGovernanceTelemetryV61 | null;
  hybrid_shadow_interpretation: {
    disagreement_class: HybridShadowDisagreementClass;
    interpretation: string;
    false_positive_candidate: boolean;
    false_negative_candidate: boolean;
  };
  final_authority_decision: {
    source: 'evaluateAdvisoryPacket';
    verdict: GovernanceOutcome['verdict'];
    accepted: boolean;
    unchanged_by_shadow: true;
  };
  metrics: {
    semantic_judge_available: boolean;
    schema_failure: boolean;
    latency_ms: number | null;
    input_token_count: number | null;
    output_token_count: null;
    trace_complete: boolean;
    deterministic_containment_applied: boolean;
  };
  authority_effect: {
    permission_granted: false;
    deterministic_override: false;
    policy_modified: false;
    execution_authorized: false;
    public_mcp_surface_changed: false;
  };
}

export interface HybridShadowMetrics {
  research_status: typeof HYBRID_SHADOW_STATUS;
  total_records: number;
  agreement_rate: number | null;
  disagreement_rate: number | null;
  semantic_judge_availability_rate: number;
  schema_failure_rate: number;
  average_latency_ms: number | null;
  input_token_count_total: number | null;
  token_usage_observation_rate: number;
  deterministic_containment_rate: number | null;
  false_positive_candidate_cases: string[];
  false_negative_candidate_cases: string[];
  trace_completeness_rate: number;
  disagreement_counts: Record<HybridShadowDisagreementClass, number>;
}

const SCHEMA_FAILURE_STATUSES = new Set<LiveJudgeStatus>(['malformed_json', 'missing_fields', 'invalid_schema', 'parse_error', 'malformed_refusal']);
const HEX_64 = /^[a-f0-9]{64}$/;

function fingerprint(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function semanticEvidence(packet: AdvisoryPacketDraft): { evidence: string; context: string } {
  return {
    evidence: packet.supporting_evidence.map(item => item.excerpt).join('\n---\n'),
    context: [packet.evidence_summary, ...packet.uncertainty].filter((value): value is string => Boolean(value)).join('\n')
  };
}

function isTraceComplete(evaluation: LiveJudgeEvaluationV61 | null): boolean {
  if (!evaluation) return false;
  const trace = evaluation.trace;
  const responseIdentityValid = trace.raw_model_output === null
    ? trace.response_fingerprint === null
    : trace.response_fingerprint !== null && HEX_64.test(trace.response_fingerprint);
  return trace.adapter_version === LIVE_ADAPTER_VERSION_V61
    && HEX_64.test(trace.request_fingerprint)
    && responseIdentityValid
    && HEX_64.test(trace.canonical_semantic_payload_fingerprint)
    && HEX_64.test(trace.configuration_fingerprint)
    && HEX_64.test(trace.prompt_fingerprint)
    && trace.stage_timings.total_elapsed_ms === trace.elapsed_ms
    && trace.semantic_exposed_fields.length > 0;
}

function classify(
  deterministic: GovernanceOutcome,
  evaluation: LiveJudgeEvaluationV61 | null,
  threshold: number,
  shadowError: boolean
): HybridShadowDisagreementClass {
  if (shadowError) return 'SHADOW_ERROR';
  if (!evaluation) return 'JUDGE_UNAVAILABLE';
  const observation = evaluation.semantic_observation;
  if (!observation.available) return SCHEMA_FAILURE_STATUSES.has(observation.status) ? 'SEMANTIC_UNCERTAIN' : 'JUDGE_UNAVAILABLE';
  if ((observation.confidence ?? 0) < threshold) return 'SEMANTIC_UNCERTAIN';
  if (!observation.semantic_error && deterministic.accepted) return 'AGREE_SAFE';
  if (observation.semantic_error && !deterministic.accepted) return 'AGREE_BLOCK';
  if (!observation.semantic_error && !deterministic.accepted) return 'SEMANTIC_SAFE_DETERMINISTIC_BLOCK';
  return 'SEMANTIC_BLOCK_DETERMINISTIC_ALLOW';
}

function interpretation(disagreementClass: HybridShadowDisagreementClass): string {
  const values: Record<HybridShadowDisagreementClass, string> = {
    AGREE_SAFE: 'Semantic observation and deterministic evaluator both support the bounded advisory path.',
    AGREE_BLOCK: 'Semantic observation and deterministic evaluator both identify a blocking concern.',
    SEMANTIC_SAFE_DETERMINISTIC_BLOCK: 'The semantic judge observed no semantic error, while deterministic governance blocked the packet; deterministic authority remains final.',
    SEMANTIC_BLOCK_DETERMINISTIC_ALLOW: 'The semantic judge identified a candidate semantic issue, while deterministic governance accepted the bounded packet; the observation is review-only.',
    SEMANTIC_UNCERTAIN: 'No sufficiently confident, schema-valid semantic comparison was available.',
    SHADOW_ERROR: 'The shadow evaluator failed; deterministic authority remained unchanged.',
    JUDGE_UNAVAILABLE: 'The semantic judge was unavailable or intentionally not configured; no substitute result was generated.'
  };
  return values[disagreementClass];
}

export async function evaluateHybridShadow(input: HybridShadowInput): Promise<HybridShadowRecord> {
  const threshold = input.uncertainty_confidence_threshold ?? 0.5;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('uncertainty_confidence_threshold must be between 0 and 1.');
  const deterministic = evaluateAdvisoryPacket(input.packet);
  const evidence = semanticEvidence(input.packet);
  let evaluation: LiveJudgeEvaluationV61 | null = null;
  let shadowError = false;
  if (input.judge) {
    try {
      evaluation = await evaluateLiveJudgeWithGovernanceV61({
        step: input.step ?? 1,
        semantic_claim: input.packet.finding,
        hard_rule_failure: !deterministic.accepted,
        evidence_context: evidence
      }, input.judge);
    } catch {
      shadowError = true;
    }
  }
  const disagreementClass = classify(deterministic, evaluation, threshold, shadowError);
  const traceId = input.trace_id ?? randomUUID();
  const schemaFailure = Boolean(evaluation && SCHEMA_FAILURE_STATUSES.has(evaluation.semantic_observation.status));
  const containmentApplied = disagreementClass === 'SEMANTIC_SAFE_DETERMINISTIC_BLOCK' && !deterministic.accepted;

  return {
    schema_version: 'praetor-hybrid-shadow-record-v1',
    research_status: HYBRID_SHADOW_STATUS,
    mode: HYBRID_SHADOW_MODE,
    trace_id: traceId,
    recorded_at: input.recorded_at ?? new Date().toISOString(),
    packet_id: input.packet.packet_id ?? input.packet.advisory_id ?? traceId,
    input_fingerprints: {
      finding_sha256: fingerprint(input.packet.finding),
      semantic_evidence_sha256: fingerprint(canonicalJson(evidence))
    },
    evidence_lineage: {
      source_ids: [...new Set(input.packet.supporting_evidence.map(item => item.source_id))].sort(),
      independence_groups: [...new Set(input.packet.supporting_evidence.map(item => item.independence_group))].sort(),
      derived_from_source_ids: [...new Set(input.packet.supporting_evidence.map(item => item.derived_from_source_id).filter((value): value is string => Boolean(value)))].sort()
    },
    deterministic_outcome: deterministic,
    semantic_observation: evaluation?.semantic_observation ?? null,
    semantic_trace: evaluation?.trace ?? null,
    v61_governance_telemetry: evaluation?.governance ?? null,
    hybrid_shadow_interpretation: {
      disagreement_class: disagreementClass,
      interpretation: interpretation(disagreementClass),
      false_positive_candidate: disagreementClass === 'SEMANTIC_SAFE_DETERMINISTIC_BLOCK',
      false_negative_candidate: disagreementClass === 'SEMANTIC_BLOCK_DETERMINISTIC_ALLOW'
    },
    final_authority_decision: {
      source: 'evaluateAdvisoryPacket',
      verdict: deterministic.verdict,
      accepted: deterministic.accepted,
      unchanged_by_shadow: true
    },
    metrics: {
      semantic_judge_available: evaluation?.semantic_observation.available ?? false,
      schema_failure: schemaFailure,
      latency_ms: evaluation?.trace.elapsed_ms ?? null,
      input_token_count: evaluation?.trace.input_token_count ?? null,
      output_token_count: null,
      trace_complete: isTraceComplete(evaluation),
      deterministic_containment_applied: containmentApplied
    },
    authority_effect: {
      permission_granted: false,
      deterministic_override: false,
      policy_modified: false,
      execution_authorized: false,
      public_mcp_surface_changed: false
    }
  };
}

export function summarizeHybridShadow(records: readonly HybridShadowRecord[]): HybridShadowMetrics {
  const classes: HybridShadowDisagreementClass[] = [
    'AGREE_SAFE', 'AGREE_BLOCK', 'SEMANTIC_SAFE_DETERMINISTIC_BLOCK', 'SEMANTIC_BLOCK_DETERMINISTIC_ALLOW',
    'SEMANTIC_UNCERTAIN', 'SHADOW_ERROR', 'JUDGE_UNAVAILABLE'
  ];
  const disagreementCounts = Object.fromEntries(classes.map(value => [value, records.filter(record => record.hybrid_shadow_interpretation.disagreement_class === value).length])) as Record<HybridShadowDisagreementClass, number>;
  const comparable = disagreementCounts.AGREE_SAFE + disagreementCounts.AGREE_BLOCK + disagreementCounts.SEMANTIC_SAFE_DETERMINISTIC_BLOCK + disagreementCounts.SEMANTIC_BLOCK_DETERMINISTIC_ALLOW;
  const agreements = disagreementCounts.AGREE_SAFE + disagreementCounts.AGREE_BLOCK;
  const disagreements = disagreementCounts.SEMANTIC_SAFE_DETERMINISTIC_BLOCK + disagreementCounts.SEMANTIC_BLOCK_DETERMINISTIC_ALLOW;
  const latencies = records.map(record => record.metrics.latency_ms).filter((value): value is number => value !== null);
  const tokenCounts = records.map(record => record.metrics.input_token_count).filter((value): value is number => value !== null);
  const containmentCandidates = records.filter(record => record.hybrid_shadow_interpretation.disagreement_class === 'SEMANTIC_SAFE_DETERMINISTIC_BLOCK');
  const ratio = (count: number, total: number): number => total === 0 ? 0 : count / total;

  return {
    research_status: HYBRID_SHADOW_STATUS,
    total_records: records.length,
    agreement_rate: comparable === 0 ? null : agreements / comparable,
    disagreement_rate: comparable === 0 ? null : disagreements / comparable,
    semantic_judge_availability_rate: ratio(records.filter(record => record.metrics.semantic_judge_available).length, records.length),
    schema_failure_rate: ratio(records.filter(record => record.metrics.schema_failure).length, records.length),
    average_latency_ms: latencies.length === 0 ? null : latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
    input_token_count_total: tokenCounts.length === 0 ? null : tokenCounts.reduce((sum, value) => sum + value, 0),
    token_usage_observation_rate: ratio(tokenCounts.length, records.length),
    deterministic_containment_rate: containmentCandidates.length === 0
      ? null
      : containmentCandidates.filter(record => !record.final_authority_decision.accepted && record.final_authority_decision.unchanged_by_shadow).length / containmentCandidates.length,
    false_positive_candidate_cases: records.filter(record => record.hybrid_shadow_interpretation.false_positive_candidate).map(record => record.packet_id),
    false_negative_candidate_cases: records.filter(record => record.hybrid_shadow_interpretation.false_negative_candidate).map(record => record.packet_id),
    trace_completeness_rate: ratio(records.filter(record => record.metrics.trace_complete).length, records.length),
    disagreement_counts: disagreementCounts
  };
}

export async function appendHybridShadowRecord(path: string, record: HybridShadowRecord): Promise<void> {
  if (record.research_status !== HYBRID_SHADOW_STATUS || record.mode !== HYBRID_SHADOW_MODE) throw new Error('Only hybrid shadow research records may be appended.');
  if (!record.final_authority_decision.unchanged_by_shadow || Object.values(record.authority_effect).some(Boolean)) throw new Error('A shadow record must not carry an authority effect.');
  await mkdir(dirname(path), { recursive: true });
  const jsonCompatibleRecord = JSON.parse(JSON.stringify(record)) as HybridShadowRecord;
  await appendFile(path, `${canonicalJson(jsonCompatibleRecord)}\n`, 'utf8');
}

export async function readHybridShadowRecords(path: string): Promise<HybridShadowRecord[]> {
  const text = await readFile(path, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    const record = JSON.parse(line) as HybridShadowRecord;
    if (record.schema_version !== 'praetor-hybrid-shadow-record-v1') throw new Error(`Invalid hybrid shadow record at line ${index + 1}.`);
    return record;
  });
}
