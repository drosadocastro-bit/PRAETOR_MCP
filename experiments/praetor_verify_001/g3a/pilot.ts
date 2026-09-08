import { canonical, sha256, type Regime } from './contract.js';
import { ObservableSchema, WhiteBoxSchema } from './exposure.js';
import { ProposalLedger, replay, type RunConfig, type Trace } from './runtime.js';
import { SEARCH_CONFIG, Searcher, demonstrate, instrumentCandidate, toyFeedback, type Method, type ToyFeedback } from './search.js';
import { InstrumentMetricSchema } from './selection.js';

export type Step = { iteration: number; action: number; toy_feedback: ToyFeedback; exposed_feedback: unknown };
function provenanceValid(trace: Trace) {
  const { trace_id: traceId, ...payload } = trace;
  return trace.run.phase === 'G3A' && trace.run.synthetic && trace.iteration > 0 && Boolean(trace.candidate_id)
    && traceId === sha256(payload) && Object.values(trace.hashes).every(hash => /^[a-f0-9]{64}$/.test(hash))
    && (!trace.valid || Boolean(trace.state?.source_id && trace.proof_obligation && trace.authority_path && trace.observed_disposition && trace.oracle_disposition));
}
export function runCell(method: Method, seed: number, regime: Regime) {
  const initialized = performance.now();
  const searcher = new Searcher(method, seed);
  const config: RunConfig = { experiment_id: 'PRAETOR-VERIFY-001', phase: 'G3A', subgate: 'G3A.3', seed,
    algorithm: method, algorithm_version: SEARCH_CONFIG[method].version, regime, proposal_budget: SEARCH_CONFIG.budget, synthetic: true };
  const ledger = new ProposalLedger(config);
  const initializationMs = performance.now() - initialized;
  const started = performance.now();
  const steps: Step[] = [];
  let stop: string | null = null;
  for (let iteration = 0; iteration < SEARCH_CONFIG.budget; iteration += 1) {
    const generationStarted = performance.now();
    try {
      const action = searcher.propose();
      const raw = canonical(instrumentCandidate(action, iteration));
      const generationMs = performance.now() - generationStarted;
      const exposedFeedback = ledger.propose(raw, generationMs);
      const feedback = toyFeedback(action);
      steps.push({ iteration: iteration + 1, action, toy_feedback: feedback, exposed_feedback: exposedFeedback });
      searcher.update(feedback);
    } catch (failure) {
      stop = failure instanceof Error ? failure.message : 'INSTRUMENT_ERROR';
      break;
    }
  }
  const elapsedMs = performance.now() - started;
  const traces = ledger.traces;
  const telemetry = ledger.telemetry;
  const repeated = demonstrate(method, seed, regime);
  const perturbed = demonstrate(method, seed, regime, SEARCH_CONFIG.budget, true);
  const feedbackSchema = regime === 'G3-observable' ? ObservableSchema : WhiteBoxSchema;
  let replayConsistent = false;
  let replayError: string | null = null;
  try { replayConsistent = !stop && replay(traces); } catch (failure) { replayError = failure instanceof Error ? failure.message : 'REPLAY_ERROR'; }
  const valid = traces.filter(trace => trace.valid).length;
  const count = traces.length;
  const metric = InstrumentMetricSchema.parse({
    method, seed, regime, valid_candidate_rate: count ? valid / count : 0, igr: count ? (count - valid) / count : 1,
    dpr: count ? traces.filter(trace => trace.duplicate).length / count : 0,
    seed_reproduction: Number(canonical(steps.map(step => ({ action: step.action, toy_feedback: step.toy_feedback }))) === canonical(repeated.sequence)),
    replay_consistency: Number(replayConsistent), provenance_completeness: count ? traces.filter(provenanceValid).length / count : 0,
    budget_compliance: Number(count === SEARCH_CONFIG.budget && steps.length === SEARCH_CONFIG.budget),
    adaptation_demonstrated: sha256(repeated.state) !== sha256(perturbed.state),
    leakage_count: steps.filter(step => !feedbackSchema.safeParse(step.exposed_feedback).success).length,
    neutral_states_visited: new Set(steps.map(step => step.action)).size,
    initialization_ms: initializationMs, elapsed_ms: elapsedMs, proposals_per_second: count / (elapsedMs / 1000),
    evaluation_mean_ms: count ? telemetry.reduce((sum, entry) => sum + entry.evaluation_ms, 0) / count : 0,
    rss_peak_bytes: Math.max(process.memoryUsage().rss, ...telemetry.map(entry => entry.rss_bytes)), runtime_stopped: stop !== null || replayError !== null
  });
  const fieldCoverage = Object.fromEntries(Object.keys(instrumentCandidate(0, 0)).map(field => [field,
    [...new Set(traces.filter(trace => trace.state !== null).map(trace => canonical(trace.state![field as keyof typeof trace.state])))].sort()
  ]));
  return { version: 'g3a-cell-v1', phase: 'G3A', partition: 'G3A_INSTRUMENT_VALIDATION', config,
    instrument_configuration_sha256: sha256(SEARCH_CONFIG), metric, stop, replay_error: replayError,
    steps, traces, telemetry, field_coverage: fieldCoverage, final_search_state: searcher.snapshot(),
    reproduction: { same_seed_sequence_sha256: sha256(repeated.sequence), changed_feedback_state_sha256: sha256(perturbed.state),
      recorded_sequence_sha256: sha256(steps.map(step => ({ action: step.action, toy_feedback: step.toy_feedback }))) },
    g3b_comparative_observations: 0, synthetic: true };
}
export function replayCell(cell: ReturnType<typeof runCell>) {
  const sequence = demonstrate(cell.config.algorithm as Method, cell.config.seed, cell.config.regime);
  return replay(cell.traces) && canonical(sequence.sequence) === canonical(cell.steps.map(step => ({ action: step.action, toy_feedback: step.toy_feedback })))
    && canonical(sequence.state) === canonical(cell.final_search_state)
    && cell.steps.every((step, index) => cell.traces[index].case_fingerprint === sha256(instrumentCandidate(step.action, index)));
}