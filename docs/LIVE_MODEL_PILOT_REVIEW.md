# Live-Model Pilot Instrumentation Review

**Status:** LIVE INSTRUMENT V6 FROZEN; PILOT OUTPUT REMAINS NON-EXPERIMENTAL
**Review date:** 2026-09-04
**Experimental study:** NOT STARTED

## Discovered adapter defect

The first authorized localhost pilot request used
`response_format.type = "json_object"`. LM Studio returned the explicit API
error:

`'response_format.type' must be 'json_schema' or 'text'`

The response was correctly recorded as `endpoint_unavailable` and was not
converted into a model judgment. The adapter was corrected to use
`response_format.type = "text"`, while retaining strict JSON parsing of the
model message content. This changes transport compatibility only; it does not
change frozen metrics, thresholds, conditions, seeds, governance semantics, or
live-study hypotheses.

The corrected pilot was rerun with the same pinned model and configuration. The
initial failure remains represented in the artifact's `adapter_defects` field.

The rerun also showed the model's default reasoning mode could exhaust the
256-token budget before producing content. LM Studio rejected the initial
`reasoning_effort = off` spelling and reported its supported API values. The
pilot therefore pins `reasoning_effort = none`, an explicitly recorded model
configuration choice; this is adapter reproducibility configuration, not a
performance-tuning result.

## Remediation scope

The remediation pilot uses explicit synthetic evidence/context alongside each
claim: a supported cautious claim, unsupported certainty, material ambiguity,
and evidence contradiction. Expected classifications are recorded only for
review; the adapter never rewrites an unexpected judge result. Agent K inputs
remain separate from semantic evidence.

Each live trace now records request construction, dispatch, time to headers,
model completion, parsing/normalization, governance, total elapsed time,
serialized request size, optional input-token count, failure origin, and raw API
error detail. The client timeout is pinned at 300,000 ms for the local hardware
constraint. This is an explicit pilot execution configuration change, not a
performance-tuning result or a silent retry policy.

## Semantic schema compliance gate

The v4 pilot records a contract-only compliance gate. Its denominator is
limited to semantic responses received by the semantic parser; timeouts,
endpoint/API failures, and Agent-K-only cases are excluded. For every invalid
response, the artifact preserves raw output, parsed intermediate form when
available, the exact violated rule, request/response fingerprints, canonical
payload fingerprint, model fingerprint, configuration fingerprint, and adapter
metadata.

The parser remains strict. It does not reinterpret a semantically plausible
response that violates the existing structured-output contract. The invariant
is `SchemaInvalid => SemanticObservation=Unavailable`, while
`AgentK=FAIL => Governed=FAIL` remains enforced independently.

The latest pilot recorded 9 semantic responses received, 4 schema-valid
responses, and 5 structural failures, for `CCR = 4 / 9 = 0.4444`. All five
failures were classified as `available_false_incompatible_fields`; this is a
contract observation only, not a semantic-accuracy score or a basis for
loosening the parser.

## Manual review checklist

- [x] Raw response preserved before normalization.
- [x] Request and response fingerprints preserved.
- [x] Model metadata and sampling configuration preserved.
- [x] Agent K `FAIL` plus semantic judge `PASS` remained governed `FAIL`.
- [x] Malformed, refusal, empty, and unavailable fixtures remained fail-closed.
- [x] Request rejection, API compatibility, model error, and envelope parse-error fixtures are distinguished.
- [x] Evidence-grounded semantic fixtures are preserved with observed classifications.
- [x] Per-stage timing and timeout-origin instrumentation is preserved.
- [x] Pilot artifact labeled `PILOT / INSTRUMENT VALIDATION ONLY`.
- [x] Preregistered experimental dataset remains unstarted.
- [x] Manual review completed for the stored artifact.

## Manual review outcome

One live-generated trajectory completed generation, semantic evaluation,
governance, and evidence capture; its raw response, fingerprints, stage timings,
and proposed transition are reconstructable from the artifact. Four semantic
responses were schema-valid and five returned `available=false` with semantic
error detail, which violates the response contract and was preserved as
`available_false_incompatible_fields`, not reinterpreted as a semantic pass or
fail. The two hard-rule cases both remain `AgentK=FAIL` and `Governed=FAIL`.
All failure taxonomy fixtures are preserved and fail closed.

The adapter is still not frozen for this remediation increment, by explicit
scope. No claim is made about live task completion, LLM reliability, or agent
rot. The live experimental study remains unstarted.

## Semantic judge input-flow audit

The completed audit remains labeled **PILOT / INSTRUMENT VALIDATION ONLY**. The
canonical semantic payload immediately before serialization contains only the
semantic instruction, `step`, `semantic_claim`, and
`evidence_context.evidence` / `evidence_context.context`. The artifact records
the canonical-payload SHA-256 separately from the final request-body SHA-256,
the exposed field list, the serialized request, and raw model responses. No
unrelated Agent K state is included.

The matched evidence probe was directionally evidence-sensitive: the stable
evidence arm produced a schema-invalid response while the worsening-evidence
arm produced an accepted semantic result. Because one arm is a schema failure,
the artifact conservatively classifies the aggregate evidence probe as
`schema_failure`, not as a clean semantic sensitivity result.

The matched hard-rule probe is classified `hard_rule_signal_insensitive`.
`hard_rule_failure` is orchestration metadata only: it is absent from the
canonical payload and does not gate semantic dispatch. Agent K remains
authoritative in governance fusion. This is an evaluator-independence finding,
not evidence that the semantic model owns hard-rule decisions.

The unsupported-certainty fixture remains `invalid_schema` with
`observed_semantic_error: null`, preserving the distinction between a
structurally invalid model response and a valid semantic classification. The
adapter remains **NOT FROZEN**, and the preregistered live study remains
**NOT STARTED**.

This review does not score model quality or compare A/B/C/D. No pilot output is
evidence that PRAETOR improves LLM reliability, task completion, or mitigates
agent rot. Experimental observations remain `0`, and the preregistered live
study remains **NOT STARTED**.

## Evaluator-independence amendment validation

The dated amendment is recorded in
[AMENDMENT_LIVE_EVALUATOR_INDEPENDENCE_2026-09-06.md](AMENDMENT_LIVE_EVALUATOR_INDEPENDENCE_2026-09-06.md).
The corrected v4 runner writes
`data/pilot/live-horizon-pilot-v4-latest.json`; the v3 artifact remains
unchanged. v4 removes `hard_rule_failure` from the semantic payload, dispatches
the semantic judge independently in the hybrid case, and records evaluator
agreement, dispatch occurrence, semantic status, and governed disposition.

The validation run verified dispatch independence and preserved
`Agent K=FAIL` as final `FAIL`. LM Studio returned semantic-looking responses,
but five violated the strict structured-output contract by using
`available=false` with semantic detail; those observations remain unavailable
under the schema gate. The artifact therefore does not approve adapter freeze;
the live study remains unstarted.

## Semantic availability amendment validation

The v5 availability amendment is documented in
[AMENDMENT_SEMANTIC_AVAILABILITY_CONTRACT_2026-09-07.md](AMENDMENT_SEMANTIC_AVAILABILITY_CONTRACT_2026-09-07.md).
The v5 pilot remains preserved as a separate validation artifact; its first
fresh run improved availability compliance but exposed one existing
500-character `reason` limit violation in the supported control. That result
was not reinterpreted or merged into v4.

The follow-up v6 instrument explicitly states the existing reason limit and
writes `data/pilot/live-horizon-pilot-v6-latest.json`. It recorded 9 semantic
responses received, 9 schema-valid responses, and `CCR = 9 / 9 = 1.0`. The
unsupported-certainty, ambiguity, and contradiction cases were all represented
as `available=true` with `semantic_error=true`; the supported control was
`available=true` with `semantic_error=false`. The matched evidence probe was
`evidence_sensitive`.

The v6 run also preserved independent dispatch, byte-equivalent hard-rule
requests, C as Agent-K-only, D as independently dispatched, and
`AgentK=FAIL => Governed=FAIL`. Human freeze review approved the validated
instrument, so `lm-studio-semantic-judge-v6` is now frozen. This approval does
not start the preregistered live study or turn pilot output into experimental
observations.

## Post-freeze trace-integrity correction

The frozen v6 artifact contains a known trace/representation inconsistency in
the combined hybrid case: the semantic observation reports
`semantic_error=true`, while the downstream authority-oriented result reports
`semantic_error=false`. The exact mutation path and frozen evidence are
recorded in
[POST_FREEZE_TRACE_INTEGRITY_CORRECTION_2026-09-07.md](POST_FREEZE_TRACE_INTEGRITY_CORRECTION_2026-09-07.md).

The new `lm-studio-semantic-judge-v6.1` path preserves the semantic
observation separately from governance, retains provenance fingerprints, and
keeps `AgentK=FAIL => Governed=FAIL`. Its bounded synthetic validation passes
the trace-integrity gate with zero experimental observations. Human review has
approved v6.1 as frozen. The v6 artifact and freeze decision remain unchanged;
the preregistered live study remains **NOT STARTED**. The v6.1 fixture uses
`synthetic-v6.1-trace-integrity-fixture` and validates representation
integrity, semantic-observation preservation, governance separation,
provenance, and deterministic invariants only; it is not a semantic-
performance validation of Qwen.
