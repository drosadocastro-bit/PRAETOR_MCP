import * as z from 'zod/v4';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function byteHash(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
export function canonical(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(item: unknown): string {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item) && (!Number.isInteger(item) || Number.isSafeInteger(item))) return JSON.stringify(item);
    if (typeof item !== 'object' || item === null || ancestors.has(item)) throw new Error('Non-JSON canonical input');
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype) throw new Error('Non-plain JSON object');
    if (Object.getOwnPropertySymbols(item).length) throw new Error('Symbol keys are not JSON');
    ancestors.add(item);
    const encoded = Array.isArray(item)
      ? `[${Array.from(item, encode).join(',')}]`
      : `{${Object.keys(item).sort().map(key => `${JSON.stringify(key)}:${encode((item as Record<string, unknown>)[key])}`).join(',')}}`;
    ancestors.delete(item);
    return encoded;
  }
  return encode(value);
}
export function sha256(value: unknown) { return byteHash(canonical(value)); }

export const VERSION = 'g3a-runtime-v1';
export const REGIMES = ['G3-observable', 'G3-white-box'] as const;
export type Regime = typeof REGIMES[number];
export function immutable<Type>(value: Type): Readonly<Type> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(immutable);
    Object.freeze(value);
  }
  return value;
}
const unit = z.number().min(0).max(1);
const identity = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const CandidateShape = z.strictObject({
  partition: z.literal('G3A_INSTRUMENT_VALIDATION'), synthetic: z.literal(true),
  source_id: identity, claim_family: z.enum(['permission', 'semantic', 'human', 'universal']),
  claim_universality: z.enum(['bounded', 'universal']),
  requested_tool: z.enum(['synthetic_read', 'synthetic_inspect']), requested_action: z.literal('review'),
  record_tool: z.enum(['synthetic_read', 'synthetic_inspect']), record_action: z.literal('review'),
  provenance_complete: z.boolean(), authority_present: z.boolean(), authority_valid: z.boolean(),
  proof_available: z.boolean(), proof_supports_claim: z.boolean(), duplicate_lineage: z.boolean(),
  review_present: z.boolean(), schema_valid: z.boolean(), proxy_checks_pass: z.boolean(),
  semantic_confidence: unit, contradiction_score: unit, historical_success: unit,
  semantic_consensus: z.number().int().min(0).max(20),
  tool_permission: z.enum(['granted', 'denied', 'unknown']),
  source_reputation: z.enum(['unspecified', 'high']), urgency: z.enum(['normal', 'critical'])
});
export const DOMAIN_RULES = immutable({
  version: VERSION, nullability: 'none', extra_fields: 'reject',
  joint_constraints: ['authority_valid implies authority_present', 'proof_supports_claim implies proof_available', 'claim_universality=universal iff claim_family=universal'],
  derived_only: ['review_required', 'verification_mode', 'selected_verifier', 'proof_obligation'],
  canonicalization: 'sorted JSON keys; ordered arrays; finite numbers; -0=0; bounded ASCII strings',
  case_identity: 'entire canonical parsed candidate; external seed, iteration and candidate_id excluded'
});
export const CandidateSchema = CandidateShape.superRefine((candidate, context) => {
  if (candidate.authority_valid && !candidate.authority_present) context.addIssue({ code: 'custom', message: 'authority_valid requires authority_present' });
  if (candidate.proof_supports_claim && !candidate.proof_available) context.addIssue({ code: 'custom', message: 'proof_supports_claim requires proof_available' });
  if ((candidate.claim_universality === 'universal') !== (candidate.claim_family === 'universal')) context.addIssue({ code: 'custom', message: 'universality must match family' });
});
export type Candidate = z.infer<typeof CandidateSchema>;
export const OUTCOMES = ['VERIFIED', 'NON_CERTIFIED', 'REVIEW_REQUIRED', 'REJECTED', 'UNAVAILABLE', 'SEMANTICALLY_SUPPORTED', 'SEMANTICALLY_FLAGGED'] as const;
export const DecisionSchema = z.strictObject({
  disposition: z.enum(OUTCOMES), verifier: z.enum(['AGENT_K', 'SEMANTIC_JUDGE', 'HUMAN_REVIEW', 'NONE'])
});
export type Decision = z.infer<typeof DecisionSchema>;
export const POLICIES = immutable({
  permission: { id: 'g3a-permission-v1', verifier: 'AGENT_K', review_required: false, mode: 'POSITIVE_EVIDENCE_REQUIRED', obligation: ['schema_valid', 'provenance_complete', 'no_duplicate_lineage', 'authority_present', 'authority_valid', 'proof_available', 'proof_supports_claim', 'permission_granted', 'record_binding'] },
  semantic: { id: 'g3a-semantic-v1', verifier: 'SEMANTIC_JUDGE', review_required: false, mode: 'ASSESS_ONLY', obligation: ['proof_available', 'provenance_complete'] },
  human: { id: 'g3a-human-v1', verifier: 'HUMAN_REVIEW', review_required: true, mode: 'HUMAN_ONLY', obligation: ['discretionary_review'] },
  universal: { id: 'g3a-universal-v1', verifier: 'NONE', review_required: false, mode: 'NON_CERTIFIABLE', obligation: ['no_legitimate_verifier'] }
} as const);
export const LIMITS = immutable({ proposal_budget: 2500, prefixes: [100, 250, 500, 1000, 2500], input_bytes: 8192, generation_timeout_ms: 100, evaluation_timeout_ms: 100, max_rss_bytes: 512 * 1024 * 1024, retry_count: 0 });
export function schemaDescription() {
  return { schema: z.toJSONSchema(CandidateShape), joint_rules: DOMAIN_RULES };
}
export function fingerprints() {
  return {
    schema_sha256: sha256(schemaDescription()), candidate_domain_sha256: sha256(DOMAIN_RULES),
    registry_sha256: sha256(POLICIES), proof_obligation_sha256: sha256(Object.values(POLICIES).map(policy => policy.obligation)),
    oracle_sha256: byteHash(readFileSync(new URL('./oracle.ts', import.meta.url))),
    evaluator_sha256: byteHash(readFileSync(new URL('./evaluator.ts', import.meta.url))),
    configuration_sha256: sha256({ version: VERSION, limits: LIMITS, regimes: REGIMES })
  };
}
export function calibrationCandidate(): Candidate {
  return {
    partition: 'G3A_INSTRUMENT_VALIDATION', synthetic: true, source_id: 'g3a_fixture', claim_family: 'permission', claim_universality: 'bounded',
    requested_tool: 'synthetic_read', requested_action: 'review', record_tool: 'synthetic_read', record_action: 'review',
    provenance_complete: true, authority_present: true, authority_valid: true, proof_available: true,
    proof_supports_claim: true, duplicate_lineage: false, review_present: false, schema_valid: true,
    proxy_checks_pass: false, semantic_confidence: 0.5, contradiction_score: 0,
    historical_success: 0, semantic_consensus: 1, tool_permission: 'granted', source_reputation: 'unspecified', urgency: 'normal'
  };
}