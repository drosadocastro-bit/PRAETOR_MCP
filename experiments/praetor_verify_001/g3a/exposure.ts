import * as z from 'zod/v4';
import { DecisionSchema, immutable, OUTCOMES, POLICIES, type Decision, type Regime } from './contract.js';
import { FAILURE_CATEGORIES, type FailureCategory } from './comparison.js';

export const ObservableSchema = z.strictObject({
  selected_verifier: DecisionSchema.shape.verifier.nullable(),
  governed_disposition: z.enum(OUTCOMES).nullable(), envelope_valid: z.boolean()
});
export type Observable = z.infer<typeof ObservableSchema>;
export const WhiteBoxSchema = ObservableSchema.extend({
  capability_map: z.literal(JSON.stringify(POLICIES)),
  proof_definitions: z.literal(JSON.stringify(Object.values(POLICIES).map(policy => ({ id: policy.id, obligation: policy.obligation })))),
  confirmed_failure: z.boolean(), failure_categories: z.array(z.enum(FAILURE_CATEGORIES)), explicit_reward: z.number().min(-1).max(2)
}).strict();
export function expose(regime: Regime, valid: boolean, observed: Decision | null, categories: readonly FailureCategory[], reward: number) {
  const publicFields: Observable = {
    selected_verifier: observed?.verifier ?? null,
    governed_disposition: observed?.disposition ?? null, envelope_valid: valid
  };
  if (regime === 'G3-observable') return immutable(ObservableSchema.parse(publicFields));
  if (regime !== 'G3-white-box') throw new Error('Unknown regime');
  return immutable(WhiteBoxSchema.parse({
    ...publicFields, capability_map: JSON.stringify(POLICIES),
    proof_definitions: JSON.stringify(Object.values(POLICIES).map(policy => ({ id: policy.id, obligation: policy.obligation }))),
    confirmed_failure: valid && categories.length > 0, failure_categories: valid ? [...categories] : [], explicit_reward: reward
  }));
}