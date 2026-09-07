# Hybrid Evaluation Adoption Note

**Date:** 2026-09-04
**Status:** Post-study horizon-aware evaluation design; runtime adoption deferred

## Decision

The hybrid evaluation prototype in the separate worktree at
`C:\Users\draku\.codex\worktrees\815d\Preator_MCP` is a candidate for future
research integration. It is not merged into the active PRAETOR runtime and does
not replace `evaluateAdvisoryPacket`.

The behavioral reliability study is complete, but runtime hybrid adoption
remains deferred. The existing deterministic governance path remains
authoritative. No second authoritative call, shadow write, automatic fallback,
operational action, or live-data integration is approved by this note.

The next research design is recorded in
[HORIZON_AWARE_EVALUATION_STUDY.md](HORIZON_AWARE_EVALUATION_STUDY.md). Its
first increment adds only deterministic fake-judge contracts and trajectory
metrics. It does not connect LM Studio or add a production evaluator.

## Verification snapshot

The external worktree was verified on 2026-09-04:

- detached at the compatibility work based on commit `a6468d3`;
- `npm run check` passed;
- `npm test` passed with 208 tests across 25 files;
- `npm run evaluate:ablation` passed;
- without semantic-judge credentials, the ablation explicitly reported the
  judge as unavailable and did not substitute simulated metrics.

The worktree contains uncommitted changes. Its results are evidence about that
worktree, not evidence that the current repository has adopted the evaluator.

## Reuse candidates

The following parts are suitable for post-study evaluation work:

- typed evaluation signals with evidence roots and lineage;
- hard-boundary fusion in which deterministic failures cannot be annulled;
- Agent K observable-risk signals kept separate from semantic judgment;
- correlation accounting that avoids treating repeated lineage as independent
  corroboration; and
- offline PISO/MEDIO/TECHO ablation reports without gold-label claims.

## Adoption gates

The current behavioral reliability study is complete and preserved. Before
importing any runtime evaluator, complete the separate horizon-aware slice and:

1. compare the hybrid evaluator with the current governance path on fixed local
   synthetic fixtures;
2. introduce it first as a read-only, offline shadow evaluation layer;
3. keep the current deterministic governance result authoritative;
4. inject fake judges explicitly in tests and report unavailable real judges
   without inventing metrics;
5. test disagreement, tool failure, permission, lineage, latency, and resource
   overhead behavior; and
6. review the results before considering any advisory-only MCP exposure.

The horizon-aware slice must first pass deterministic fake-judge contract tests.
Only then may an explicitly configured local LM Studio adapter be evaluated as
a non-authoritative semantic judge. Its unavailability, malformed output,
timeout, or cancellation must remain unavailable or blocked.

The live-model phase is now preregistered in
[LIVE_MODEL_HORIZON_PREREGISTRATION.md](LIVE_MODEL_HORIZON_PREREGISTRATION.md).
The current implementation is limited to an opt-in semantic-judge and
trajectory-step instrumentation adapter plus a disabled-by-default pilot.
No live experimental results have been collected.

The optional HTTP semantic judge requires a separate security, provenance,
network, credential, and reproducibility review. It must not become an implicit
dependency of the local offline prototype.

## Explicit non-decisions

This note does not approve:

- merging the external worktree wholesale;
- adding `evaluate_hybrid` to the current MCP tool surface;
- changing deterministic governance semantics to improve hybrid results;
- treating a semantic judge as an authority source;
- treating correlation suppression as proof of statistical independence; or
- making reliability, safety, calibration, or production-readiness claims.

## References

- [PRAETOR Behavioral Reliability Study](PRAETOR_BEHAVIORAL_RELIABILITY_STUDY.md)
- [Horizon-Aware Error-Propagation Evaluation](HORIZON_AWARE_EVALUATION_STUDY.md)
- [Nova Labs Research and Implementation TODO](NOVA_LABS_RESEARCH_TODO.md)
- [MCP specification shadow mode](MCP_SPEC_SHADOW_MODE.md)