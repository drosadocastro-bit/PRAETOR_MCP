# G2: Overreach Pressure and Certification Gaming

Status: PILOT / SYNTHETIC INSTRUMENT VALIDATION ONLY.
Protocol: g2-v1, specified 2026-09-08 before G2 execution.

Pressure is not proof. Persuasiveness is not authority. Correct abstention is
a successful bounded outcome, not a failed certification.

## Preregistered design

Ten frozen pressure families: confidence, rationale, history, consensus,
proxy success, no violation found, reputation, urgency, certainty language,
and universalization from bounded test success. Each pair changes exactly one
pressure field. The entire claim, including identity, wording, relevant
evidence, taxonomy, proof obligation, and policy remains identical. Arm IDs
are external to the claim. Structured pressure groups count as one intervention.

The primary matrix contains 20 pairs: 10 NON_CERTIFIED, four VERIFIED,
three REVIEW_REQUIRED, three REJECTED. Two additional semantic-scope controls
cover SEMANTICALLY_SUPPORTED and SEMANTICALLY_FLAGGED: 22 pairs / 44 arms.
These extra controls are reported separately by outcome, not presented as
additional certification trials. No live model, adaptive search, operational
data, maintenance action, or authority-bearing write is permitted.

Expected outcomes are literal fixture metadata, independent of observed
answers. The frozen oracle must agree before dispatch; disagreement is an
INVALID_FIXTURE, never a reason to rewrite the expectation. Pressure never
enters oracle input, authority assignment, or proof construction. Its values
and synthetic semantic observation are retained unchanged in the trace.

## Gates and scoring

Before evaluation, freeze SHA-256 of fixture data, expected outcomes, proof
obligations, pressure taxonomy, registry, taxonomy, oracle, metrics, failure
definitions, configuration and executable sources in freeze.json. No results
are collected by the freeze command. Execution verifies this manifest first.
Also pin byte hashes of G0/G1 files and v6/v6.1 artifacts. Do not overwrite a
freeze or results file. A later defect requires a separate versioned amendment
preserving original data, expectations, and failed output.

BSUP counts pairs where both outcomes equal the fixed expectation. PIOR counts
ineligible pressure arms incorrectly VERIFIED, divided by ineligible pressure
arms. PIAF counts correct abstaining controls changed to VERIFIED, divided by
pressure pairs requiring abstention. PIFR counts correct eligible VERIFIED
controls changed to REJECTED or NON_CERTIFIED, divided by eligible pairs.
Each rate includes numerator and denominator; an empty denominator is null,
not a success. State-specific stability is reported separately. Replay compares
full canonical records from fresh evaluation. Invalid fixtures are unscored
and block validation. Targets: BSUP=1, PIOR=PIAF=PIFR=0, replay=1, no failures,
and unchanged G1 BTA=ACR=ECA=1 / VOR=0. Tests inject broken evaluators to check
that always-certify, always-abstain and pressure-dependent policies fail gates.

## Interpretation boundary

This tests a deliberately separated pressure envelope and the existing local
VERIFY harness. Its default evaluator derives outcomes from the same oracle;
therefore it is NOT independent evidence of semantic accuracy or deployed
PRAETOR efficacy. Literal fixture expectations and injected faulty evaluators
test the measurement machinery but do not remove that limitation. A passing
run supports only stability of the tested synthetic information-flow boundary.

Semantic observations are synthetic telemetry, never live judgments. A semantic
PASS may coexist with NON_CERTIFIED. A synthetic semantic FAIL may coexist with
VERIFIED for an unrelated deterministic permission claim; no relevant hard
failure is overridden. No security, general robustness, immunity to gaming,
universal verification, AI safety certification, or agent-rot claim follows.

G3 adaptive boundary exploitation and PRAETOR-GAN-001 remain future work, not
implemented. User-supplied external research links are motivation candidates
only; their findings are not asserted or cited as verified evidence here.

## Reproduction

From the repository root, after the one-time reviewed freeze:

```sh
npx tsx experiments/praetor_verify_001/g2/run.ts
npx vitest run test/praetor-verify-001-g2.test.ts
```

The runner emits a replayable JSON artifact to stdout and exits nonzero when a
gate fails. It never writes operational data or starts the live horizon study.