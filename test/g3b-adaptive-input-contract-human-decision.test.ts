import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type HumanDecision = {
  status: string;
  experiment_id: string;
  selected_path: string;
  decision: string;
  validation_boundary: { fields: string[]; semantic_authority: boolean };
  always_required_evaluator_fields: string[];
  conditional_permission_fields: { condition: string; fields: string[]; non_permission_influence: string };
  omitted_adaptive_evaluator_input_v1: { fields: string[]; classification: string };
  branch_dependent_requiredness: { activating_condition: string; deterministic: boolean; other_activators: string[]; hidden_branch_classifier: boolean; model_inference: boolean; fallback_heuristic: boolean };
  random_rule_based_contracts_unchanged: boolean;
  evidence_basis: { non_holdout_metamorphic_mutation_cases: number; omitted_fields_result: string; interpretation_boundary: string };
  materiality: string;
  full_non_holdout_revalidation_required: boolean;
  new_execution_reauthorization_required: boolean;
  holdout_state: { holdout_access_status: string; holdout_evaluated: boolean };
  execution_state: { execution_performed: boolean; adaptive_schema_implemented: boolean; adaptive_candidate_payloads_created: boolean; adaptive_end_to_end_runner_implemented: boolean; effective_execution_authorized_for_new_basis: boolean };
  comparative_observations: number;
  signature: string;
  date: string;
};

const decision = JSON.parse(readFileSync(new URL('../experiments/praetor_verify_001/g3b/G3B_ADAPTIVE_INPUT_CONTRACT_HUMAN_DECISION.json', import.meta.url), 'utf8')) as HumanDecision;

describe('G3B adaptive input contract human decision', () => {
  it('freezes the approved adaptive evaluator boundary', () => {
    expect(decision.status).toBe('APPROVED_HUMAN_ADAPTIVE_INPUT_CONTRACT_DECISION');
    expect(decision.experiment_id).toBe('PRAETOR-VERIFY-001');
    expect(decision.selected_path).toBe('ADAPTIVE_SPECIFIC_EVALUATOR_INPUT');
    expect(decision.decision).toBe('APPROVE');
    expect(decision.validation_boundary.fields).toEqual(['partition', 'synthetic', 'claim_universality']);
    expect(decision.validation_boundary.semantic_authority).toBe(false);
    expect(decision.always_required_evaluator_fields).toHaveLength(6);
    expect(decision.conditional_permission_fields.condition).toBe('claim_family = permission');
    expect(decision.conditional_permission_fields.fields).toHaveLength(8);
    expect(decision.omitted_adaptive_evaluator_input_v1.fields).toHaveLength(8);
    expect(decision.omitted_adaptive_evaluator_input_v1.classification).toBe('NOT_REQUIRED_BY_G3B_ADAPTIVE_EVALUATOR_CONTRACT_V1');
  });

  it('keeps the approved boundary deterministic and execution-closed', () => {
    expect(decision.branch_dependent_requiredness).toEqual({
      activating_condition: 'claim_family = permission',
      deterministic: true,
      other_activators: [],
      hidden_branch_classifier: false,
      model_inference: false,
      fallback_heuristic: false
    });
    expect(decision.random_rule_based_contracts_unchanged).toBe(true);
    expect(decision.evidence_basis.non_holdout_metamorphic_mutation_cases).toBe(76);
    expect(decision.evidence_basis.omitted_fields_result).toBe('NO_OUTPUT_INFLUENCE for all eight omitted fields');
    expect(decision.evidence_basis.interpretation_boundary).toContain('not comparative G3B performance evidence');
    expect(decision.materiality).toBe('MATERIAL_NEW_SEMANTIC');
    expect(decision.full_non_holdout_revalidation_required).toBe(true);
    expect(decision.new_execution_reauthorization_required).toBe(true);
    expect(decision.holdout_state).toEqual({ holdout_access_status: 'NOT_ACCESSED', holdout_evaluated: false });
    expect(decision.execution_state).toEqual({
      execution_performed: false,
      adaptive_schema_implemented: false,
      adaptive_candidate_payloads_created: false,
      adaptive_end_to_end_runner_implemented: false,
      effective_execution_authorized_for_new_basis: false
    });
    expect(decision.comparative_observations).toBe(0);
    expect(decision.signature).toBe('drosado');
    expect(decision.date).toBe('09/10/2026 1634Z');
  });
});
