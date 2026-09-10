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

  it('keeps the adaptive amendment pending human approval', () => {
    const amendment = read('G3B_ADAPTIVE_DESIGN_AMENDMENT.json');
    expect(amendment.status).toBe('PENDING_HUMAN_DECISION');
    expect(amendment.adaptive_design_amendment).toBe('PROPOSED');
    expect(amendment.recommended_design).toBe('DIRECT_CANDIDATE_ID_FINITE_STATE');
    expect(amendment.selected_design).toBeNull();
    expect(amendment.decision).toBeNull();
    expect(amendment.signature).toBeNull();
    expect(amendment.date).toBeNull();
    expect(amendment.allowed_decisions).toEqual([
      'APPROVE_ADAPTIVE_DESIGN_AMENDMENT',
      'DO_NOT_APPROVE_ADAPTIVE_DESIGN_AMENDMENT'
    ]);
    expect(amendment.effective_execution_authorized_for_new_basis).toBe(false);
    expect(amendment.holdout_access_status).toBe('NOT_ACCESSED');
    expect(amendment.execution_performed).toBe(false);
    expect(amendment.comparative_observations).toBe(0);
    expect(amendment.proposed_semantics.transition.feedback_mapping).toContain('PENDING_HUMAN_DECISION');
  });
});
