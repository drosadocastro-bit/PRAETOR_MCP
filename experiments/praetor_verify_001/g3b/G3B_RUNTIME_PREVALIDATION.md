# PRAETOR-VERIFY-001 G3B Runtime Pre-Validation

**Status:** `FAIL`

**Scope:** Technical pre-validation only. The G3B holdout was not accessed,
evaluated, scored, sampled, or summarized.

## Frozen References

- Design freeze: `a12c4ab`
- Preliminary review: `88193f4`
- Eligibility clarification: `995add0`
- Pre-validation runner: `g3b-runtime-prevalidation-v1`

## Gate Results

| Gate | Status | Result |
| --- | --- | --- |
| 1. Executable runner | `PASS` | One permitted `instrument_validation` fixture executed through the pre-validation harness. |
| 2. Provenance contract | `PASS` | Required observation identity, input/configuration hashes, artifact identity, runtime metadata, stopping outcome, and review state were emitted. |
| 3. Replay precheck | `PASS` | Deterministic fixture output matched across declared exact-match fields. |
| 4. Oracle/feedback isolation | `INCONCLUSIVE` | Structural protected-field checks passed, but no comparative runtime isolation test exists. |
| 5. Baseline parity | `INCONCLUSIVE` | Declared parity can be compared, but observed parity across a G3B runtime is not enforceable yet. |
| 6. Executable stopping rules | `INCONCLUSIVE` | Frozen stopping rules were enumerated, but trigger execution and enforcement by a comparative runner are not implemented. |

## Aggregate Decision

Because not all required gates passed:

```text
runtime_prevalidation = FAIL
eligibility = NOT_ELIGIBLE_FOR_HUMAN_EXECUTION_DECISION
human_authorization = false
holdout_evaluated = false
execution_performed = false
comparative_observations = 0
holdout_access_status = NOT_ACCESSED
```

Technical pre-validation does not authorize G3B execution. The next decision
must remain with the designated human reviewer after all required runtime gates
are implemented and independently validated.

## Unresolved Limitations

- No executable comparative G3B runtime exists yet.
- Oracle/feedback isolation is not tested against an actual arm execution.
- Baseline parity is declared but not measured across runtime trajectories.
- Stopping rules are not enforced by a comparative runner.
- The validation runner must be committed before its commit SHA can be used as
  complete provenance for a future pre-validation packet.

## Reproduction

Run the non-holdout pre-validation with:

```sh
npm run prevalidate:g3b
```

The command writes `G3B_RUNTIME_PREVALIDATION.json` beside this report. It
must not be used to execute, score, inspect, sample, or summarize the G3B
holdout.

## Safety Confirmation

No G3B holdout outcome was accessed. No comparative observation was generated.
No arm was ranked. No frozen hypothesis or G3B finding was modified. Human
authorization remains false.
