# Post-Freeze Trace Integrity Correction

**Frozen baseline:** `lm-studio-semantic-judge-v6`  
**Corrected instrument:** `lm-studio-semantic-judge-v6.1`  
**Status:** FROZEN  
**Preregistered live study:** NOT STARTED  
**Experimental observations:** 0

The regenerated validation artifact is
`data/pilot/live-horizon-pilot-v6.1-latest.json` with SHA-256
`37ae78b1e6ace2334319be27f3859c15a046ca9ebc243c78bc0d97ed2286dd42`.
Adapter, serializer, and v6 prompt fingerprints are unchanged by this
metadata-only correction.

## Frozen observation

The frozen v6 artifact remains unchanged at
`data/pilot/live-horizon-pilot-v6-latest.json`. In its
`combined-hard-and-semantic` record, the raw and parsed semantic observations
reported `available=true` and `semantic_error=true`. Semantic telemetry
reported `semantic_judge_decision=FAIL`, Agent K reported `FAIL`, and governed
disposition remained `FAIL`. The downstream `judge_and_governance.result`
representation reported `semantic_error=false` with an authority-oriented
reason.

This is classified as a **TRACE / REPRESENTATION INTEGRITY DEFECT**. It is not
a semantic model failure, governance failure, Agent K failure, parser failure,
or semantic contract-compliance failure.

## Exact transformation path

The path was:

```text
raw model output
-> LmStudioSemanticJudge.evaluateWithTrace().result
-> evaluateLiveJudgeWithGovernance()
-> applyJudgeWithoutOverridingHardFailure()
-> governedResult
-> returned evaluation.result / judge_and_governance.result
-> artifact serialization
```

In `src/research/horizonEvaluation.ts`,
`applyJudgeWithoutOverridingHardFailure()` returned a copied result with
`semantic_error=false` and an authority reason when `input.hard_rule_failure`
was true and the semantic result had `semantic_error=true`. In
`src/research/liveModelEvaluation.ts`,
`evaluateLiveJudgeWithGovernance()` assigned that authority-adjusted object to
the returned `result`, while telemetry separately retained the semantic judge
decision. Therefore the replacement occurred only on the hard-rule-failure
path. C/D routing did not change the transformation itself; C did not dispatch
the semantic judge, while D exposed the inconsistency because it dispatched
independently with Agent K failing.

## v6.1 correction

`src/research/liveModelEvaluationV61.ts` reuses the frozen v6 client, parser,
prompt, semantic fields, and availability contract. It calls
`evaluateWithTrace()` directly, preserves its result as the semantic
observation, and computes governance separately. The governance object carries
`agent_k_decision`, `semantic_judge_decision`, `governed_disposition`,
`evaluator_agreement`, and `authority_override_attempted`. No governance step
mutates semantic observation fields.

The corrected version is explicitly `lm-studio-semantic-judge-v6.1`. Its
configuration fingerprint and adapter/serializer fingerprints are new. The v6
prompt fingerprint is intentionally unchanged because prompt text and semantic
input flow are unchanged.

Each semantic observation retains its accepted result plus status, raw output,
parsed intermediate value, request fingerprint, response fingerprint,
canonical payload fingerprint, configuration fingerprint, adapter version, and
prompt fingerprint.

The fields have these definitions:

```text
observed_semantic_error = semantic_observation.semantic_error
                         when semantic_observation.available=true,
                         otherwise null

semantic_expectation_match = observed_semantic_error == expected_semantic_error
                             when semantic_observation.available=true,
                             otherwise null
```

Neither field is derived from Agent K or final governance.

## Combined fixture expectation

The v6 historical live-model expectation remains unchanged and is not rescored.
The v6.1 synthetic fixture intentionally uses
`expected_semantic_error=true` to exercise the Judge-FAIL branch and verify
that a semantic FAIL remains preserved when Agent K also fails. This does not
reinterpret or rescore any historical v6 fixture. The v6.1 model is
`synthetic-v6.1-trace-integrity-fixture`; it validates representation
integrity, semantic-observation preservation, governance separation,
provenance, and deterministic invariants, not semantic performance of Qwen.

## Fresh bounded v6.1 validation

The new runner writes
`data/pilot/live-horizon-pilot-v6.1-latest.json` and uses synthetic local
responses only. It covers K PASS/Judge PASS, K PASS/Judge FAIL, C Agent-K-only,
K FAIL/Judge PASS, K FAIL/Judge FAIL, unavailable semantic judgment, and
semantic schema failure. It is labeled `PILOT / INSTRUMENT VALIDATION ONLY`,
with `experimental_observation=false`, `experimental_observations=0`, and the
preregistered live study not started.

The validation gate requires semantic field preservation, separate governance,
provenance linkage, C no-dispatch, D independent dispatch, and
`AgentK=FAIL => GovernedDisposition=FAIL`. The v6.1 artifact reports these
invariants as passing. This supports trace-integrity and reconstruction claims
only; it does not support semantic accuracy, reliability, A/B/C/D superiority,
task-success, or agent-rot claims.

## Status boundary

```text
V6: FROZEN HISTORICAL INSTRUMENT
KNOWN TRACE REPRESENTATION DEFECT DOCUMENTED

V6.1: TRACE-INTEGRITY CORRECTED AND VALIDATED
STATUS: FROZEN

PREREGISTERED LIVE STUDY: NOT STARTED
EXPERIMENTAL COLLECTION: 0 OBSERVATIONS; LIVE STUDY NOT STARTED

LIVE INSTRUMENT v6.1 FROZEN - TRACE INTEGRITY VALIDATED - SEMANTIC CONTRACT
UNCHANGED FROM v6 - AGENT K AUTHORITY PRESERVED - HISTORICAL v6 EVIDENCE
UNCHANGED - PREREGISTERED LIVE STUDY NOT STARTED
```
