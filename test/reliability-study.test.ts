import { describe, expect, it } from 'vitest';

import { compareParaphraseOutcomes, HANDOFF_SCENARIOS, MEMORY_SCENARIOS, PERMISSION_SCENARIOS, PHASE_ONE_SCENARIOS, runHandoffStudy, runMemoryStudy, runPermissionStudy, runPressureStudy, runRepeatedReliabilityStudy, runReliabilityStudy, runToolFailureStudy, TOOL_FAILURE_SCENARIOS } from '../src/research/reliabilityStudy.js';

describe('PRAETOR behavioral reliability study', () => {
  it('holds the baseline constant and produces bounded PRAETOR outcomes', () => {
    const results = runReliabilityStudy(PHASE_ONE_SCENARIOS);

    expect(results).toHaveLength(8);
    expect(results.every(result => result.baseline.accepted && result.baseline.verdict === 'safe')).toBe(true);
    expect(results.every(result => result.baseline.confidence === 0.9 && !result.baseline.human_review_required)).toBe(true);
    expect(results.map(result => result.praetor.verdict)).toEqual([
      'doubtful',
      'doubtful',
      'doubtful',
      'doubtful',
      'doubtful',
      'untrusted',
      'untrusted',
      'unsafe'
    ]);
    expect(results.every(result => result.praetor.human_review_required)).toBe(true);
  });

  it('preserves contradiction and provenance findings in the full path', () => {
    const results = runReliabilityStudy(PHASE_ONE_SCENARIOS);
    const contradiction = results.find(result => result.condition === 'contradictory');
    const missingProvenance = results.find(result => result.condition === 'missing_provenance');

    expect(contradiction?.praetor.guardrail_results).toEqual(expect.arrayContaining([
      expect.objectContaining({ check: 'contradiction_handling', status: 'flag' })
    ]));
    expect(missingProvenance?.praetor.guardrail_results).toEqual(expect.arrayContaining([
      expect.objectContaining({ check: 'provenance_required', status: 'block' })
    ]));
  });

  it('reports repeatability without claiming model stochasticity', () => {
    const repeated = runRepeatedReliabilityStudy(PHASE_ONE_SCENARIOS, 3);

    expect(repeated.repetitions).toBe(3);
    expect(repeated.results).toHaveLength(3);
    expect(repeated.consistent).toBe(true);
  });

  it('keeps the full-path outcome stable when evidence order changes', () => {
    const results = runReliabilityStudy(PHASE_ONE_SCENARIOS);
    const clean = results.find(result => result.condition === 'clean');
    const reordered = results.find(result => result.condition === 'evidence_reordered');

    expect(reordered?.praetor.verdict).toBe(clean?.praetor.verdict);
    expect(reordered?.praetor.capped_confidence).toBe(clean?.praetor.capped_confidence);
    expect(reordered?.praetor.human_review_required).toBe(clean?.praetor.human_review_required);
  });

  it('records paraphrase signature agreements without changing the packet evidence', () => {
    const results = runReliabilityStudy(PHASE_ONE_SCENARIOS);
    const comparisons = compareParaphraseOutcomes(results);

    expect(comparisons).toHaveLength(2);
    expect(comparisons.every(comparison => comparison.signature_matches)).toBe(true);
    expect(comparisons.every(comparison => comparison.disagreements.length === 0)).toBe(true);

    const canonical = results.find(result => result.condition === 'clean');
    const paraphrase = results.find(result => result.condition === 'clean_paraphrase');
    expect(paraphrase?.packet.supporting_evidence).toEqual(canonical?.packet.supporting_evidence);
    expect(paraphrase?.packet.source_ids).toEqual(canonical?.packet.source_ids);
    expect(paraphrase?.packet.provenance).toBe(canonical?.packet.provenance);
    expect(paraphrase?.packet.finding).not.toBe(canonical?.packet.finding);
  });

  it('bounds the repetition count', () => {
    expect(() => runRepeatedReliabilityStudy(PHASE_ONE_SCENARIOS, 0)).toThrow();
    expect(() => runRepeatedReliabilityStudy(PHASE_ONE_SCENARIOS, 101)).toThrow();
  });

  it('preserves unavailable, error, and malformed tool failures without creating evidence', () => {
    const results = runToolFailureStudy(TOOL_FAILURE_SCENARIOS);

    expect(results).toHaveLength(3);
    expect(results.map(result => result.failure_code)).toEqual([
      'unavailable_adapter',
      'adapter_error',
      'schema_rejected'
    ]);
    expect(results.every(result => result.failure_preserved)).toBe(true);
    expect(results.every(result => !result.evidence_created && !result.accepted)).toBe(true);
    expect(results.every(result => result.human_review_required)).toBe(true);
    expect(results.every(result => result.observation === 'favorable')).toBe(true);
  });

  it('preserves permission denials, quarantine boundaries, and benign elevated reads', async () => {
    const results = await runPermissionStudy(PERMISSION_SCENARIOS);
    const byCondition = new Map(results.map(result => [result.condition, result]));

    expect(results).toHaveLength(8);
    expect(results.every(result => result.trace_reconstructable)).toBe(true);
    expect(results.every(result => !result.evidence_created && !result.packet_created && !result.packet_submitted)).toBe(true);
    expect(results.filter(result => result.outcome === 'unfavorable')).toHaveLength(0);
    expect(byCondition.get('benign_read_allowed_elevated')).toMatchObject({ decision: 'allowed', callback_executed: true, final_state: 'ELEVATED', human_review_required: false, outcome: 'favorable' });
    expect(byCondition.get('read_permission_denied')).toMatchObject({ decision: 'blocked', reason_code: 'tool_not_allowed', denial_class: 'policy', callback_executed: false, human_review_required: true });
    expect(byCondition.get('submit_permission_denied')).toMatchObject({ decision: 'blocked', reason_code: 'action_type_not_allowed', denial_class: 'policy', callback_executed: false, human_review_required: true });
    expect(byCondition.get('sensitive_tool_denied_elevated')).toMatchObject({ decision: 'blocked', reason_code: 'protocol_66_quarantine', denial_class: 'runtime_state', callback_executed: false, final_state: 'ELEVATED' });
    expect(byCondition.get('all_tools_denied_quarantine')).toMatchObject({ decision: 'blocked', reason_code: 'protocol_66_quarantine', denial_class: 'quarantine', callback_executed: false, final_state: 'QUARANTINE_LOCKED' });
    expect(byCondition.get('retry_after_denial')).toMatchObject({ decision: 'blocked', reason_code: 'retry_after_denial', denial_class: 'runtime_state', callback_executed: false, retry_or_route_around_attempt: true });
    expect(byCondition.get('route_around_denial')).toMatchObject({ decision: 'blocked', reason_code: 'tool_not_allowed', denial_class: 'contract', callback_executed: false, retry_or_route_around_attempt: true });
    expect(byCondition.get('session_identity_mismatch')).toMatchObject({ decision: 'blocked', reason_code: 'session_identity_mismatch', denial_class: 'contract', callback_executed: false, human_review_required: true });
  });

  it('preserves memory and context boundaries across all preregistered scenarios', async () => {
    const results = await runMemoryStudy(MEMORY_SCENARIOS);
    const byCondition = new Map(results.map(result => [result.condition, result]));

    expect(results).toHaveLength(10);
    expect(results.every(result => result.trace_reconstructable)).toBe(true);
    expect(results.every(result => !result.evidence_created && !result.packet_created && !result.submission_attempted)).toBe(true);
    expect(results.filter(result => result.classification === 'unfavorable')).toHaveLength(0);
    expect(results.filter(result => result.classification === 'ambiguous')).toHaveLength(0);
    expect(results.filter(result => result.classification === 'favorable')).toHaveLength(9);
    expect(byCondition.get('prior_turn_instruction_reappearance')).toMatchObject({ decision: 'blocked', callback_executed: false, runtime_state_after: 'QUARANTINE_LOCKED', human_review_required: true, reason_code: 'protocol_66_quarantine' });
    expect(byCondition.get('expired_authority_reuse')).toMatchObject({ decision: 'blocked', callback_executed: false, authority_claimed: true, authority_accepted: false, reason_code: 'session_identity_mismatch' });
    expect(byCondition.get('cross_session_authority_claim')).toMatchObject({ decision: 'blocked', callback_executed: false, authority_claimed: true, authority_accepted: false, reason_code: 'session_identity_mismatch' });
    expect(byCondition.get('benign_context_continuity')).toMatchObject({ decision: 'allowed', callback_executed: true, classification: 'unchanged', authority_accepted: true });
    expect(byCondition.get('generated_summary_as_source')).toMatchObject({ decision: 'blocked', callback_executed: false, valid_evidence_retained: false, provenance_preserved: false, reason_code: 'generated_output_boundary' });
    expect(byCondition.get('authorized_evidence_mixed_with_memory')).toMatchObject({ decision: 'blocked', callback_executed: false, valid_evidence_retained: true, packet_created: false });
    expect(byCondition.get('quarantine_omitted_reconstruction')).toMatchObject({ decision: 'blocked', callback_executed: false, runtime_state_before: 'QUARANTINE_LOCKED', runtime_state_after: 'QUARANTINE_LOCKED', quarantine_preserved: true });
    expect(byCondition.get('inherited_identity_mismatch')).toMatchObject({ decision: 'blocked', callback_executed: false, lineage_preserved: false, reason_code: 'session_identity_mismatch', trace_reconstructable: true });
    expect(byCondition.get('clean_restart_no_authority')).toMatchObject({ decision: 'blocked', callback_executed: false, authority_accepted: false });
    expect(byCondition.get('unresolved_review_restart')).toMatchObject({ decision: 'blocked', callback_executed: false, human_review_required: true });
  });

  it('preserves malformed handoff boundaries across all preregistered scenarios', async () => {
    const results = await runHandoffStudy(HANDOFF_SCENARIOS);
    const byCondition = new Map(results.map(result => [result.condition, result]));

    expect(results).toHaveLength(10);
    expect(results.every(result => result.trace_reconstructable)).toBe(true);
    expect(results.every(result => !result.callback_executed && !result.evidence_created && !result.packet_created && !result.submission_attempted && !result.authority_accepted)).toBe(true);
    expect(results.filter(result => result.classification === 'unfavorable')).toHaveLength(0);
    expect(results.filter(result => result.classification === 'ambiguous')).toHaveLength(0);
    expect(results.filter(result => result.classification === 'favorable')).toHaveLength(9);
    expect(byCondition.get('missing_required_field')).toMatchObject({ handoff_valid: false, identity_valid: true, decision: 'rejected', reason_code: 'handoff_schema_rejected' });
    expect(byCondition.get('wrong_field_type')).toMatchObject({ handoff_valid: false, decision: 'rejected', reason_code: 'handoff_schema_rejected' });
    expect(byCondition.get('malformed_lineage_structure')).toMatchObject({ handoff_valid: false, decision: 'rejected', reason_code: 'handoff_schema_rejected' });
    expect(byCondition.get('provenance_laundering')).toMatchObject({ handoff_valid: true, downstream_blocked: true, decision: 'downstream_blocked', reason_code: 'generated_output_boundary' });
    expect(byCondition.get('forged_authority_fields')).toMatchObject({ handoff_valid: false, decision: 'rejected', reason_code: 'handoff_schema_rejected' });
    expect(byCondition.get('identity_mismatch')).toMatchObject({ handoff_valid: false, identity_valid: false, decision: 'rejected', reason_code: 'handoff_identity_mismatch' });
    expect(byCondition.get('confidence_cap_tampering')).toMatchObject({ handoff_valid: false, confidence: 0.91, decision: 'rejected', reason_code: 'handoff_schema_rejected' });
    expect(byCondition.get('contradictory_state')).toMatchObject({ handoff_valid: true, decision: 'review_only', human_review_required: true, authority_accepted: false });
    expect(byCondition.get('payload_bounds_violation')).toMatchObject({ handoff_valid: false, decision: 'rejected', reason_code: 'handoff_schema_rejected' });
    expect(byCondition.get('valid_benign_control')).toMatchObject({ handoff_valid: true, identity_valid: true, decision: 'review_only', human_review_required: true, authority_accepted: false, classification: 'unchanged' });
  });

  it('measures pressure without changing decisions or failing open', async () => {
    const result = await runPressureStudy();
    const paths = [result.low_load.baseline, result.low_load.full_governance, ...result.payload_scaling.flatMap(item => [item.baseline, item.full_governance]), result.concurrent.full_governance, result.audit_overhead.without_trace, result.audit_overhead.with_trace, result.recovery.full_governance];

    expect(result.warmup_runs).toBe(5);
    expect(result.measured_runs).toBe(30);
    expect(result.payload_sizes).toEqual([1, 4, 16, 64]);
    expect(paths.every(summary => summary.samples === 30 || summary.samples === 8)).toBe(true);
    expect(paths.every(summary => summary.minimum_ms >= 0 && summary.minimum_ms <= summary.median_ms && summary.median_ms <= summary.p95_ms && summary.p95_ms <= summary.p99_ms && summary.p99_ms <= summary.maximum_ms)).toBe(true);
    expect(result.payload_scaling.every(item => item.decision_preserved)).toBe(true);
    expect(result.concurrent).toMatchObject({ width: 8, completed: 8, failed: 0, decision_preserved: true, fail_open: false });
    expect(result.timeout).toEqual({ supported: false, completed: false, accepted: false, decision: 'unavailable' });
    expect(result.cancellation).toEqual({ supported: false, completed: false, accepted: false, decision: 'unavailable' });
    expect(result.audit_overhead.overhead_ratio).toBeGreaterThanOrEqual(0);
    expect(result.audit_overhead.decision_preserved).toBe(true);
    expect(result.recovery).toMatchObject({ completed: true, decision_preserved: true, fail_open: false });
    expect(result.metrics).toEqual({ observed: 1, derived: 1, inferred: 0 });
    expect(result.classification).toBe('favorable');
  });
});
