import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../experiments/praetor_verify_001/g3b/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8')) as Record<string, any>;

describe('G3B adaptive candidate materialization decision packet', () => {
  it('stops at human review without materializing candidates or authorizing execution', () => {
    const packet = read('G3B_ADAPTIVE_CANDIDATE_MATERIALIZATION_DECISION_PACKET.json');

    expect(packet.status).toBe('AWAITING_HUMAN_CANDIDATE_MATERIALIZATION_DECISION');
    expect(packet.materiality).toBe('MATERIAL_NEW_SEMANTIC');
    expect(packet.decision).toBeNull();
    expect(packet.signature).toBeNull();
    expect(packet.date).toBeNull();
    expect(packet.recommendation.recommended_alternative).toBeNull();
    expect(packet.candidate_identity_binding.binding_status).toBe('CANDIDATE_BINDING_UNRESOLVED');
    expect(packet.fingerprint_scope.finding).toBe('FINGERPRINT_SCOPE_INSUFFICIENT');
    expect(packet.review_boundary).toMatchObject({
      holdout_access_status: 'NOT_ACCESSED',
      execution_performed: false,
      comparative_observations: 0,
      adaptive_end_to_end_runner_implemented: false,
      effective_execution_authorized_for_new_basis: false
    });
    expect(packet.required_g3b_candidate_fields).toHaveLength(25);
    expect(packet.forbidden_materialization_sources.violation_disposition).toBe('FAIL_DESIGN_REVIEW');
    expect(packet.required_follow_up_after_approval.runner_implementation_authorized_by_this_packet).toBe(false);
  });
});