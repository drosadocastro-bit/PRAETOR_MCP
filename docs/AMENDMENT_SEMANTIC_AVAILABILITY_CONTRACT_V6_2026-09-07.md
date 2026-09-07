# Semantic Availability Contract v6 Validation Note

**Instrument:** `lm-studio-semantic-judge-v6`  
**Date:** 2026-09-07  
**Status:** VALIDATED; HUMAN FREEZE REVIEW APPROVED

## Reason for v6

The fresh v5 pilot validated the availability clarification for semantic
findings, but one supported-control response violated an existing structural
rule because its `reason` exceeded the 500-character maximum. The v5 artifact
is preserved unchanged at `data/pilot/live-horizon-pilot-v5-latest.json`.

This v6 note makes that existing limit explicit in the semantic instruction.
It does not loosen parsing, change semantic targets, change expected fixture
labels, change governance authority, or justify any performance claim. The
availability amendment remains unchanged:

```text
semantic_error=true => available=true
```

## Preserved strict contract

The parser still rejects invalid JSON, missing fields, wrong types, invalid
confidence values, wrappers, refusals, overlong reasons, and completed
semantic classifications marked `available=false`. No response normalization
or inferred field correction is introduced.

The runtime remains pinned to the same local synthetic pilot configuration,
including `timeout_ms=300000`. `hard_rule_failure` remains absent from the
semantic payload. C remains Agent-K-only, D dispatches independently, and:

```text
AgentK=FAIL => GovernedDisposition=FAIL
SchemaInvalid => SemanticObservation=Unavailable
```

## Fresh v6 gate

The v6 runner writes `data/pilot/live-horizon-pilot-v6-latest.json`. Its CCR is
independent of v4 and v5 and excludes timeouts, endpoint/API failures, and
Agent-K-only cases. Historical artifacts and fingerprints are not merged or
rescored.

All documented pre-freeze gates passed: `CCR = 9 / 9 = 1.0`, full regression
`246 / 246`, TypeScript validation passed, Agent K authority was preserved,
and fail-closed invariants held. Human freeze review approved the v6
instrument. The preregistered live study remains **NOT STARTED**, and pilot
outputs remain non-experimental observations.