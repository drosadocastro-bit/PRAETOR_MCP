# Horizon-Aware Error-Propagation Evaluation

**Status:** Preregistered design and deterministic contract only
**Date:** 2026-09-04

## Scope

This is a proposed post-study evaluation of long-horizon error propagation in the local synthetic PRAETOR prototype. It does not add a production LLM dependency, change the MCP surface, or replace deterministic governance. The current implementation provides only a deterministic fake semantic judge and trajectory-metric contracts. LM Studio integration remains a later, explicit opt-in step.

## External motivation and relationship to prior agent-rot work

Recent empirical work has highlighted substantial degradation in LLM-agent
task success as dependent workflow horizons increase. Mittal, Shubhra,
*How Fast Do Agents Rot? An Empirical Study of Long-Horizon Degradation in
LLM Agents for Production Decision-Making*, arXiv:2609.01660 (2026), DOI
10.48550/arXiv.2609.01660, reports long-horizon degradation across multiple
models and tasks and emphasizes dependent step count and horizon-aware
evaluation.

This work is an external motivation and research catalyst for PRAETOR, not
evidence about PRAETOR. It motivates a different question: if long-horizon
agent performance degrades as dependent decisions accumulate, what changes
when intermediate decisions are subjected to an external governance layer
that separates deterministic authority from semantic evaluation? In compact
form:

```text
Mittal:   measures long-horizon agent degradation
PRAETOR:  investigates governance and containment behavior when agent
		  decisions may become incorrect
```

The current technical instrument and methods work does not test the agent-rot
hypothesis directly. It validates bounded instrumentation, authority
separation, contract enforcement, and trace behavior. The preregistered live
horizon study is the future experiment intended to investigate the PRAETOR
question under controlled conditions; it remains `NOT STARTED`.

Accordingly, PRAETOR does not claim to reproduce, refute, extend, or mitigate
Mittal's empirical results, and Mittal's study does not demonstrate PRAETOR's
effectiveness. Any relationship between long-horizon degradation and governed
containment must be established by a later controlled study, not inferred from
the present validation record.

## Research question

Can externally governed step-level evaluation change the reliability decay of long-horizon agent trajectories and, even when task failure remains possible, prevent individual errors from becoming silent consequential downstream failures?

## Fixed design

Horizons are `H = 2, 4, 8, 16, 32`. Every horizon uses matched synthetic tasks, seeds, tools, step budgets, prompts, and stopping rules. Conditions are:

- **A:** vanilla/unprotected baseline with no intermediate evaluation;
- **B:** semantic judge only;
- **C:** Agent K deterministic evaluation only;
- **D:** Agent K plus bounded semantic judge.

Agent K is authoritative for schemas, invariants, preconditions, state transitions, tool contracts, and deterministic policy. The semantic judge may classify semantic nuance only. It cannot override a hard Agent K failure. Judge unavailability, malformed output, timeout, and cancellation are unavailable or blocked, never accepted.

The first implementation uses a deterministic fake judge. A local LM Studio adapter may be added only after this contract is tested, explicitly configured, and separately identified in results.

The deterministic matrix can be reproduced with `npm run study:horizon`. It
uses 100 fixed seeds per horizon and condition. An equal-sized clean control
has no injected faults and is expected to show no governance advantage. The
script emits synthetic harness summaries only; it does not call an LLM or
represent production reliability.

The current bounded output is recorded separately in
[HORIZON_AWARE_SYNTHETIC_RESULTS.md](HORIZON_AWARE_SYNTHETIC_RESULTS.md).

## Required trajectory record

Every step records trajectory ID, horizon, condition, step number, input/output contract status, runtime state before/after, tool request/result status, first-error position, error class, detection, containment, downstream propagation, recovery, authority state, human-review state, evaluator latency/cost, and reconstructable trace ID.

Error classes are:

- reasoning or semantic error;
- invalid state transition;
- interface, schema, or tool-call error;
- propagated downstream error;
- detected-and-contained error;
- silent persisted error.

Task failure and unsafe/silent failure are separate outcomes. A task may fail safely if the error is detected, contained, and review-bound.

## Primary metrics

- per-step reliability;
- end-to-end task success;
- First Error Containment Rate (FECR);
- Propagation Suppression Rate (PSR);
- Unsafe Persistence Rate (UPR);
- first-error position distribution;
- recovery probability and valid-state return;
- post-fault outcome: unsafe continuation, safe termination, safe continuation
	without recovery, or safe recovery and continued execution;
- $P(\text{safe recovery}\mid\text{detected fault})$;
- evaluation latency and cost;
- unsafe failure versus ordinary task failure.

Safe recovery is reported separately from the existing `task_success` metric.
A trajectory may recover to a valid state and continue while retaining
`task_success = false` because the preregistered task-success definition is
unchanged. Major seed-level rates include Wilson 95% confidence intervals.

The geometric model $P(success_H) \approx r^H$ is a comparison hypothesis, not an assumed law. Report fitted degradation shape/rate with uncertainty and compare conditions by horizon rather than only aggregate success.

The safety hypothesis is:

$$
P_{unsafe}(H) \ll P_{task\text{-}failure}(H)
$$

under the governed hybrid path. This is not a result until measured.

The clean control is a harness-bias check, not a claim about production
behavior. Since it contains no injected faults, governance is not expected to
improve task success, containment, unsafe persistence, or recovery outcomes.

## Stopping conditions

Stop if a semantic judge overrides a hard Agent K failure; a timeout, cancellation, malformed judge result, or unavailable judge is accepted; authority widens; an error silently persists; a callback executes after containment; or a trace cannot reconstruct the first error and downstream state.

## Limitations

The study is bounded to synthetic local trajectories and the tested horizons. It does not establish production agent reliability, general mitigation of agent rot, model-scale effects, real-world tool availability, network behavior, or calibrated semantic-judge quality. Any LM Studio result must report model identity, local endpoint configuration, prompt/version hash, latency, failures, and reproducibility limits.

Expanded synthetic results must remain separate from future live-model results.
They may support claims about deterministic containment and safe recovery
behavior of this harness only. They must not be described as evidence that
PRAETOR improves LLM reliability, task completion, or mitigates agent rot.
