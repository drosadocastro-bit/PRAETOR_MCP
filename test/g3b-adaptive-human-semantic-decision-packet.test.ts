import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../experiments/praetor_verify_001/g3b/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8')) as Record<string, any>;

describe('G3B adaptive human semantic decision packet', () => {
  it('remains a pending human decision surface', () => {
    const packet = read('G3B_ADAPTIVE_HUMAN_SEMANTIC_DECISION_PACKET.json');
    expect(packet.status).toBe('AWAITING_HUMAN_DECISION');
    expect(packet.semantic_finding).toBe('DESIGN_AMBIGUITY_REMAINS');
    expect(packet.selected_design).toBeUndefined();
    expect(packet.signature).toBeNull();
    expect(packet.date).toBeNull();
    expect(packet.review_boundary).toMatchObject({
      holdout_access_status: 'NOT_ACCESSED',
      execution_performed: false,
      comparative_observations: 0,
      adaptive_runtime_implemented: false,
      full_revalidation_started: false,
      amendment_modified: false
    });
  });

  it('provides one pending role decision for every permitted field', () => {
    const packet = read('G3B_ADAPTIVE_HUMAN_SEMANTIC_DECISION_PACKET.json');
    expect(packet.field_role_decisions).toHaveLength(11);
    expect(packet.field_role_decisions.every((entry: any) => entry.human_decision === null)).toBe(true);
    expect(packet.field_role_decisions.every((entry: any) => entry.decision_status === 'PENDING_HUMAN_DECISION')).toBe(true);
    const reward = packet.field_role_decisions.find((entry: any) => entry.field === 'explicit_reward');
    expect(reward.proposed_role).toBe('FORBIDDEN_FOR_ADAPTIVE_TRANSITION');
    expect(reward.reason).toBe('NO_SCALAR_REWARD');
  });

  it('does not assign value-level states or precedence automatically', () => {
    const packet = read('G3B_ADAPTIVE_HUMAN_SEMANTIC_DECISION_PACKET.json');
    expect(packet.value_level_transition_decisions.entries.length).toBeGreaterThan(0);
    expect(packet.value_level_transition_decisions.entries.every((entry: any) => entry.proposed_state === null)).toBe(true);
    expect(packet.value_level_transition_decisions.entries.every((entry: any) => entry.human_decision === 'STATE_MAPPING_UNRESOLVED')).toBe(true);
    expect(packet.multi_field_precedence.decision_status).toBe('PRECEDENCE_AMBIGUITY_REMAINS');
    expect(packet.multi_field_precedence.software_decision).toBeNull();
  });

  it('preserves regime isolation and the proposed design without selecting it', () => {
    const packet = read('G3B_ADAPTIVE_HUMAN_SEMANTIC_DECISION_PACKET.json');
    expect(packet.regime_isolation.observable_white_box_leakage).toBe(false);
    expect(packet.regime_isolation.human_decision_cannot_grant_observable_access_to_white_box_fields).toBe(true);
    expect(packet.proposed_adaptive_design.id).toBe('DIRECT_CANDIDATE_ID_FINITE_STATE');
    expect(packet.proposed_adaptive_design.selected_design).toBeNull();
    expect(packet.proposed_adaptive_design.scalar_reward).toBe('NO_SCALAR_REWARD');
    expect(packet.human_review_checklist).toHaveLength(12);
    expect(packet.human_review_checklist.every((item: any) => item.status === 'PENDING' && item.value === null)).toBe(true);
  });
});
