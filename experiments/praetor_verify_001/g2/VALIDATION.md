# G2 v1 Validation Record

Date: 2026-09-08.
Status: G2 VALIDATED / PILOT / SYNTHETIC INSTRUMENT VALIDATION ONLY.
Human technical review remains required before advancing the research phase.

## Sequence and evidence

The protocol and literal fixture expectations were defined before execution.
TypeScript compilation preceded freeze generation. The persisted [freeze
manifest](freeze.json) was verified by the first focused test execution and
by the runner. No expectations, metrics, executable sources, or frozen inputs
were amended after G2 execution began. No G0/G1 implementation or fixture,
core source, historical findings, or frozen v6/v6.1 artifact was edited.

Execution commands from the repository root:

```sh
npx vitest run test/praetor-verify-001-g2.test.ts
npx tsx experiments/praetor_verify_001/g2/run.ts
npm run check
npm test
```

G2 tests: 21/21 PASS. Complete suite: 295/295 PASS across 31 files.
Repository TypeScript check and separate compilation of the G2 runner passed.
The freeze verifies protected files by byte SHA-256, not Git diff status.

## Observed bounded metrics

| Metric | Numerator / denominator | Rate |
| --- | --- | --- |
| BSUP | 22 / 22 | 1.0 |
| PIOR | 0 / 18 | 0 |
| PIAF | 0 / 13 | 0 |
| PIFR | 0 / 4 | 0 |
| Full record replay | 22 / 22 | 1.0 |

There were 22 matched pairs, 44 arms, and zero invalid fixtures. The primary
20-pair matrix contained 10 NON_CERTIFIED, four VERIFIED, three REVIEW_REQUIRED,
and three REJECTED controls. Two additional semantic-only pairs retained
SEMANTICALLY_SUPPORTED and SEMANTICALLY_FLAGGED, respectively. Each of the six
outcome groups had state-specific stability 1.0.

The G0 replay and VOR=0 were preserved. G1 retained BTA=ACR=ECA=1.0, VOR=0,
and consistent replay. The historical `274/274 PASS` pressure string remains
fixed synthetic metadata about the earlier baseline, not a current suite count
and never proof of universal safety.

Measurement tests injected proxy-induced certification, always-certify,
always-abstain, urgency-induced rejection, wrong-verifier routing, and loss of
human escalation. These negative controls failed the acceptance gate as
intended. Invalid fixture changes were excluded before evaluator dispatch.
They are measurement self-tests, not observed failures of the default evaluator.

## Reconstruction

The stdout JSON contains every input arm, pressure signature, independent
semantic observation, governance outcome, information-flow trace, failure
fingerprint, baseline metrics, and freeze manifest. No wall-clock timestamp or
random value enters replay. The canonical SHA-256 of the artifact payload,
excluding its own `artifact_fingerprint` field, was:

`7a9fef4ec398d027e8247ff44b9a0013c351b7664b5270faa42671ebeeae8b13`

Re-running the command with the frozen definitions reconstructs the artifact.
The runner emits JSON to stdout only; this record is a summary, not a stored
copy of the full result artifact. It exits nonzero on failed gates or freeze
mismatch. Frozen v6 SHA-256:

`e173ce23633c8a4ac4836b2f66617bdabff3867a73602dd66369ec071b92d066`

Frozen v6.1 SHA-256:

`37ae78b1e6ace2334319be27f3859c15a046ca9ebc243c78bc0d97ed2286dd42`

## Interpretation

Under these preregistered synthetic fixtures, the tested irrelevant pressure
signals did not change certification dispositions while claim-specific
authority and proof inputs remained unchanged. This is evidence about the
implemented pressure-envelope isolation, not independent semantic or production
verification performance: the existing VERIFY evaluator derives its default
answer from its oracle, and G2 intentionally excludes pressure from that path.
It does not test whether a live model can be persuaded or an adaptive adversary
can discover other inputs. No immunity, security, robustness, universal safety,
or verifier-gaming prevention claim is supported.

Live horizon study: NOT STARTED. Experimental observations: 0. All observations
above are synthetic instrument-validation cases. G3 and PRAETOR-GAN-001 remain
future work and were not implemented.