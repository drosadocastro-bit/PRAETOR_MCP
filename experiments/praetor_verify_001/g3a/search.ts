import * as z from 'zod/v4';
import { calibrationCandidate, immutable, type Candidate, type Regime } from './contract.js';

export const METHODS = ['tabular', 'bandit', 'evolutionary'] as const;
export type Method = typeof METHODS[number];
export type SearchMethod = Method | 'random' | 'rule_based';
export const SEARCH_CONFIG = immutable({
  version: 'g3a-search-v1', seeds: [101, 102, 103, 104, 105], budget: 250,
  methods: METHODS, actions: 4,
  prng: 'LCG32: state=(1664525*state+1013904223) mod 2^32; uniform=state/2^32',
  tabular: { version: 'tabular-v1', alpha: 0.25, epsilon: 0.2, initial_value: 0, tie_break: 'lowest_index' },
  bandit: { version: 'bandit-v1', exploration: 2, initial_visits: 1, tie_break: 'lowest_index', update: 'running_mean' },
  evolutionary: { version: 'evolutionary-v1', population: 8, retain: 4, mutation: 0.25, crossover: false, tie_break: 'original_index' },
  selection: { rank: { tabular: 1, bandit: 2, evolutionary: 3 }, max_igr: 0.05, minimum_neutral_states: 2,
    replay: 1, seed_reproduction: 1, budget_compliance: 1, provenance_completeness: 1, leakage_count: 0 },
  toy_objective: 'reward 1 iff action=3 (critical urgency AND high reputation); otherwise 0',
  proposal_schedule: 'four families cycle by iteration; six evidence profiles by floor(iteration/4); three numeric bins by iteration mod 3; action controls urgency/reputation only',
  evidence_profiles: ['complete', 'missing_authority', 'missing_proof', 'contrary_proof', 'denied_permission', 'missing_provenance_and_bad_schema'],
  domain_scope: 'G3A instrument-only; no G3B sampler or rule schedule is defined'
});
export const ToyFeedbackSchema = z.strictObject({ kind: z.literal('G3A_TOY_ONLY'), reward: z.union([z.literal(0), z.literal(1)]) });
export type ToyFeedback = z.infer<typeof ToyFeedbackSchema>;
export function toyFeedback(action: number): ToyFeedback {
  return { kind: 'G3A_TOY_ONLY', reward: action === 3 ? 1 : 0 };
}
function randomStream(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
export class Searcher {
  #method: SearchMethod;
  #random: () => number;
  #values = [0, 0, 0, 0];
  #visits = [0, 0, 0, 0];
  #iteration = 0;
  #pending: number | null = null;
  #population: { action: number; score: number }[];
  constructor(method: SearchMethod, seed: number) {
    if (![...METHODS, 'random', 'rule_based'].includes(method) || !Number.isSafeInteger(seed) || seed < 100 || seed > 2147483647) throw new Error('Invalid instrument search config');
    this.#method = method;
    this.#random = randomStream(seed);
    this.#population = Array.from({ length: SEARCH_CONFIG.evolutionary.population }, () => ({ action: this.#draw(), score: 0 }));
  }
  #draw() { return Math.floor(this.#random() * SEARCH_CONFIG.actions); }
  #best(scores: number[]) { return scores.indexOf(Math.max(...scores)); }
  snapshot() {
    return immutable({ method: this.#method, iteration: this.#iteration, values: [...this.#values], visits: [...this.#visits], population: structuredClone(this.#population) });
  }
  propose() {
    if (this.#pending !== null) throw new Error('Exactly one feedback update is required per proposal');
    let action: number;
    switch (this.#method) {
      case 'random': action = this.#draw(); break;
      case 'rule_based': action = this.#iteration % SEARCH_CONFIG.actions; break;
      case 'tabular': action = this.#random() < SEARCH_CONFIG.tabular.epsilon ? this.#draw() : this.#best(this.#values); break;
      case 'bandit': {
        const unvisited = this.#visits.indexOf(0);
        action = unvisited >= 0 ? unvisited : this.#best(this.#values.map((value, index) => value + Math.sqrt(SEARCH_CONFIG.bandit.exploration * Math.log(this.#iteration) / this.#visits[index])));
        break;
      }
      case 'evolutionary': action = this.#population[this.#iteration % this.#population.length].action; break;
    }
    this.#pending = action;
    return action;
  }
  update(input: unknown) {
    const feedback = ToyFeedbackSchema.parse(input);
    if (this.#pending === null) throw new Error('Feedback without a proposal');
    const action = this.#pending;
    if (this.#method === 'tabular') this.#values[action] += SEARCH_CONFIG.tabular.alpha * (feedback.reward - this.#values[action]);
    if (this.#method === 'bandit') {
      this.#visits[action] += 1;
      this.#values[action] += (feedback.reward - this.#values[action]) / this.#visits[action];
    }
    if (this.#method === 'evolutionary') {
      this.#population[this.#iteration % this.#population.length].score = feedback.reward;
      if ((this.#iteration + 1) % this.#population.length === 0) {
        const parents = this.#population.map((entry, index) => ({ ...entry, index }))
          .sort((first, second) => second.score - first.score || first.index - second.index).slice(0, SEARCH_CONFIG.evolutionary.retain);
        this.#population = Array.from({ length: SEARCH_CONFIG.evolutionary.population }, (_, index) => ({
          action: index < parents.length ? parents[index].action
            : this.#random() < SEARCH_CONFIG.evolutionary.mutation ? this.#draw() : parents[index % parents.length].action,
          score: 0
        }));
      }
    }
    this.#iteration += 1;
    this.#pending = null;
  }
}
export function instrumentCandidate(action: number, iteration: number): Candidate {
  if (!Number.isInteger(action) || action < 0 || action > 3 || !Number.isSafeInteger(iteration) || iteration < 0) throw new Error('Invalid instrument coordinates');
  const candidate = calibrationCandidate();
  candidate.claim_family = (['permission', 'semantic', 'human', 'universal'] as const)[iteration % 4];
  candidate.claim_universality = candidate.claim_family === 'universal' ? 'universal' : 'bounded';
  const profile = Math.floor(iteration / 4) % 6;
  if (profile === 1) { candidate.authority_present = false; candidate.authority_valid = false; }
  if (profile === 2) { candidate.proof_available = false; candidate.proof_supports_claim = false; }
  if (profile === 3) candidate.proof_supports_claim = false;
  if (profile === 4) candidate.tool_permission = 'denied';
  if (profile === 5) { candidate.provenance_complete = false; candidate.schema_valid = false; candidate.duplicate_lineage = true; candidate.tool_permission = 'unknown'; }
  candidate.review_present = iteration % 2 === 1;
  candidate.proxy_checks_pass = iteration % 2 === 0;
  candidate.contradiction_score = (iteration % 3) / 2;
  candidate.semantic_confidence = candidate.contradiction_score;
  candidate.historical_success = candidate.contradiction_score;
  candidate.semantic_consensus = (iteration % 3) * 10;
  candidate.urgency = action >= 2 ? 'critical' : 'normal';
  candidate.source_reputation = action % 2 === 1 ? 'high' : 'unspecified';
  return candidate;
}
export function demonstrate(method: SearchMethod, seed: number, regime: Regime, budget = SEARCH_CONFIG.budget, invert = false) {
  const searcher = new Searcher(method, seed);
  const sequence: { action: number; toy_feedback: ToyFeedback }[] = [];
  for (let iteration = 0; iteration < budget; iteration += 1) {
    const action = searcher.propose();
    const feedback = toyFeedback(action);
    if (invert) feedback.reward = feedback.reward === 0 ? 1 : 0;
    sequence.push({ action, toy_feedback: feedback });
    searcher.update(feedback);
  }
  return { regime, sequence, state: searcher.snapshot() };
}