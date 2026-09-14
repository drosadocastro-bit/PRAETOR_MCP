# Post-G3B Next Research Design Review

**Decision date:** 2026-09-14
**Selection:** NO NEW EXPERIMENT YET
**Authority effect:** NONE

The post-G3B baseline now has an implementation path for local evidence
durability and a selectively recovered hybrid shadow evaluator. Creating G3C
or launching a hybrid study immediately would add process before the new
mechanisms have been reviewed as a stable baseline.

## Option review

| Option | Current assessment |
|---|---|
| New adaptive successor study | Premature. G3B is closed and any successor requires a genuinely new, explicit design basis plus durable authority bytes. |
| Hybrid evaluation study | Highest near-term research value, but it first needs human review and preregistration against the shadow-only implementation. |
| NIC + PRAETOR integration | Insufficient current evidence and unclear claim boundary. |
| Hackathon demo hardening | Valuable engineering work, but no verified timeline in this review requires it to displace stabilization. |
| No new experiment yet | Selected. Minimizes unresolved risk and avoids creating an experiment solely because G3B ended. |

The next reasonable candidate is a preregistered hybrid shadow study after:

1. the durability and shadow implementation receives review;
2. exact study inputs are preserved through the availability gate;
3. model/configuration fingerprints and failure classifications are frozen;
4. candidate false-positive and false-negative labels are explicitly defined
   as review candidates rather than ground truth;
5. the study states which meaningful claim, if any, its evidence could change.

This review creates no experiment, no execution authority, no holdout access,
and no permission to reopen G3B.
