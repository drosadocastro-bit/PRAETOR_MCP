import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../experiments/praetor_verify_001/g3b/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8')) as Record<string, any>;

describe('G3B adaptive evaluator input necessity review', () => {
  it('preserves traced evaluator coupling for human design review', () => {
    const review = read('G3B_ADAPTIVE_EVALUATOR_INPUT_NECESSITY_REVIEW.json');
    const allowed = new Set([
      'EVALUATION_SEMANTIC_REQUIRED',
      'VALIDATION_REQUIRED',
      'PROVENANCE_ONLY',
      'LOGGING_ONLY',
      'UNUSED_BY_EVALUATOR',
      'CONDITIONAL_BRANCH_REQUIRED',
      'SEMANTIC_NECESSITY_UNRESOLVED'
    ]);

    expect(review.status).toBe('AWAITING_HUMAN_EVALUATOR_INPUT_DESIGN_DECISION');
    expect(review.overall_schema_coupling_finding).toBe('PARTIAL_SCHEMA_REQUIRED');
    expect(review.field_trace).toHaveLength(25);
    expect(review.field_trace.every((field: Record<string, unknown>) => allowed.has(field.classification as string))).toBe(true);
    expect(review.classification_summary.counts).toEqual({
      evaluation_semantic_required: 6,
      conditional_branch_required: 8,
      validation_required: 3,
      unused_by_evaluator: 8
    });
    expect(review.influence_graph.length).toBeGreaterThan(0);
    expect(review.human_design_alternatives.selected_path).toBeNull();
    expect(review.human_design_alternatives.software_selection).toBe(false);
    expect(review).toMatchObject({
      holdout_access_status: 'NOT_ACCESSED',
      execution_performed: false,
      comparative_observations: 0,
      adaptive_end_to_end_runner_implemented: false,
      effective_execution_authorized_for_new_basis: false
    });
  });
});