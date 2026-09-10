import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../experiments/praetor_verify_001/g3b/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8')) as Record<string, any>;

describe('G3B adaptive semantic design resolution', () => {
  it('requires a design amendment when mapping and transition are insufficient', () => {
    const resolution = read('G3B_ADAPTIVE_SEMANTIC_DESIGN_RESOLUTION.json');
    expect(resolution.mapping_resolution).toBe('INSUFFICIENT_DESIGN');
    expect(resolution.transition_resolution).toBe('INSUFFICIENT_DESIGN');
    expect(resolution.adaptive_semantic_resolution).toBe('DESIGN_AMENDMENT_REQUIRED');
    expect(resolution.adaptive_semantics_ready_for_validation).toBe(false);
  });

  it('keeps the amendment fail-closed and preserves the holdout boundary', () => {
    const amendment = read('G3B_ADAPTIVE_DESIGN_AMENDMENT_REQUIRED.json');
    expect(amendment.human_decision_required).toBe(true);
    expect(amendment.reauthorization_required).toBe(true);
    expect(amendment.full_revalidation_required).toBe(true);
    expect(amendment.holdout_access_status).toBe('NOT_ACCESSED');
    expect(amendment.comparative_observations).toBe(0);
  });

  it('does not turn candidate metadata into semantic ordering', () => {
    const candidates = read('G3B_ADAPTIVE_CANDIDATE_SPACE.json');
    expect(candidates.trajectory_rules.ordering_semantically_meaningful).toBe(false);
    expect(candidates.adaptive_resolution).toBe('UNRESOLVED');
  });

  it('records the approved adaptive amendment without execution authorization', () => {
    const amendment = read('G3B_ADAPTIVE_DESIGN_AMENDMENT.json');
    expect(amendment.status).toBe('HUMAN_DECISION_RECORDED');
    expect(amendment.adaptive_design_amendment).toBe('APPROVED');
    expect(amendment.design_decision).toBe('RESOLVED_BY_HUMAN_AMENDMENT');
    expect(amendment.prior_design_finding.mapping_resolution).toBe('INSUFFICIENT_DESIGN');
    expect(amendment.prior_design_finding.transition_resolution).toBe('INSUFFICIENT_DESIGN');
    expect(amendment.recommended_design).toBe('DIRECT_CANDIDATE_ID_FINITE_STATE');
    expect(amendment.selected_design).toBe('DIRECT_CANDIDATE_ID_FINITE_STATE');
    expect(amendment.human_decision).toBe('APPROVED');
    expect(amendment.decision).toBe('APPROVE_ADAPTIVE_DESIGN_AMENDMENT');
    expect(amendment.signature).toBe('drosado');
    expect(amendment.date).toBe('09/10/2026 1354Z');
    expect(amendment.allowed_decisions).toEqual([
      'APPROVE_ADAPTIVE_DESIGN_AMENDMENT',
      'DO_NOT_APPROVE_ADAPTIVE_DESIGN_AMENDMENT'
    ]);
    expect(amendment.effective_execution_authorized_for_new_basis).toBe(false);
    expect(amendment.action_candidate_mapping.implementation_authorized).toBe(true);
    expect(amendment.candidate_states.proposed).toEqual(['UNTRIED', 'SUPPRESSED', 'COMPLETED']);
    expect(amendment.candidate_states.reserved.ELIGIBLE).toBe('RESERVED_NOT_REACHABLE_IN_G3B_ADAPTIVE_V1');
    expect(amendment.holdout_access_status).toBe('NOT_ACCESSED');
    expect(amendment.execution_performed).toBe(false);
    expect(amendment.comparative_observations).toBe(0);
    expect(amendment.proposed_semantics.transition.feedback_mapping).toContain('SEMANTICALLY_SUPPORTED -> COMPLETED');
    expect(amendment.feedback_contract_inventory.semantic_feedback_classes_defined).toBe(false);
    expect(amendment.feedback_transition_table).toHaveLength(2);
    for (const entry of amendment.feedback_transition_table) {
      expect(entry.status).toBe('APPROVED');
      expect(entry.result).toBe('CLOSED_GOVERNED_DISPOSITION_DOMAIN');
    }
    expect(amendment.invalid_transition_behavior.result).toBe('INVALID_TRANSITION');
    expect(amendment.selection_rule.proposed).toContain('select the first remaining UNTRIED candidate');
    expect(amendment.selection_rule.no_candidate_result).toBe('STOP_NO_SELECTABLE_CANDIDATE');
    expect(amendment.adaptive_feedback_semantics).toBe('RESOLVED_BY_HUMAN_AMENDMENT');
    expect(amendment.adaptive_execution_semantics).toBe('APPROVED_FOR_IMPLEMENTATION');
  });
});
