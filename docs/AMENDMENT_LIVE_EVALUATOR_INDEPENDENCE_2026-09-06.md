# Amendment: Live Evaluator Independence

**Date:** 2026-09-06  
**Status:** PILOT / INSTRUMENT VALIDATION ONLY  
**Experimental study:** NOT STARTED  
**Adapter status:** NOT FROZEN  
**Supersedes for future pilot instrumentation:** `lm-studio-semantic-judge-v3` input-flow behavior only

## Motivation

The input-flow audit identified an execution dependency in which a deterministic
Agent K hard-rule failure prevented independent semantic-evaluator observation.
The prior v3 path returned before dispatching the semantic request when
`hard_rule_failure=true`. This made the semantic evaluator unobservable in the
hybrid condition and confounded evaluator behavior with orchestration behavior.

This amendment is motivated by evaluator independence, observability, and
reconstructable instrumentation. It is not motivated by pilot performance,
model quality, task completion, reliability, or any desired change in observed
results.

## Corrected behavior

For pilot observations that require both evaluators, evidence, context, and
claim are sent to the semantic judge independently of Agent K's deterministic
result. The semantic payload no longer includes `hard_rule_failure` as semantic
input. Dispatch and response status are recorded explicitly.

Agent K remains authoritative for deterministic hard-rule decisions. Governance
fusion remains fail-closed:

- `Agent K=FAIL` and semantic `PASS` produces final `FAIL`.
- `Agent K=FAIL` and semantic `FAIL` produces final `FAIL`.
- `Agent K=FAIL` and semantic `UNAVAILABLE` produces final `FAIL`.
- A semantic observation never clears or overrides an Agent K hard-rule failure.

Evaluator disagreement is telemetry, not a new success metric and not a change
to the preregistered study.

## Scope and preservation

This amendment changes only live instrument execution and traceability. It does
not change the frozen synthetic study, frozen hypotheses, metrics, horizons,
A/B/C/D meanings, thresholds, task-success definitions, governance authority,
or the preregistered live study. Baseline, judge-only, and Agent-K-only
semantics remain distinct; the primary correction concerns hybrid observability.

All resulting artifacts remain labeled `PILOT / INSTRUMENT VALIDATION ONLY`.
Historical v3 artifacts remain unchanged. The corrected live instrument uses a
new v4 adapter/configuration fingerprint and links back to the v3 input-flow
audit that motivated this amendment.

## Acceptance boundary

The amendment may support claims only about evaluator independence,
deterministic authority preservation, trace reconstruction, disagreement
observability, and fail-closed instrument behavior. It does not support claims
that the hybrid is more accurate, more reliable, better at task completion, or
mitigates agent rot.
