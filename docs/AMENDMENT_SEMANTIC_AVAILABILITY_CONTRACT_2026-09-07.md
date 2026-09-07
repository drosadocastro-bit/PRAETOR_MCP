# Semantic Availability Contract Amendment

**Version:** semantic-availability-contract-v5  
**Instrument:** lm-studio-semantic-judge-v5  
**Date:** 2026-09-07  
**Status:** PRE-FREEZE VALIDATION ONLY

## Purpose

This amendment clarifies the meaning of evaluator availability after repeated
evidence that the `available` field was being used ambiguously. It does not
change the semantic task, target labels, expected fixture outcomes, governance
authority, decision thresholds, or success metrics. It is not performance
tuning and is not justified by a desire to increase CCR.

## Existing ambiguity

The v4 pilot produced complete-looking semantic classifications such as:

```json
{
  "available": false,
  "semantic_error": true,
  "confidence": 0.95,
  "reason": "The claim contradicts the supplied evidence."
}
```

The v4 parser correctly rejected these responses because a valid semantic
observation required `available=true`. All five such v4 responses remain
`invalid_schema` with `available_false_incompatible_fields`. They are historical
evidence and are not rescored under this amendment.

## Clarified field semantics

`available=true` means that the semantic evaluator successfully produced a
valid semantic observation.

`available=false` means that no valid semantic observation is available because
evaluation could not be completed, parsed, or represented according to the
required contract.

`semantic_error=true` means that a semantic defect was detected within a valid
semantic observation. Therefore, every schema-valid semantic result satisfies:

```text
semantic_error=true => available=true
```

Both supported and defective semantic observations use `available=true`:

```json
{
  "available": true,
  "semantic_error": false,
  "confidence": 0.95,
  "reason": "The claim is supported by the supplied evidence."
}
```

```json
{
  "available": true,
  "semantic_error": true,
  "confidence": 0.95,
  "reason": "The claim contradicts the supplied evidence."
}
```

The repository's existing unavailable representation remains internal and
fail-closed: unavailable results are represented as `available=false`,
`semantic_error=false`, with an allowed unavailable reason. A provider response
that combines `available=false` with completed-evaluation fields remains
invalid; the parser does not normalize or infer intended values.

## Prompt and instrument versioning

The amended semantic instruction explicitly defines these meanings and is
versioned as `lm-studio-semantic-judge-v5`. Its prompt and canonical payload
fingerprints are newly generated. The pinned runtime configuration remains:

```text
model=qwen/qwen3.5-9b
quantization=Q4_K_M
temperature=0
top_p=1
top_k=40
seed=0
max_output_tokens=256
reasoning_effort=none
timeout_ms=300000
```

## Preserved boundaries

- The parser remains strict for invalid JSON, missing fields, wrong types, invalid confidence, wrappers, refusals, and incompatible `available=false` responses.
- Semantic evaluation remains a function of claim, evidence, and context only.
- `hard_rule_failure` remains orchestration metadata and is absent from the semantic payload.
- `AgentK=FAIL => GovernedDisposition=FAIL` remains authoritative.
- `SchemaInvalid => SemanticObservation=Unavailable` remains enforced.
- C remains Agent-K-only; D retains independent semantic dispatch.
- v3 and v4 artifacts, fingerprints, classifications, and prior amendments remain unchanged.
- The preregistered live study remains **NOT STARTED**.

## Fresh validation gate

The v5 pilot writes `data/pilot/live-horizon-pilot-v5-latest.json` and has an
independent CCR. Historical v4 observations are excluded from its denominator.
CCR counts only schema-valid semantic responses divided by semantic responses
received by the parser; timeouts, endpoint failures, and Agent-K-only cases
are excluded.

Improved CCR alone does not approve a freeze. Human review must confirm that
semantic-error cases are schema-valid `available=true`, supported cases remain
valid, the evidence pair is interpretable, information-flow and governance
invariants hold, raw responses and fingerprints are preserved, and all tests
and frozen-study checks pass.

Until those gates pass:

```text
ADAPTER NOT FROZEN - CONTRACT AMENDMENT VALIDATION INCOMPLETE
```