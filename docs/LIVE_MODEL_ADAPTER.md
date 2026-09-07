# Live-Model Adapter Boundary

**Status:** Opt-in instrumentation only; experimental execution disabled

The adapter in `src/research/liveModelEvaluation.ts` supports two local,
read-only operations:

- semantic judge responses for ambiguity and semantic consistency;
- model-generated trajectory steps with raw-output and request/response
  fingerprints.

The default configuration has `enabled: false`. The pilot command
`npm run pilot:live-horizon` therefore contacts no endpoint unless both
`PRAETOR_LM_STUDIO_ENABLED=true` and an explicit localhost endpoint are set.
Non-local endpoints are rejected.

All enabled outputs are strict-schema checked. Malformed JSON, missing fields,
model refusal, timeout, unavailable endpoint, and authority-bearing output fail
closed. The adapter does not retry, fabricate a response, create evidence or
provenance, grant approval, or alter Agent K decisions. Hard Agent K failures
remain non-overridable.

The adapter records raw model output where available, response and request
fingerprints, model identity, adapter version, prompt fingerprint, sampling
parameters, serialized request size, optional input-token count, total elapsed
time, per-stage timing, failure origin, API error detail, status, and
authority-override attempts. Secrets and unrelated local content must not be
placed in prompts or traces. A client-side timeout is distinct from an API,
model, parser, or transport failure.

The semantic judge evaluates claim-evidence compatibility: unsupported
certainty, ambiguity, contradiction, qualification mismatch, and related
semantic inconsistency. It does not determine factual authority, authorization,
policy compliance, hard state validity, deterministic preconditions, or evidence
provenance. Agent K remains authoritative for those decisions.

The live failure taxonomy distinguishes `endpoint_unavailable`,
`request_rejected`, `api_compatibility_error`, `timeout`, `model_refusal`,
`malformed_json`, `missing_fields`, `invalid_schema`, `model_error`,
`parse_error`, and `judge_disagreement`. Historical pilot artifacts are not
rewritten when a later taxonomy becomes more precise.

The v3 semantic input-flow audit verified that the canonical payload reaches the
request serialization boundary with evidence and context intact and with no
unrelated Agent K fields. It also found that `hard_rule_failure` is present in
that payload but causes a deterministic pre-dispatch short-circuit when true.
The matched probe is therefore recorded as `hard_rule_signal_sensitive`, and
an amendment is required before adapter freeze. This is an instrument
validation finding, not a semantic override or a change to governance.

The current LM Studio pilot requests `reasoning_effort=none`. The selected
model metadata reports `off/on`; this discrepancy is recorded as a warning and
does not trigger silent substitution. A future reasoning-mode change requires
an explicit configuration version and new fingerprints.

The live study is preregistered in
[LIVE_MODEL_HORIZON_PREREGISTRATION.md](LIVE_MODEL_HORIZON_PREREGISTRATION.md).
The pilot is for connectivity, parsing, trace persistence, and fail-closed
instrument validation only. Pilot output is not an experimental result and
cannot tune frozen metrics or thresholds.

Synthetic evidence remains frozen and separate in
[HORIZON_AWARE_SYNTHETIC_FREEZE.md](HORIZON_AWARE_SYNTHETIC_FREEZE.md) and
[HORIZON_AWARE_SYNTHETIC_RESULTS.md](HORIZON_AWARE_SYNTHETIC_RESULTS.md).

## Evaluator-independence amendment

The dated v4 amendment is recorded in
[AMENDMENT_LIVE_EVALUATOR_INDEPENDENCE_2026-09-06.md](AMENDMENT_LIVE_EVALUATOR_INDEPENDENCE_2026-09-06.md).
In v4, `hard_rule_failure` is orchestration metadata only, is absent from the
semantic payload, and no longer gates semantic dispatch. Hybrid telemetry
records both evaluator observations and the fail-closed governed disposition.
The v4 pilot is written to a separate versioned artifact and remains
historical. The v6 instrument later validated the amended availability
contract with `CCR = 9 / 9 = 1.0`, preserved independent semantic dispatch,
and received explicit human freeze approval. The frozen instrument is
`lm-studio-semantic-judge-v6`; freezing does not start the preregistered live
study or convert pilot output into experimental observations.

The post-freeze correction record
[POST_FREEZE_TRACE_INTEGRITY_CORRECTION_2026-09-07.md](POST_FREEZE_TRACE_INTEGRITY_CORRECTION_2026-09-07.md)
documents a known v6 downstream representation defect. The versioned v6.1
candidate separates the accepted semantic observation from governance and
preserves provenance without changing the v6 prompt or parser contract. It
requires human review before any live-study use.
