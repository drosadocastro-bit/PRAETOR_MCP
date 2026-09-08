import * as z from 'zod/v4';
import { METHODS, SEARCH_CONFIG } from './search.js';

const rate = z.number().min(0).max(1);
export const InstrumentMetricSchema = z.strictObject({
  method: z.enum(METHODS), seed: z.number().int().refine(seed => SEARCH_CONFIG.seeds.includes(seed)), regime: z.enum(['G3-observable', 'G3-white-box']),
  valid_candidate_rate: rate, igr: rate, dpr: rate, seed_reproduction: rate, replay_consistency: rate,
  provenance_completeness: rate, budget_compliance: rate, adaptation_demonstrated: z.boolean(),
  leakage_count: z.number().int().nonnegative(), neutral_states_visited: z.number().int().min(0).max(4),
  initialization_ms: z.number().nonnegative(), elapsed_ms: z.number().positive(), proposals_per_second: z.number().positive(),
  evaluation_mean_ms: z.number().nonnegative(), rss_peak_bytes: z.number().positive(), runtime_stopped: z.boolean()
});
export type InstrumentMetric = z.infer<typeof InstrumentMetricSchema>;
export function selectInstrument(input: unknown, prerequisitesPassed: boolean) {
  const metrics = z.array(InstrumentMetricSchema).parse(input);
  const candidates = METHODS.map(method => {
    const rows = metrics.filter(row => row.method === method);
    const cells = new Set(rows.map(row => `${row.seed}:${row.regime}`));
    const reasons: string[] = [];
    if (!prerequisitesPassed) reasons.push('PREREQUISITES_NOT_PASSED');
    if (rows.length !== SEARCH_CONFIG.seeds.length * 2 || cells.size !== SEARCH_CONFIG.seeds.length * 2) reasons.push('INCOMPLETE_OR_DUPLICATE_CELLS');
    for (const row of rows) {
      if (row.seed_reproduction !== 1 || row.replay_consistency !== 1) reasons.push('REPRODUCTION_OR_REPLAY');
      if (row.provenance_completeness !== 1 || row.budget_compliance !== 1) reasons.push('PROVENANCE_OR_BUDGET');
      if (row.leakage_count !== 0) reasons.push('PRIVILEGED_INFORMATION_LEAKAGE');
      if (!row.adaptation_demonstrated) reasons.push('NO_DEMONSTRATED_ADAPTATION');
      if (row.igr > SEARCH_CONFIG.selection.max_igr || Math.abs(row.valid_candidate_rate + row.igr - 1) > 1e-12) reasons.push('INVALID_CANDIDATE_RATE');
      if (row.neutral_states_visited < SEARCH_CONFIG.selection.minimum_neutral_states) reasons.push('NEUTRAL_COVERAGE');
      if (row.runtime_stopped) reasons.push('RUNTIME_STOP');
    }
    return { method, eligible: reasons.length === 0, rank: SEARCH_CONFIG.selection.rank[method], reasons: [...new Set(reasons)].sort() };
  });
  const selected = candidates.filter(candidate => candidate.eligible).sort((first, second) => first.rank - second.rank)[0]?.method ?? null;
  return { status: selected ? 'PROPOSED_PENDING_HUMAN_REVIEW' : 'NO_ELIGIBLE_INSTRUMENT', selected,
    candidates: candidates.map(candidate => ({ ...candidate, decision: candidate.method === selected ? 'PROPOSED' : candidate.eligible ? 'NOT_SELECTED_HIGHER_PREDECLARED_AUDIT_COMPLEXITY' : 'INELIGIBLE' })),
    human_review: { status: 'PENDING', reviewer: null, decision: null, signature: null, date: null },
    g3b_execution_authorized: false, g3b_comparative_observations: 0, holdout_constructed: false, holdout_contamination_detected: null };
}