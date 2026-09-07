# Horizon-Aware Synthetic Results

**Run date:** 2026-09-04
**Status:** COMPLETE - HARNESS VALIDATION ONLY

These results are separate from any future live-model evaluation. They were
produced by `npm run study:horizon` using 100 fixed seeds per horizon and
condition, across `H = 2, 4, 8, 16, 32`. The run contains 2,000 fault-injection
trials and 2,000 clean-control trials. Replay was identical: `true`.

The existing task-success, containment, propagation, and unsafe-persistence
definitions were not changed. Safe recovery is reported separately.

## Fault-injection summary

| Horizon | Condition | Task success | Unsafe persistence | Safe recovery given detected fault |
|---:|---|---:|---:|---:|
| 2 | A baseline | 0.64 | 0.18 | not estimable; no detected faults |
| 2 | B judge only | 0.64 | 0.18 | 0.50 (18 detected faults) |
| 2 | C Agent K only | 0.64 | 0.00 | 0.50 (18 detected faults) |
| 2 | D Agent K + judge | 0.64 | 0.00 | 0.50 (36 detected faults) |
| 4 | A baseline | 0.27 | 0.37 | not estimable; no detected faults |
| 4 | B judge only | 0.27 | 0.37 | 0.75 (36 detected faults) |
| 4 | C Agent K only | 0.27 | 0.00 | 0.7568 (37 detected faults) |
| 4 | D Agent K + judge | 0.27 | 0.00 | 0.7534 (73 detected faults) |
| 8 | A baseline | 0.00 | 0.72 | not estimable; no detected faults |
| 8 | B judge only | 0.00 | 0.72 | 0.5091 (55 detected faults) |
| 8 | C Agent K only | 0.00 | 0.00 | 1.00 (45 detected faults) |
| 8 | D Agent K + judge | 0.00 | 0.00 | 1.00 (100 detected faults) |
| 16 | A baseline | 0.00 | 1.00 | not estimable; no detected faults |
| 16 | B judge only | 0.00 | 1.00 | 0.00 (55 detected faults) |
| 16 | C Agent K only | 0.00 | 0.00 | 1.00 (45 detected faults) |
| 16 | D Agent K + judge | 0.00 | 0.00 | 1.00 (100 detected faults) |
| 32 | A baseline | 0.00 | 1.00 | not estimable; no detected faults |
| 32 | B judge only | 0.00 | 1.00 | 0.00 (54 detected faults) |
| 32 | C Agent K only | 0.00 | 0.00 | 1.00 (46 detected faults) |
| 32 | D Agent K + judge | 0.00 | 0.00 | 1.00 (100 detected faults) |

The CLI also reports Wilson 95% confidence intervals for task success,
containment, unsafe persistence, and conditional safe recovery. A conditional
rate with zero detected faults is reported as `null` / not estimable.

## Clean negative control

All 2,000 clean-control trials contain no injected faults. Every condition at
every horizon reports task success `1.00`, unsafe persistence `0.00`, and no
post-fault recovery event. This is the expected no-advantage control and does
not support a governance benefit claim.

## Interpretation boundary

Within this synthetic harness, Agent K conditions prevent unsafe persistence
and permit bounded safe recovery after detected faults. They do not improve the
existing task-success rate in the fault matrix, and safe recovery does not
retroactively change `task_success`.

These results support only claims about deterministic containment and safe
recovery behavior of this harness. They are not evidence that PRAETOR improves
LLM reliability, task completion, or mitigates agent rot. No LM Studio or other
live-model adapter was used.
