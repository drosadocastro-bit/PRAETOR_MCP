# G3B and G3A Feedback Boundary

G3A `tabular-v1` uses a `G3A_TOY_ONLY` binary reward. Its update is defined as `value[action] += alpha * (toy_reward - value[action])`, and the toy reward is derived from the instrument-only objective that rewards action 3 under the toy urgency and reputation condition.

That reward is not automatically valid for G3B. G3A explicitly prevents oracle, evaluator, failure-label, and G3B reward inputs from reaching its update. G3B declares regime-specific feedback fields and explicitly states `toy_reward_not_reused`, but it does not define the exact encoding, transition formula, or mapping from four actions to G3B candidate mutations.

A principle transfers: adaptive state must consume only declared, provenance-bound feedback and must not receive hidden truth. The G3A assumptions do not transfer automatically: the toy reward, action meaning, target objective, update input schema, and action-to-candidate mapping are domain-specific.

> Principles can transfer across domains. Assumptions have to earn their way back in.

G3A semantics are therefore not authoritative for G3B. G3B requires its own feedback contract and human reauthorization for the material transition and action semantics.
