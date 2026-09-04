# Hybrid Evaluation Adoption Note

**Date:** 2026-09-04
**Status:** Deferred until the behavioral reliability study is complete

## Decision

The hybrid evaluation prototype in the separate worktree at
`C:\Users\draku\.codex\worktrees\815d\Preator_MCP` is a candidate for future
research integration. It is not merged into the active PRAETOR runtime and does
not replace `evaluateAdvisoryPacket`.

The existing deterministic governance path remains authoritative while the
behavioral reliability study is running. No second authoritative call, shadow
write, automatic fallback, operational action, or live-data integration is
approved by this note.

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

Before importing any implementation, complete the current behavioral reliability
study and preserve its exact artifacts. Then, in a separate post-study slice:

1. compare the hybrid evaluator with the current governance path on fixed local
   synthetic fixtures;
2. introduce it first as a read-only, offline shadow evaluation layer;
3. keep the current deterministic governance result authoritative;
4. inject fake judges explicitly in tests and report unavailable real judges
   without inventing metrics;
5. test disagreement, tool failure, permission, lineage, latency, and resource
   overhead behavior; and
6. review the results before considering any advisory-only MCP exposure.

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
- [Nova Labs Research and Implementation TODO](NOVA_LABS_RESEARCH_TODO.md)
- [MCP specification shadow mode](MCP_SPEC_SHADOW_MODE.md)