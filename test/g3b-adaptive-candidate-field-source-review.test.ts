import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../experiments/praetor_verify_001/g3b/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8')) as Record<string, any>;

describe('G3B adaptive candidate field source review', () => {
  it('preserves unresolved field semantics and human-only materialization choice', () => {
    const review = read('G3B_ADAPTIVE_CANDIDATE_FIELD_SOURCE_REVIEW.json');
    const dispositions = new Set([
      'EXACT_SOURCE_AVAILABLE',
      'DETERMINISTIC_DERIVATION_ALREADY_DEFINED',
      'HUMAN_DESIGN_REQUIRED'
    ]);

    expect(review.status).toBe('PENDING_HUMAN_MATERIALIZATION_DECISION');
    expect(review.field_source_matrix).toHaveLength(25);
    expect(review.field_source_matrix.every((field: Record<string, unknown>) => dispositions.has(field.disposition as string))).toBe(true);
    expect(review.field_source_matrix.filter((field: Record<string, unknown>) => field.disposition === 'HUMAN_DESIGN_REQUIRED').length).toBe(20);
    expect(review.candidate_coverage.identity_count).toBe(32);
    expect(review.candidate_coverage.overall).toBe('PARTIAL_SOURCE_COVERAGE');
    expect(review.candidate_coverage.entries.every((entry: Record<string, unknown>) => entry.coverage === 'PARTIAL_SOURCE_COVERAGE')).toBe(true);
    expect(review.alternative_feasibility.selected_alternative).toBeNull();
    expect(review.alternative_feasibility.automatic_selection).toBe(false);
    expect(review.fingerprint_preparation.existing_case_fingerprint).toBe('PRESERVE_WITH_HISTORICAL_STRUCTURAL_MEANING');
    expect(review.fingerprint_preparation.implementation_status).toBe('NOT_IMPLEMENTED');
    expect(review.canonicalization_review.canonicalization_gap).toBe(false);
    expect(review.validation_state).toMatchObject({
      holdout_access_status: 'NOT_ACCESSED',
      execution_performed: false,
      comparative_observations: 0,
      adaptive_end_to_end_runner_implemented: false
    });
  });
});