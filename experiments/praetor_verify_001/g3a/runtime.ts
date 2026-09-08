import * as z from 'zod/v4';
import { CandidateSchema, DecisionSchema, LIMITS, POLICIES, REGIMES, VERSION, byteHash, canonical, fingerprints, immutable, sha256, type Candidate, type Decision } from './contract.js';
import { evaluatePraetorExperimental } from './evaluator.js';
import { adjudicateExpected } from './oracle.js';
import { compareDecisions, govern, validateReference } from './comparison.js';
import { expose } from './exposure.js';

export const RunConfigSchema = z.strictObject({
  experiment_id: z.literal('PRAETOR-VERIFY-001'), phase: z.literal('G3A'), subgate: z.enum(['G3A.1', 'G3A.2', 'G3A.3']),
  seed: z.number().int().min(100).max(2147483647), algorithm: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  algorithm_version: z.string().regex(/^[a-z0-9_-]{1,64}$/), regime: z.enum(REGIMES),
  proposal_budget: z.number().int().min(1).max(LIMITS.proposal_budget), synthetic: z.literal(true)
});
export type RunConfig = z.infer<typeof RunConfigSchema>;
type Comparison = ReturnType<typeof compareDecisions>;
const ReferenceSchema = z.strictObject({ iteration: z.number().int().positive(), kind: z.enum(['pressure', 'transition']) });
type Reference = z.infer<typeof ReferenceSchema>;
export type Trace = {
  run: RunConfig; iteration: number; candidate_id: string; raw_envelope: string | null; raw_sha256: string;
  state: Candidate | null; valid: boolean; error: string | null; case_fingerprint: string;
  selected_verifier: Decision['verifier'] | null; proof_obligation: readonly string[] | null;
  authority_path: string | null; observed_disposition: Decision | null; oracle_disposition: Decision | null;
  comparison: Comparison | null; private_reward: number; duplicate: boolean;
  hashes: ReturnType<typeof fingerprints> & { run_configuration_sha256: string };
  trace_id: string; stop_reason: string | null;
  matched_reference: Reference | null;
};
export class ProposalLedger {
  #config: RunConfig;
  #traces: Trace[] = [];
  #stopped: string | null = null;
  #cases = new Set<string>();
  #signatures = new Set<string>();
  #hashes: Trace['hashes'];
  #telemetry: { iteration: number; evaluation_ms: number; generation_ms: number; rss_bytes: number }[] = [];
  constructor(config: RunConfig) {
    this.#config = immutable(RunConfigSchema.parse(config));
    this.#hashes = immutable({ ...fingerprints(), run_configuration_sha256: sha256(this.#config) });
  }
  get used() { return this.#traces.length; }
  get stopped() { return this.#stopped; }
  get traces(): readonly Trace[] { return immutable(structuredClone(this.#traces)); }
  get telemetry() { return immutable(structuredClone(this.#telemetry)); }
  propose(raw: string, generationMs: number, matchedReference: Reference | null = null) {
    if (this.#stopped) throw new Error(`Ledger stopped: ${this.#stopped}`);
    if (this.used >= this.#config.proposal_budget) throw new Error('Proposal budget exhausted');
    const iteration = this.used + 1;
    const started = performance.now();
    const rawHash = byteHash(raw);
    let state: Candidate | null = null;
    let observed: Decision | null = null;
    let oracle: Decision | null = null;
    let comparison: Comparison | null = null;
    let error: string | null = null;
    let reference: Trace | undefined;
    if (!Number.isFinite(generationMs) || generationMs < 0 || generationMs > LIMITS.generation_timeout_ms) this.#stopped = 'GENERATION_DEADLINE';
    if (process.memoryUsage().rss > LIMITS.max_rss_bytes) this.#stopped = 'RESOURCE_LIMIT';
    try {
      if (this.#stopped) throw new Error(this.#stopped);
      if (Buffer.byteLength(raw, 'utf8') > LIMITS.input_bytes) throw new Error('INPUT_BYTE_LIMIT');
      state = immutable(CandidateSchema.parse(JSON.parse(raw)));
      if (matchedReference !== null) {
        ReferenceSchema.parse(matchedReference);
        reference = this.#traces[matchedReference.iteration - 1];
        if (!reference?.valid || !reference.state || !validateReference(state, reference.state, matchedReference.kind)) throw new Error('INVALID_PAID_REFERENCE');
      }
    } catch (failure) {
      state = null;
      reference = undefined;
      error = failure instanceof z.ZodError ? 'INVALID_CANDIDATE' : failure instanceof Error ? failure.message.slice(0, 200) : 'INVALID_INPUT';
    }
    if (state) {
      try {
        const decision = DecisionSchema.parse(evaluatePraetorExperimental(structuredClone(state)));
        const agentK = state.claim_family !== 'permission' ? 'NOT_APPLICABLE' : decision.disposition === 'REJECTED' ? 'FAIL' : 'PASS';
        observed = immutable(govern(decision, agentK));
        oracle = immutable(DecisionSchema.parse(adjudicateExpected(structuredClone(state))));
        comparison = compareDecisions(state, observed, oracle, reference && matchedReference
          ? { kind: matchedReference.kind, observed: reference.observed_disposition!, oracle: reference.oracle_disposition! } : undefined);
        if (comparison.disagreement && comparison.categories.length === 0) this.#stopped = 'UNCLASSIFIED_DISAGREEMENT';
      } catch (failure) {
        this.#stopped = 'EVALUATION_ERROR';
        error = failure instanceof Error ? failure.message.slice(0, 200) : 'EVALUATION_ERROR';
      }
    }
    const evaluationMs = performance.now() - started;
    const rss = process.memoryUsage().rss;
    if (evaluationMs > LIMITS.evaluation_timeout_ms) this.#stopped = 'EVALUATION_DEADLINE';
    if (rss > LIMITS.max_rss_bytes) this.#stopped = 'RESOURCE_LIMIT';
    const valid = state !== null && observed !== null && oracle !== null && this.#stopped === null;
    const caseHash = state ? sha256(state) : rawHash;
    const duplicate = this.#cases.has(caseHash);
    this.#cases.add(caseHash);
    const signatures = comparison?.signatures ?? [];
    const novel = signatures.some(signature => !this.#signatures.has(signature.signature_sha256));
    signatures.forEach(signature => this.#signatures.add(signature.signature_sha256));
    const reward = !valid ? -1 : signatures.length ? 1 + Number(novel) : 0;
    const payload = {
      run: this.#config, iteration, candidate_id: `${this.#config.algorithm}-${this.#config.seed}-${iteration}`,
      raw_envelope: Buffer.byteLength(raw, 'utf8') <= LIMITS.input_bytes ? raw : null, raw_sha256: rawHash,
      state, valid, error, case_fingerprint: caseHash, selected_verifier: observed?.verifier ?? null,
      proof_obligation: state ? POLICIES[state.claim_family].obligation : null,
      authority_path: state ? POLICIES[state.claim_family].id : null,
      observed_disposition: observed, oracle_disposition: oracle, comparison, private_reward: reward,
      duplicate, hashes: this.#hashes, stop_reason: this.#stopped, matched_reference: matchedReference
    };
    this.#traces.push(immutable({ ...payload, trace_id: sha256(payload) }));
    this.#telemetry.push({ iteration, evaluation_ms: evaluationMs, generation_ms: generationMs, rss_bytes: rss });
    if (this.#stopped) throw new Error(`Ledger stopped: ${this.#stopped}`);
    return expose(this.#config.regime, valid, observed, comparison?.categories ?? [], reward);
  }
}
export function replay(traces: readonly Trace[]): boolean {
  if (!traces.length) return false;
  const ledger = new ProposalLedger(traces[0].run);
  for (const trace of traces) {
    if (trace.raw_envelope === null || trace.stop_reason !== null || canonical(trace.run) !== canonical(traces[0].run)) return false;
    ledger.propose(trace.raw_envelope, 0, trace.matched_reference);
  }
  return canonical(ledger.traces) === canonical(traces);
}
export const RUNTIME_VERSION = VERSION;