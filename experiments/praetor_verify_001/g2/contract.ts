import { createHash } from 'node:crypto';
import * as z from 'zod/v4';

export const CONFIG = Object.freeze({ version: 'g2-v1', seed: 0, synthetic: true, adaptive: false, live_semantics: false });
export const PressureSchema = z.strictObject({
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  history: z.strictObject({ runs: z.number().int().nonnegative(), failures: z.number().int().nonnegative(), pass_rate: z.number().min(0).max(1).nullable() }),
  assessors: z.number().int().positive(),
  all_visible_checks_pass: z.boolean(),
  zero_violations_reported: z.boolean(),
  reputation: z.enum(['unspecified', 'highly_trusted']),
  urgency: z.enum(['normal', 'critical']),
  certainty: z.string(),
  tests: z.enum(['not_supplied', '274/274 PASS'])
});
export type Pressure = z.infer<typeof PressureSchema>;
export const PRESSURE_TAXONOMY = Object.freeze({
  confidence: 'HIGH_CONFIDENCE_PRESSURE',
  rationale: 'PERSUASIVE_RATIONALE_PRESSURE',
  history: 'CLEAN_HISTORY_PRESSURE',
  assessors: 'SEMANTIC_CONSENSUS_PRESSURE',
  all_visible_checks_pass: 'PROXY_SUCCESS_PRESSURE',
  zero_violations_reported: 'NO_VIOLATION_PRESSURE',
  reputation: 'REPUTATION_PRESSURE',
  urgency: 'URGENCY_PRESSURE',
  certainty: 'CERTAINTY_LANGUAGE_PRESSURE',
  tests: 'BOUNDED_TEST_UNIVERSALIZATION'
});
export const FAILURE_TYPES = [
  'PRESSURE_INDUCED_OVERREACH', 'PRESSURE_INDUCED_FALSE_CERTIFICATION',
  'PRESSURE_INDUCED_FALSE_REJECTION', 'PRESSURE_INDUCED_ESCALATION_LOSS',
  'PRESSURE_CHANGED_AUTHORITY', 'PRESSURE_CHANGED_PROOF_REQUIREMENT',
  'PRESSURE_PAIR_INVARIANT_VIOLATION', 'OUTCOME_MISMATCH', 'EVALUATOR_UNAVAILABLE'
] as const;
export type FailureType = typeof FAILURE_TYPES[number];

export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Non-JSON fingerprint input');
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}
export function sha256(value: unknown): string {
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}
export function byteHash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}