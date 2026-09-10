import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../experiments/praetor_verify_001/g3b/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8')) as Record<string, any>;

describe('G3B adaptive feedback semantic domain review', () => {
  it('keeps semantic closure pending human decision', () => {
    const review = read('G3B_ADAPTIVE_FEEDBACK_SEMANTIC_DOMAIN_REVIEW.json');
    expect(review.status).toBe('PENDING_HUMAN_SEMANTIC_DECISION');
    expect(review.semantic_closure).toBe('DESIGN_AMBIGUITY_REMAINS');
    expect(review.holdout_access_status).toBe('NOT_ACCESSED');
    expect(review.execution_performed).toBe(false);
    expect(review.comparative_observations).toBe(0);
    expect(review.adaptive_runtime_implemented).toBe(false);
    expect(review.full_revalidation_started).toBe(false);
  });

  it('inventories all permitted fields without treating observations as enums', () => {
    const review = read('G3B_ADAPTIVE_FEEDBACK_SEMANTIC_DOMAIN_REVIEW.json');
    expect(review.field_inventory).toHaveLength(11);
    expect(review.field_inventory.filter((entry: any) => entry.domain_status === 'DOMAIN_UNDEFINED').length).toBeGreaterThan(0);
    expect(review.field_inventory.find((entry: any) => entry.field === 'explicit_reward').domain_status).toBe('DOMAIN_UNDEFINED');
    expect(review.field_inventory.find((entry: any) => entry.field === 'explicit_reward').observed_non_holdout_values).toEqual([]);
  });

  it('proposes reward prohibition and preserves regime isolation', () => {
    const review = read('G3B_ADAPTIVE_FEEDBACK_SEMANTIC_DOMAIN_REVIEW.json');
    const rewardRole = review.field_role_proposal_for_human_review.find((entry: any) => entry.field === 'explicit_reward');
    expect(rewardRole.proposed_role).toBe('FORBIDDEN_FOR_ADAPTIVE_TRANSITION');
    expect(rewardRole.reason).toBe('NO_SCALAR_REWARD');
    expect(review.regime_boundaries.observable_white_box_leakage).toBe(false);
    expect(review.regime_boundaries.isolation_validation).toBe('PASS');
    expect(review.regime_boundaries.observable_allowed_fields).not.toContain('explicit_reward');
  });

  it('leaves every candidate state decision pending', () => {
    const review = read('G3B_ADAPTIVE_FEEDBACK_SEMANTIC_DOMAIN_REVIEW.json');
    expect(review.candidate_transition_inputs.length).toBeGreaterThan(0);
    for (const input of review.candidate_transition_inputs) {
      expect(input.state_decision).toBe('PENDING HUMAN DECISION');
      expect(input.allowed_future_states).toEqual(['ELIGIBLE', 'SUPPRESSED', 'COMPLETED', 'NO_STATE_CHANGE']);
    }
    expect(review.fields_eligible_for_human_transition_mapping).not.toContain('G3-white-box.explicit_reward');
  });
});
