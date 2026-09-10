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
});
