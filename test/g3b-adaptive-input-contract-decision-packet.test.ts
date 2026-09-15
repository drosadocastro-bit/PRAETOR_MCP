import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type DecisionPacket = {
  status: string;
  selected_path: string | null;
  recommended_path: string | null;
  decision: string | null;
  signature: string | null;
  date: string | null;
  materiality: string;
  source_basis: Record<string, { path: string; sha256: string }>;
  proposed_minimal_adaptive_contract: { schema_changed: boolean; evaluator_changed: boolean };
  holdout_state: { holdout_access_status: string; execution_performed: boolean; comparative_observations: number; adaptive_end_to_end_runner_implemented: boolean };
  omission_safety: { human_review_required: boolean; minimal_contract_justified: string };
  required_human_decisions: Array<{ id: string; proposed_resolution: string; decision: string | null }>;
};

const packet = JSON.parse(readFileSync(new URL('../experiments/praetor_verify_001/g3b/G3B_ADAPTIVE_INPUT_CONTRACT_DECISION_PACKET.json', import.meta.url), 'utf8')) as DecisionPacket;

describe('G3B adaptive input contract decision packet', () => {
  it('records the human decision without authorizing execution', () => {
    expect(packet.status).toBe('APPROVED_HUMAN_ADAPTIVE_INPUT_CONTRACT_DECISION');
    expect(packet.materiality).toBe('MATERIAL_NEW_SEMANTIC');
    expect(packet.selected_path).toBe('ADAPTIVE_SPECIFIC_EVALUATOR_INPUT');
    expect(packet.recommended_path).toBe('ADAPTIVE_SPECIFIC_EVALUATOR_INPUT');
    expect(packet.decision).toBe('APPROVE');
    expect(packet.signature).toBe('drosado');
    expect(packet.date).toBe('09/10/2026 1634Z');
    expect(packet.omission_safety.human_review_required).toBe(false);
    expect(packet.omission_safety.minimal_contract_justified).toBe('APPROVED_FOR_IMPLEMENTATION_DESIGN_ONLY');
    expect(packet.required_human_decisions).toHaveLength(10);
    expect(packet.required_human_decisions.every(({ decision }) => decision !== null)).toBe(true);
  });

  it('proves this evidence packet did not change schema, evaluator, execution, or holdout state', () => {
    expect(packet.proposed_minimal_adaptive_contract.schema_changed).toBe(false);
    expect(packet.proposed_minimal_adaptive_contract.evaluator_changed).toBe(false);
    expect(packet.holdout_state).toEqual({
      holdout_access_status: 'NOT_ACCESSED',
      execution_performed: false,
      comparative_observations: 0,
      adaptive_end_to_end_runner_implemented: false
    });
    expect(Object.keys(packet.source_basis)).toEqual(expect.arrayContaining(['runtime', 'evaluator', 'failure_mapping', 'schema_and_domain', 'prior_necessity_review', 'evidence_test']));
  });
});
