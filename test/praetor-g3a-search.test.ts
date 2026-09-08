import { describe, expect, it } from 'vitest';
import { CandidateSchema, REGIMES, sha256 } from '../experiments/praetor_verify_001/g3a/contract.js';
import { METHODS, SEARCH_CONFIG, Searcher, demonstrate, instrumentCandidate, toyFeedback } from '../experiments/praetor_verify_001/g3a/search.js';
import { selectInstrument, type InstrumentMetric } from '../experiments/praetor_verify_001/g3a/selection.js';

function instrumentalRows(): InstrumentMetric[] {
  return METHODS.flatMap(method => SEARCH_CONFIG.seeds.flatMap(seed => REGIMES.map(regime => ({ method, seed, regime,
    valid_candidate_rate: 1, igr: 0, dpr: 0.5, seed_reproduction: 1, replay_consistency: 1, provenance_completeness: 1,
    budget_compliance: 1, adaptation_demonstrated: true, leakage_count: 0, neutral_states_visited: 4,
    initialization_ms: 1, elapsed_ms: 10, proposals_per_second: 25000, evaluation_mean_ms: 0.01, rss_peak_bytes: 1024, runtime_stopped: false
  }))));
}
describe('G3A.3 prospective toy-only instruments', () => {
  it.each(METHODS)('%s reproduces with same seed/feedback and changes search state under changed toy feedback', method => {
    for (const seed of SEARCH_CONFIG.seeds) {
      for (const regime of REGIMES) {
        const original = demonstrate(method, seed, regime);
        expect(demonstrate(method, seed, regime)).toEqual(original);
        expect(sha256(demonstrate(method, seed, regime, SEARCH_CONFIG.budget, true).state)).not.toBe(sha256(original.state));
      }
    }
  });
  it.each(['random', 'rule_based'] as const)('%s remains nonadaptive under changed feedback', method => {
    const baseline = demonstrate(method, 101, 'G3-observable');
    const changed = demonstrate(method, 101, 'G3-observable', SEARCH_CONFIG.budget, true);
    expect(changed.sequence.map(entry => entry.action)).toEqual(baseline.sequence.map(entry => entry.action));
    expect(changed.state).toEqual(baseline.state);
  });
  it('covers only strict instrument candidates without constructing holdout data', () => {
    for (let iteration = 0; iteration < SEARCH_CONFIG.budget; iteration += 1) {
      for (let action = 0; action < 4; action += 1) expect(CandidateSchema.safeParse(instrumentCandidate(action, iteration)).success).toBe(true);
    }
  });
  it('rejects oracle/failure feedback and prevents double proposal or unpaired updates', () => {
    const searcher = new Searcher('bandit', 101);
    expect(() => searcher.update(toyFeedback(0))).toThrow('without a proposal');
    const action = searcher.propose();
    expect(() => searcher.propose()).toThrow('Exactly one');
    expect(() => searcher.update({ ...toyFeedback(action), failure_count: 10 })).toThrow();
    searcher.update(toyFeedback(action));
  });
  it('requires all 30 complete unique cells and permits no winner', () => {
    expect(selectInstrument([], true).selected).toBeNull();
    expect(selectInstrument(instrumentalRows(), false).selected).toBeNull();
    expect(selectInstrument(instrumentalRows().map(row => ({ ...row, adaptation_demonstrated: false })), true).selected).toBeNull();
    const duplicate = instrumentalRows().filter(row => row.method === 'bandit');
    expect(selectInstrument([...duplicate.slice(1), duplicate[1]], true).selected).toBeNull();
  });
  it('uses only eligibility then fixed audit rank, rejects efficacy metrics, and retains all decisions', () => {
    const rows = instrumentalRows();
    const result = selectInstrument(rows, true);
    expect(result.selected).toBe('tabular');
    expect(result.candidates).toHaveLength(3);
    expect(selectInstrument(rows.map(row => row.method === 'tabular' ? { ...row, leakage_count: 1 } : row), true).selected).toBe('bandit');
    expect(selectInstrument(rows.map(row => ({ ...row, igr: 0.1, valid_candidate_rate: 0.9 })), true).selected).toBeNull();
    expect(() => selectInstrument(rows.map(row => ({ ...row, failure_discovery_rate: 1 })), true)).toThrow();
    expect(result.human_review.decision).toBeNull();
    expect(result.g3b_execution_authorized).toBe(false);
  });
});