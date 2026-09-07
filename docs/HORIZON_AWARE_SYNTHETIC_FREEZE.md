# Horizon-Aware Synthetic Study Freeze

**Status:** COMPLETE - HARNESS VALIDATION ONLY
**Freeze date:** 2026-09-04
**Live-model results:** none

This document freezes the deterministic synthetic horizon study before any
live-model adapter is introduced. The synthetic evidence artifact remains
separate from all future LM Studio results.

## Frozen configuration

- Horizons: `H = 2, 4, 8, 16, 32`.
- Seeds: integers `1..100` independently paired with each horizon.
- Fault matrix: 100 seeds x 5 horizons x 4 conditions = 2,000 trajectories.
- Clean control: the same 100 seeds x 5 horizons x 4 conditions = 2,000 trajectories with `fault_mode = clean_control`.
- Conditions: `A_baseline`, `B_judge_only`, `C_agent_k_only`, `D_agent_k_hybrid`.
- Fault schedule: deterministic modulo-11 function in `faultForStep`.
- Judge: deterministic lexical fake judge only.
- Replay requirement: serialized runs must compare byte-for-byte equal on rerun.
- No LM Studio endpoint, network service, or live model was used.

## Frozen semantics

The existing definitions of `task_success`, first-error containment,
propagation suppression, unsafe persistence, recovery probability, and safe
recovery are frozen. Safe recovery is supplementary and must not alter or
retroactively improve `task_success`.

Post-fault outcomes remain:

- `unsafe_continuation`;
- `safe_termination`;
- `safe_continuation_without_recovery`;
- `safe_recovery_and_continued_execution`.

## Preservation artifacts

- [Horizon preregistration](HORIZON_AWARE_EVALUATION_STUDY.md)
- [Synthetic results](HORIZON_AWARE_SYNTHETIC_RESULTS.md)
- [Runner](../scripts/horizon-study.ts)
- [Contracts and simulator](../src/research/horizonEvaluation.ts)
- [Focused tests](../test/horizon-evaluation.test.ts)

Relevant content hashes must be generated from the checked-out files and
recorded with the release or commit that preserves this freeze. Future live
results must include their own model, prompt, adapter, and trace fingerprints.

## Freeze fingerprints

SHA-256 fingerprints at this phase boundary:

| Artifact | SHA-256 |
|---|---|
| `src/research/horizonEvaluation.ts` | `49E6C5539EBC1DD7CB760EDE763350E110F641F5FECDD3CC060BA92751E4519A` |
| `scripts/horizon-study.ts` | `FE3D43A44E157D98556CF5CF334F11D3F4EF9EE147B3C8083004A540D3ECB444` |
| `docs/HORIZON_AWARE_SYNTHETIC_RESULTS.md` | `43DC718678840C325E49D80E35E8C69F747DEC4AD721FBAB58162B4ED42EF9A0` |
| `test/horizon-evaluation.test.ts` | `191C970B5EB6105FC1808F2FE2633305E4092073A909C41C0515900ED33D46EC` |
| `package.json` | `3D7D1E775D00FF0CC4C1E174C00D8F893500DC6A98147B18AA457BF6B77E5A28` |

## Claim boundary

The frozen artifact supports only the claim that the deterministic synthetic
harness demonstrates containment and safe-recovery behavior under its
programmed fault model. It is not evidence that PRAETOR improves LLM
reliability, task completion, or mitigates agent rot.
