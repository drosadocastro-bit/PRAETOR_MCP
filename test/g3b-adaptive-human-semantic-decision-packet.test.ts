import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../experiments/praetor_verify_001/g3b/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8')) as Record<string, any>;

describe('G3B adaptive human semantic decision packet', () => {
  it('records the explicit human approval without authorizing new-basis execution', () => {
    const packet = read('G3B_ADAPTIVE_HUMAN_SEMANTIC_DECISION_PACKET.json');
    expect(packet.status).toBe('APPROVED_FOR_IMPLEMENTATION_NON_HOLDOUT');
    expect(packet.semantic_finding).toBe('RESOLVED_BY_HUMAN_AMENDMENT');
    expect(packet.human_decision).toBe('APPROVED');
    expect(packet.decision).toBe('APPROVE_ADAPTIVE_DESIGN_AMENDMENT');
    expect(packet.selected_design).toBe('DIRECT_CANDIDATE_ID_FINITE_STATE');
    expect(packet.signature).toBe('drosado');
    expect(packet.date).toBe('09/10/2026 1354Z');
    expect(packet.implementation_authorized).toBe(true);
    expect(packet.effective_execution_authorized_for_new_basis).toBe(false);
    expect(packet.review_boundary).toMatchObject({
      holdout_access_status: 'NOT_ACCESSED',
      execution_performed: false,
      comparative_observations: 0,
      adaptive_runtime_implemented: false,
      full_revalidation_started: false,
      amendment_modified: false
    });
  });

  it('records approved roles for every permitted field', () => {
    const packet = read('G3B_ADAPTIVE_HUMAN_SEMANTIC_DECISION_PACKET.json');
    expect(packet.field_role_decisions).toHaveLength(11);
    expect(packet.field_role_decisions.every((entry: any) => entry.human_decision === 'APPROVED')).toBe(true);
    expect(packet.field_role_decisions.every((entry: any) => entry.decision_status === 'APPROVED')).toBe(true);
    expect(packet.field_role_decisions.filter((entry: any) => entry.proposed_role === 'TRANSITION_BEARING').map((entry: any) => entry.field)).toEqual(['governed_disposition', 'governed_disposition']);
    const reward = packet.field_role_decisions.find((entry: any) => entry.field === 'explicit_reward');
    expect(reward.proposed_role).toBe('FORBIDDEN_FOR_ADAPTIVE_TRANSITION');
    expect(reward.reason).toBe('NO_SCALAR_REWARD');
  });

  it('records the closed value mappings and single-field transition rule', () => {
    const packet = read('G3B_ADAPTIVE_HUMAN_SEMANTIC_DECISION_PACKET.json');
    expect(packet.value_level_transition_decisions.entries).toEqual([
      expect.objectContaining({ field: 'governed_disposition', value: 'SEMANTICALLY_SUPPORTED', proposed_state: 'COMPLETED', human_decision: 'APPROVED' }),
      expect.objectContaining({ field: 'governed_disposition', value: 'NON_CERTIFIED', proposed_state: 'SUPPRESSED', human_decision: 'APPROVED' }),
      expect.objectContaining({ field: 'governed_disposition', value: 'UNAVAILABLE', proposed_state: 'SUPPRESSED', human_decision: 'APPROVED' })
    ]);
    expect(packet.multi_field_precedence.decision_status).toBe('APPROVED');
    expect(packet.multi_field_precedence.precedence_required).toBe(false);
    expect(packet.multi_field_precedence.software_decision).toBe('NOT_APPLICABLE');
  });

  it('preserves regime isolation and the approved design boundary', () => {
    const packet = read('G3B_ADAPTIVE_HUMAN_SEMANTIC_DECISION_PACKET.json');
    expect(packet.regime_isolation.observable_white_box_leakage).toBe(false);
    expect(packet.regime_isolation.human_decision_cannot_grant_observable_access_to_white_box_fields).toBe(true);
    expect(packet.proposed_adaptive_design.id).toBe('DIRECT_CANDIDATE_ID_FINITE_STATE');
    expect(packet.proposed_adaptive_design.selected_design).toBe('DIRECT_CANDIDATE_ID_FINITE_STATE');
    expect(packet.proposed_adaptive_design.states).toEqual(['UNTRIED', 'SUPPRESSED', 'COMPLETED']);
    expect(packet.proposed_adaptive_design.reserved_states.ELIGIBLE).toBe('RESERVED_NOT_REACHABLE_IN_G3B_ADAPTIVE_V1');
    expect(packet.proposed_adaptive_design.no_candidate_result).toBe('STOP_NO_SELECTABLE_CANDIDATE');
    expect(packet.proposed_adaptive_design.scalar_reward).toBe('NO_SCALAR_REWARD');
    expect(packet.human_review_checklist).toHaveLength(12);
    expect(packet.human_review_checklist.every((item: any) => item.status === 'APPROVED')).toBe(true);
  });
});
