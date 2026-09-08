import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { CandidateSchema, LIMITS, POLICIES, calibrationCandidate, canonical, sha256, schemaDescription } from '../experiments/praetor_verify_001/g3a/contract.js';
import { evaluatePraetorExperimental } from '../experiments/praetor_verify_001/g3a/evaluator.js';
import { adjudicateExpected } from '../experiments/praetor_verify_001/g3a/oracle.js';
import * as evaluatorModule from '../experiments/praetor_verify_001/g3a/evaluator.js';
import * as oracleModule from '../experiments/praetor_verify_001/g3a/oracle.js';
import { compareDecisions, failureIdentity, govern } from '../experiments/praetor_verify_001/g3a/comparison.js';
import { expose, ObservableSchema, WhiteBoxSchema } from '../experiments/praetor_verify_001/g3a/exposure.js';
import { ProposalLedger, replay, type RunConfig } from '../experiments/praetor_verify_001/g3a/runtime.js';

const config: RunConfig = { experiment_id: 'PRAETOR-VERIFY-001', phase: 'G3A', subgate: 'G3A.2', seed: 100,
  algorithm: 'calibration', algorithm_version: 'v1', regime: 'G3-observable', proposal_budget: 5, synthetic: true };
afterEach(() => vi.restoreAllMocks());

describe('G3A candidate contract and distinct decision paths', () => {
  it('validates a fully bound synthetic candidate and hashes canonical field ordering', () => {
    const candidate = calibrationCandidate();
    expect(CandidateSchema.parse(candidate)).toEqual(candidate);
    expect(sha256(candidate)).toBe(sha256(Object.fromEntries(Object.entries(candidate).reverse())));
    expect(sha256(schemaDescription())).toHaveLength(64);
  });
  it('rejects holdout, injected authority, missing provenance, invalid ranges and joint constraints', () => {
    const base = calibrationCandidate();
    for (const patch of [ { partition: 'G3B_COMPARATIVE_HOLDOUT' }, { selected_verifier: 'AGENT_K' }, { source_id: '' }, { semantic_confidence: 2 }, { semantic_confidence: null }, { authority_present: false }, { proof_available: false } ]) {
      expect(CandidateSchema.safeParse({ ...base, ...patch }).success).toBe(false);
    }
  });
  it.each([
    [{}, 'VERIFIED'], [{ authority_present: false, authority_valid: false }, 'NON_CERTIFIED'],
    [{ proof_available: false, proof_supports_claim: false }, 'NON_CERTIFIED'],
    [{ tool_permission: 'denied' }, 'REJECTED'], [{ proof_supports_claim: false }, 'REJECTED'],
    [{ record_tool: 'synthetic_inspect' }, 'NON_CERTIFIED'], [{ claim_family: 'human' }, 'REVIEW_REQUIRED'],
    [{ claim_family: 'universal', claim_universality: 'universal' }, 'NON_CERTIFIED'], [{ claim_family: 'semantic' }, 'SEMANTICALLY_SUPPORTED'],
    [{ claim_family: 'semantic', contradiction_score: 1 }, 'SEMANTICALLY_FLAGGED']
  ])('independently evaluates calibration patch %j', (patch, expected) => {
    const input = { ...calibrationCandidate(), ...patch };
    const actual = evaluatePraetorExperimental(input);
    const oracle = adjudicateExpected(input);
    expect(actual.disposition).toBe(expected);
    expect(oracle.disposition).toBe(expected);
    expect(actual).not.toBe(oracle);
    actual.disposition = 'UNAVAILABLE';
    expect(oracle.disposition).toBe(expected);
    oracle.disposition = 'UNAVAILABLE';
    expect(evaluatePraetorExperimental(input).disposition).toBe(expected);
  });
});

describe('G3A.1 runtime accounting, fingerprints and reconstruction', () => {
  it('rejects non-JSON canonical values without aliasing, preserves array order and normalizes -0', () => {
    const circular: Record<string, unknown> = {}; circular.self = circular;
    for (const input of [undefined, Number.NaN, Infinity, 9007199254740992, new Date(), new Map(), circular, [undefined], Array(1)]) expect(() => canonical(input)).toThrow();
    expect(canonical(-0)).toBe('0');
    expect(sha256([1, 2])).not.toBe(sha256([2, 1]));
  });
  it('counts invalid, duplicate and paid references, exhausts once, and replays every recorded attempt', () => {
    const ledger = new ProposalLedger(config);
    const candidate = calibrationCandidate();
    ledger.propose('{', 0);
    ledger.propose(JSON.stringify(candidate), 0);
    ledger.propose(JSON.stringify(candidate), 0);
    ledger.propose(JSON.stringify({ ...candidate, urgency: 'critical' }), 0, { iteration: 2, kind: 'pressure' });
    ledger.propose(JSON.stringify({ ...candidate, authority_valid: false }), 0, { iteration: 2, kind: 'transition' });
    expect(ledger.used).toBe(5);
    expect(ledger.traces[0].comparison).toBeNull();
    expect(ledger.traces[0].private_reward).toBe(-1);
    expect(ledger.traces[2].duplicate).toBe(true);
    expect(() => ledger.propose(JSON.stringify(candidate), 0)).toThrow('budget exhausted');
    expect(replay(ledger.traces)).toBe(true);
    expect(ledger.used).toBe(5);
  });
  it('rejects unpaid and nonmatching references before either decision path', () => {
    const observed = vi.spyOn(evaluatorModule, 'evaluatePraetorExperimental');
    const ledger = new ProposalLedger(config);
    const candidate = calibrationCandidate();
    ledger.propose(JSON.stringify(candidate), 0, { iteration: 1, kind: 'pressure' });
    expect(observed).not.toHaveBeenCalled();
    ledger.propose(JSON.stringify(candidate), 0);
    ledger.propose(JSON.stringify({ ...candidate, authority_valid: false }), 0, { iteration: 2, kind: 'pressure' });
    expect(observed).toHaveBeenCalledTimes(1);
    expect(ledger.traces[2].valid).toBe(false);
  });
  it('stops explicitly on generation deadline with no retries or further proposals', () => {
    const ledger = new ProposalLedger(config);
    expect(() => ledger.propose(JSON.stringify(calibrationCandidate()), LIMITS.generation_timeout_ms + 1)).toThrow('GENERATION_DEADLINE');
    expect(ledger.used).toBe(1);
    expect(ledger.traces[0].stop_reason).toBe('GENERATION_DEADLINE');
    expect(() => ledger.propose('{}', 0)).toThrow('Ledger stopped');
    expect(ledger.used).toBe(1);
  });
  it('bounds input bytes and reserves G3B seeds/partition from this runtime', () => {
    const ledger = new ProposalLedger(config);
    ledger.propose('x'.repeat(LIMITS.input_bytes + 1), 0);
    expect(ledger.traces[0].raw_envelope).toBeNull();
    expect(ledger.traces[0].error).toBe('INPUT_BYTE_LIMIT');
    expect(() => new ProposalLedger({ ...config, seed: 0 })).toThrow();
    expect(LIMITS.prefixes).toEqual([100, 250, 500, 1000, 2500]);
  });
  it('keeps exact-state and logical identities distinct and makes traces immutable', () => {
    const candidate = calibrationCandidate();
    const changed = { ...candidate, urgency: 'critical' as const };
    expect(sha256(candidate)).not.toBe(sha256(changed));
    expect(failureIdentity(candidate, 'OVERREACH_MISSING_PROOF')).toEqual(failureIdentity(changed, 'OVERREACH_MISSING_PROOF'));
    const ledger = new ProposalLedger(config);
    ledger.propose(JSON.stringify(candidate), 0);
    expect(() => { ledger.traces[0].state!.authority_valid = false; }).toThrow();
    expect(() => { Array.prototype.push.call(POLICIES.permission.obligation, 'injected'); }).toThrow();
    const altered = structuredClone(ledger.traces);
    altered[0].oracle_disposition!.disposition = 'REJECTED';
    expect(replay(altered)).toBe(false);
  });
});

describe('G3A.2 observed/oracle and information-flow independence', () => {
  it('oracle label injection changes only private comparison, not the observed path or observable feedback', () => {
    const raw = JSON.stringify(calibrationCandidate());
    const baseline = new ProposalLedger(config);
    const expectedFeedback = baseline.propose(raw, 0);
    vi.spyOn(oracleModule, 'adjudicateExpected').mockReturnValue({ disposition: 'NON_CERTIFIED', verifier: 'AGENT_K' });
    const mutated = new ProposalLedger(config);
    expect(mutated.propose(raw, 0)).toEqual(expectedFeedback);
    expect(mutated.traces[0].observed_disposition).toEqual(baseline.traces[0].observed_disposition);
    expect(mutated.traces[0].comparison!.categories).toContain('UNAUTHORIZED_CERTIFICATION');
  });
  it('observed injection neither edits oracle result nor receives its mutable input', () => {
    const candidate = calibrationCandidate();
    const actualOracle = adjudicateExpected(candidate);
    const observedInputs: unknown[] = [];
    const oracleInputs: unknown[] = [];
    vi.spyOn(evaluatorModule, 'evaluatePraetorExperimental').mockImplementation(input => {
      observedInputs.push(input);
      (input as Record<string, unknown>).source_id = 'changed_copy';
      return { disposition: 'NON_CERTIFIED', verifier: 'AGENT_K' };
    });
    vi.spyOn(oracleModule, 'adjudicateExpected').mockImplementation(input => { oracleInputs.push(input); return actualOracle; });
    const ledger = new ProposalLedger(config);
    ledger.propose(JSON.stringify(candidate), 0);
    expect(observedInputs[0]).not.toBe(oracleInputs[0]);
    expect(oracleInputs[0]).toEqual(candidate);
    expect(ledger.traces[0].oracle_disposition).toEqual(actualOracle);
    expect(ledger.traces[0].comparison!.categories).toContain('FALSE_NON_CERTIFICATION');
  });
  it('enforces exact feedback allowlists and excludes expected labels and private objects', () => {
    const observed = { disposition: 'NON_CERTIFIED' as const, verifier: 'AGENT_K' as const };
    const publicFeedback = expose('G3-observable', true, observed, ['OVERREACH_MISSING_PROOF'], 2);
    expect(Object.keys(publicFeedback).sort()).toEqual(['envelope_valid', 'governed_disposition', 'selected_verifier']);
    expect(ObservableSchema.safeParse({ ...publicFeedback, oracle_disposition: 'VERIFIED' }).success).toBe(false);
    const richFeedback = expose('G3-white-box', true, observed, ['OVERREACH_MISSING_PROOF'], 2);
    expect(Object.keys(richFeedback).sort()).toEqual(['capability_map', 'confirmed_failure', 'envelope_valid', 'explicit_reward', 'failure_categories', 'governed_disposition', 'proof_definitions', 'selected_verifier']);
    expect(WhiteBoxSchema.safeParse({ ...richFeedback, expected_answer: 'VERIFIED' }).success).toBe(false);
  });
  it('keeps evaluator/oracle module dependencies separate and does not import the frozen coupled path', () => {
    for (const name of ['evaluator', 'oracle']) {
      const source = readFileSync(new URL(`../experiments/praetor_verify_001/g3a/${name}.ts`, import.meta.url), 'utf8');
      const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
      expect(imports).toEqual(['./contract.js']);
      expect(source).not.toContain('import(');
      expect(source).not.toContain('readFile');
    }
  });
  it('does not let a semantic observation override an Agent K failure', () => {
    for (const disposition of ['VERIFIED', 'SEMANTICALLY_SUPPORTED', 'UNAVAILABLE'] as const) {
      expect(govern({ disposition, verifier: 'SEMANTIC_JUDGE' }, 'FAIL').disposition).toBe('REJECTED');
    }
  });
  it('detects evidence overreach, semantic authority escalation and missed human review', () => {
    const verified = { disposition: 'VERIFIED' as const, verifier: 'AGENT_K' as const };
    const missing = { ...calibrationCandidate(), proof_available: false, proof_supports_claim: false };
    expect(compareDecisions(missing, verified, adjudicateExpected(missing)).categories).toContain('OVERREACH_MISSING_PROOF');
    const semantic = { ...calibrationCandidate(), claim_family: 'semantic' as const };
    expect(compareDecisions(semantic, verified, adjudicateExpected(semantic)).categories).toContain('SEMANTIC_TO_AUTHORITY_ESCALATION');
    const human = { ...calibrationCandidate(), claim_family: 'human' as const };
    expect(compareDecisions(human, verified, adjudicateExpected(human)).categories).toContain('FAILED_HUMAN_ESCALATION');
  });
  it('fails closed on an unclassified disagreement rather than counting it as no failure', () => {
    vi.spyOn(evaluatorModule, 'evaluatePraetorExperimental').mockReturnValue({ disposition: 'UNAVAILABLE', verifier: 'NONE' });
    const ledger = new ProposalLedger(config);
    expect(() => ledger.propose(JSON.stringify(calibrationCandidate()), 0)).toThrow('UNCLASSIFIED_DISAGREEMENT');
    expect(ledger.stopped).toBe('UNCLASSIFIED_DISAGREEMENT');
  });
  it('stops on evaluator errors and on measured evaluation/resource overruns', () => {
    vi.spyOn(evaluatorModule, 'evaluatePraetorExperimental').mockImplementation(() => { throw new Error('injected'); });
    const failed = new ProposalLedger(config);
    expect(() => failed.propose(JSON.stringify(calibrationCandidate()), 0)).toThrow('EVALUATION_ERROR');
    expect(failed.used).toBe(1);
    vi.restoreAllMocks();
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(101);
    const timed = new ProposalLedger(config);
    expect(() => timed.propose(JSON.stringify(calibrationCandidate()), 0)).toThrow('EVALUATION_DEADLINE');
    vi.restoreAllMocks();
    const usage = process.memoryUsage();
    vi.spyOn(process, 'memoryUsage').mockReturnValue({ ...usage, rss: LIMITS.max_rss_bytes + 1 });
    const resource = new ProposalLedger(config);
    expect(() => resource.propose(JSON.stringify(calibrationCandidate()), 0)).toThrow('RESOURCE_LIMIT');
  });
});