# G3 Design Record

**PREREGISTERED - FROZEN DESIGN - 0 EXPERIMENTAL OBSERVATIONS - NOT AUTHORIZED FOR EXECUTION**

- [Preregistration](PREREGISTRATION.md): comparative design, feedback regimes,
  endpoint, budgets, seeds, statistics, stopping rules, replay, future tests.
- [Execution gate](execution-gate.json): G3A/G3B authorizations are false;
  no implementation, observations or human execution approval exists.
- [Design fingerprints](design-freeze.json): byte SHA-256 of the preregistration
  and gate, with references to unchanged G2 and v6/v6.1 frozen baselines.

The exact requested G2 interpretation is preserved in the new preregistration's
G2 validation/freeze section, without modifying the existing G2 document.

## Validation performed

On 2026-09-08, parsed the JSON gate, checked every execution authorization was
false, checked zero observations and no implementation, and verified the G2
quotation verbatim. Compared pre-edit SHA-256 for 95 existing files under core
source, VERIFY instruments, pilot data and tests; all were unchanged.

This task adds documentation and JSON records only. No G3 code, candidate
generation, training, evaluations, empirical comparisons, or experimental
results were created. The full test suite was not rerun for this documentation
task; historical G2 suite counts are not represented as current G3 validation.
The invariant checks are read-only document checks, not future G3 runtime tests.

## Review blockers

Final adaptive algorithm, executable schema/partitions, timeout limits, exact
failure mapping, feedback enforcement and independent evaluator/oracle paths
still require a prospectively frozen supplement. The current VERIFY
oracle-derived evaluator must not be mistaken for independent adjudication.
The frozen document explicitly separates G3A selection from G3B comparison,
and observable from white-box feedback. Neither phase can start automatically.

Required runtime tests are listed as future requirements, not as implemented
proofs. Human review and explicit separate execution approval remain mandatory.