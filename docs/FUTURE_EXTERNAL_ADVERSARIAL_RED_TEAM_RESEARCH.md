# TODO - PRAETOR External Adversarial Red-Team Research

## Status

**FUTURE RESEARCH ONLY**

- Do not implement in the current PRAETOR hackathon baseline.
- Do not modify G3B behavior, claims, architecture, or evaluation results.
- Begin only after the G3B baseline is frozen.
- Conduct work in a separate research branch.
- Findings may inform future PRAETOR research and Nova Aegis.
- A successful experiment does not certify PRAETOR as safe.

## Research Objective

Evaluate PRAETOR using adversarial techniques and independent human testers
who did not participate in designing the tested mechanisms.

The goal is not to prove PRAETOR secure. The goal is to discover
counterexamples to claimed behavioral, authority, provenance, integrity, and
containment properties.

Primary research question:

> Can an independent adversary cause PRAETOR to violate a claimed authority,
> provenance, integrity, or containment boundary using malformed protocol
> interactions or sequences of individually valid MCP operations?

Secondary question:

> Which failures affect availability or robustness only, and which failures
> invalidate a governance or authority claim?

## Experimental Principle

PRAETOR must not self-certify. Passing this campaign means only:

> No counterexample was discovered under the tested conditions.

It must not be interpreted as:

> PRAETOR is secure.

All claims remain bounded by the tested environment, threat model, attack
surface, tester access, and experimental conditions.

## Phase 0 - Freeze Experimental Target

Before external testing:

- freeze the G3B baseline;
- record commit SHA and relevant artifact hashes;
- record runtime, environment, MCP SDK, and configuration versions;
- record enabled tools and resources;
- record known limitations;
- freeze the claims being challenged.

No implementation changes are permitted during an active campaign. Any
failure must be preserved before remediation.

## Campaign A - MCP Protocol and Robustness Testing

Determine whether malformed or hostile protocol behavior can cause crashes,
state corruption, leakage, inconsistent recovery, or unexpected execution.

Candidate techniques include:

- MCP Inspector manual testing;
- malformed JSON-RPC messages;
- argument schema violations and unexpected data types;
- missing fields, excessive nesting, and oversized payloads;
- repeated requests and duplicate request identifiers;
- invalid lifecycle ordering;
- abrupt stdio interruption and truncated messages;
- connection termination during an operation;
- rapid restart or reconnect;
- resource exhaustion and concurrency stress;
- simultaneous tool calls and race-condition testing;
- replayed requests;
- malformed tool or resource identifiers;
- boundary-value testing;
- independent fuzzing where appropriate.

Crashes alone must not be classified as governance failures.

## Campaign B - Governance and Authority Red Team

Find valid or partially valid interaction sequences that cause PRAETOR to
perform an action or grant authority outside its documented boundaries, even
when the system remains operational.

Potential attack classes include:

- authority escalation and review bypass;
- provenance substitution or missing provenance acceptance;
- duplicate lineage and contradictory-evidence manipulation;
- stale evidence reuse and replay across sessions;
- ordering, state-transition, and cross-request contamination attacks;
- cross-session contamination;
- valid-call composition attacks;
- partial workflow interruption and recovery-state manipulation;
- tool-output reuse;
- forged or misleading evidence relationships;
- attempts to convert probabilistic confidence into authority;
- attempts to bypass deterministic gates using legitimate MCP operations.

Testers should be encouraged to invent attack strategies not present in
PRAETOR's existing fixtures.

## External Human Red-Team Design

Prefer independent testers who did not design PRAETOR, have not seen existing
attack fixtures, understand MCP, APIs, security, distributed systems, or AI
systems, and have no conflict with the active hackathon submission. Before
sharing non-public implementation details, verify that participation does not
create a competitive conflict.

### Stage 1 - Black Box

Provide executable/server access, minimal interaction instructions, and the
claims being challenged. Do not provide implementation internals, existing
attack fixtures, known vulnerabilities, or expected attack paths.

Instruction:

> These are the properties PRAETOR claims to enforce. Find a counterexample.

### Stage 2 - Gray Box

If useful, provide selected contracts, schemas, state-machine information,
threat-model assumptions, and authority semantics. Repeat adversarial testing.

### Stage 3 - White Box

Optional future stage. Allow source review only when justified by the research
question and competition or IP constraints.

## Failure Taxonomy

Classify findings separately; multiple classifications may apply:

- `ROBUSTNESS_FAILURE`: unexpected behavior without demonstrated integrity or
  authority violation;
- `AVAILABILITY_FAILURE`: crash, hang, resource exhaustion, deadlock, or
  unrecoverable interruption;
- `INTEGRITY_FAILURE`: unauthorized or unexplained modification or corruption
  of protected state;
- `PROVENANCE_VIOLATION`: evidence lineage or provenance can be bypassed,
  forged, substituted, or incorrectly accepted;
- `AUTHORITY_VIOLATION`: authority is granted or exercised outside documented
  boundaries;
- `CONTAINMENT_FAILURE`: an expected stop or constraint fails;
- `INCONCLUSIVE`: behavior cannot yet be reliably reproduced or attributed.

## Counterexample Preservation Rule

When a potentially meaningful failure is discovered, stop and do not
immediately patch it. Capture:

- frozen commit SHA and environment;
- exact input sequence and request ordering;
- timing where relevant;
- outputs, logs, receipts, and state before and after;
- expected and observed behavior;
- tester notes and reproducibility status;
- a stable finding identifier, such as `PRAETOR-EXT-FAIL-001`.

Only after preservation and independent reproduction may remediation begin.

## Reproduction

Each meaningful finding should be tested for:

1. exact replay;
2. clean-environment replay;
3. repeated reproduction;
4. a minimal reproducing sequence where feasible.

Distinguish deterministic, timing-sensitive, probabilistic, and unreproduced
observations.

## Remediation Discipline

A patch does not erase the original finding. Preserve the chain:

```text
BEFORE -> counterexample -> evidence -> root-cause analysis
AFTER  -> remediation -> regression test -> adversarial replay -> limitations
```

Never rewrite historical evidence to make the patched system appear as though
the vulnerability never existed.

## Research Outcomes

Each research thread concludes with `GO`, `NO-GO`, or `INCONCLUSIVE`:

- `GO` supports continued investigation or possible future integration; it does
  not mean production-ready or secure;
- `NO-GO` indicates the mechanism should not currently advance;
- `INCONCLUSIVE` means available evidence supports neither decision.

All outcomes are valuable research results.

## Relationship to G3B

The frozen G3B hackathon baseline remains unchanged. External research findings
may be referenced separately when appropriate, but must not retroactively modify
frozen evaluation claims. Future experimental branches must remain clearly
separated from the submission baseline.

## Relationship to Nova Aegis

Nova Aegis should inherit evidence, not assumptions. Future Aegis mechanisms
may draw from independently discovered failures, validated mitigations,
reproducible adversarial evidence, GO/NO-GO findings, and documented
limitations. PRAETOR remains the experimental environment, and Nova Aegis must
not inherit a mechanism merely because it exists in PRAETOR.

## Core Research Principle

> Do not ask whether PRAETOR survived the test.
>
> Ask what the test failed to falsify, under which conditions, and what remains
> unknown.
