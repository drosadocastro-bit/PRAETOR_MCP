# Nova Labs Research and Implementation TODO

## Research posture

PRAETOR-MCP is the primary active research track for the hackathon. The objective is not to prove that PRAETOR is reliable. The objective is to measure observable behavior under controlled perturbations and bound every claim to the conditions actually tested.

> PRAETOR does not self-certify its reliability. Reliability claims must be derived from observable behavior under controlled perturbations and remain bounded by the tested conditions.

Nova Labs Research exists to discover what works, what fails, under what conditions, and at what cost. A result that favors the minimal-governance baseline is a valid and valuable result.

## GSA hackathon alignment

Verified against the GSA event page on 2026-09-06; the page itself reports a
last-updated date of 2026-09-03:

- event format: virtual;
- event window: September-November 2026;
- eligibility: government employees with a `.gov` or `.mil` email address across federal, state, local, territorial, or tribal government;
- tracks: Dataset Access Server, Service Read Integration, and Service Write Integration in a sandbox;
- support: MCP training, vendor sessions, office hours, and mentorship across an approximately six-week development window;
- submission package: GitHub repository, presentation slide deck, and evaluation documentation;
- judging dimensions: technical quality, innovation, mission alignment, and presentation;
- evaluation expectations: testing methodology, performance metrics, security considerations, lessons learned, and recommendations;
- current published milestones: MCP 101 on September 23; vendor sessions September 29, October 1, 6, and 8; GSA kickoff October 13; MCP 201 October 29; halfway check-in November 3;
- completion, final presentation, and awards dates: still subject to publication;
- registration: required; space is limited.

Source: [GSA MCP Server and AI Agent Government Hackathon](https://www.gsa.gov/artificial-intelligence/ai-community-of-practice/events-and-training/mcp-server-and-ai-agent-government-hackathon).

PRAETOR's current claim is intentionally narrower than a live government integration: a local Dataset Access and review-only evidence-governance prototype using synthetic data. The pitch should present that limitation as a deliberate safety boundary, not imply live agency access or operational service delivery.

The registration includes all three GSA capability areas, but the current
validated implementation is the Dataset Access Server only. Future Service Read
and Service Write adapters should be developed as independent modules. Their
failure states must be isolated: a read-service outage must not disable dataset
access, dataset access must not silently substitute for a read service, and a
write adapter must deny submission when its own governance or sandbox
dependency is unavailable. These future paths require separate contracts,
provenance checks, security review, and adversarial validation.

The GSA page also emphasizes readable, maintainable code, precise agent-facing tools, structured validation, graceful error handling, and stable behavior across test cases. These requirements make the reliability harness and the 90-second Retrieve -> Challenge -> Bound demo directly relevant to judging.

## Priority order

| Priority | Workstream | Current posture | Immediate output |
| --- | --- | --- | --- |
| 0 | Hackathon demonstration | GO / frozen claim | Rehearsable Retrieve -> Challenge -> Bound flow |
| 1 | Reliability harness | Phase 2 complete | Tool-failure, permission/runtime-denial, memory/context poisoning, malformed-handoff, and resource-pressure testing complete |
| 2 | Handoff boundary | Kernel exists; integration gated | Typed untrusted handoff contract and adversarial tests |
| 3 | State-write boundary | Design target | Deny-by-default write policy and failure tests |
| 4 | Information-class separation | Partially implemented | Explicit evidence, inference, observation, policy, and human-decision types |
| 5 | Protocol 66 handoff signals | Investigation | Classification-only containment experiment |
| 6 | MCP 2.0 compatibility | Shadow/isolated branch | Compatibility observations, not migration approval |
| 7 | Dataset adapter selection | HOLD / roadmap only | Current Dataset Access claim; future Service Read/Write adapters remain unimplemented |
| 8 | Hybrid evaluation adoption | Post-study design; runtime deferred | Horizon-aware fake-judge contracts first; local LM Studio only as explicit non-authoritative shadow evaluation |
| 9 | PRAETOR-GAN-001 learned adversarial boundary exploration | FUTURE / NOT IMPLEMENTED | Isolated structured-state generator study; independent deterministic oracle; synthetic cases only; no core runtime changes |

### Future hybrid evaluation introduction

The separately verified hybrid-evaluation worktree is documented in
[HYBRID_EVALUATION_ADOPTION_NOTE.md](HYBRID_EVALUATION_ADOPTION_NOTE.md). It is
research input, not an approved runtime migration. Do not merge it wholesale or
add a second authoritative MCP tool while the behavioral reliability study is
unfinished.

After the study, introduce the reusable signal, lineage, hard-boundary fusion,
and ablation concepts as a read-only offline shadow layer. Keep
`evaluateAdvisoryPacket` authoritative, inject fake judges explicitly, preserve
unavailable real-judge results, and compare disagreements, failures, latency,
and overhead before considering advisory-only MCP exposure.

## 0. Hackathon demonstration first

Before expanding the agent surface, make the existing demo repeatable and legible:

1. **Retrieve:** fetch `EX-401-A` and show source ID, provenance, uncertainty, and independence group.
2. **Challenge:** review `PRA-403` with elevated and normal synthetic observations plus a favorable caller-supplied claim.
3. **Bound:** show deterministic governance rejecting or constraining the packet, the audit reason, and the required human review.

The demo must remain local, synthetic, advisory-only, and review-only. It must not add live data, HTTP, a second authoritative call, shadow writes, autonomous recovery, equipment safety status, maintenance authorization, or work-order behavior.

**Success condition:** an industry reviewer can understand the evidence, the uncertainty, the containment decision, and the human boundary within 90 seconds.

## 1. Reliability harness

### Experiment design

Create a controlled comparison between:

```text
Minimal-Governance Baseline  VS  Full PRAETOR-MCP
```

Hold the following constant wherever possible:

- model and model settings;
- MCP environment and tool availability;
- synthetic evidence set;
- task and prompt intent;
- run budget and timeout policy;
- output schema and scoring procedure.

The baseline must be documented precisely. It should remove or minimize PRAETOR governance controls without changing the underlying task, rather than becoming a weaker or intentionally defective system.

### Perturbation matrix

Measure both systems under:

- repeated identical runs;
- semantically equivalent paraphrases;
- missing evidence;
- reordered evidence;
- contradictory evidence;
- duplicate and circular evidence;
- corrupted or incomplete provenance;
- tool failures and malformed tool results;
- permission changes and runtime denials;
- attempted human-review bypass;
- memory or context poisoning;
- malformed agent handoffs;
- resource pressure, latency, and governance overhead.

### Minimum measurements

For every condition, record:

- run ID, configuration, seed, and timestamp;
- input perturbation and evidence lineage;
- output classification and boundedness;
- refusal, quarantine, or acceptance decision;
- false-accept and false-reject counts where an oracle exists;
- run-to-run variance;
- latency and resource overhead;
- audit and reconstructability status;
- unexplained or ambiguous outcomes.

Do not collapse these into one unsupported reliability score. Report per-condition results, confidence intervals or sample counts where appropriate, and known test gaps.

### Acceptance gate

The harness is ready for a research claim only when:

- baseline and PRAETOR behavior are directly comparable;
- perturbations are reproducible;
- expected outcomes are specified before execution;
- failures are retained rather than hidden by retries or fallback;
- a PRAETOR regression is reported even when the baseline performs better;
- the resulting report states exactly what was not tested.

## 2. Cross-agent contamination boundary

Every agent handoff is an untrusted boundary. An upstream agent cannot confer trust merely by generating, summarizing, or repeating information.

The proposed `HandoffBoundaryContract` should include:

```text
source_agent_id
destination_agent_id
source_type
provenance
evidence_ids
validation_status
allowed_use_scope
confidence_cap
contradiction_status
contamination_status
human_review_required
```

The contract must also preserve session identity, trace identity, source lineage, uncertainty, and whether each item is retrieved evidence, model inference, system observation, policy output, or human decision.

### Required rules

- Handoff output is non-authoritative by default.
- A handoff cannot change tool permissions, runtime contracts, governance policy, or audit behavior.
- A handoff cannot be counted as independent corroboration without independent source lineage.
- Consensus is not independent evidence when agents inherit the same source or contaminated context.
- Invalid, contaminated, over-cap, or contradictory handoffs are rejected, quarantined, or sent for human review.
- No downstream agent receives an alternate path after a boundary denial.

The existing comparison kernel and metadata-only handoff are the approved starting point. A second runtime agent remains gated by [AGENT_EXPERIMENT_GO_NO_GO.md](AGENT_EXPERIMENT_GO_NO_GO.md).

## 3. Cross-agent contamination test battery

Use this propagation model:

```text
Injected Retrieval
       |
    Agent A
       |
Potentially Contaminated Handoff
       |
Deterministic Boundary Validation
      / \
 ACCEPT  QUARANTINE
              |
        No Propagation
```

Test at minimum:

- malicious instructions embedded in retrieved content;
- upstream attempts to write injected content into shared state;
- injection hidden inside an apparently benign summary;
- fabricated, missing, or mismatched provenance;
- model inference represented as retrieved evidence;
- handoffs that attempt to modify tool permissions;
- attempts to disable logging or governance;
- multiple agents repeating one poisoned source to create false consensus;
- contaminated long-term memory resurfacing later;
- malformed child state attempting to contaminate parent state;
- late, duplicated, cross-session, or cross-trace handoffs;
- quarantine and denial behavior with no alternate response path.

Each test should state the expected boundary result before execution and retain the exact rejected artifact for audit.

## 4. Deny-by-default state writes

Agent output must not automatically become trusted state.

```text
Agent Output
     |
Schema Validation
     |
Provenance Validation
     |
Authority Check
     |
Contamination Check
     |
Policy Evaluation
     |
Approved State Write
```

Failure at any required boundary results in rejection, quarantine, or human review. There must be no silent state mutation, implicit retry, or fallback write path.

For PRAETOR, this applies especially to advisory packets, audit records, comparison handoffs, memory, permissions, and any future adapter cache. A review-only packet may be persisted locally only after deterministic governance accepts it; persistence does not authorize operational action.

## 5. Separate information classes

Formalize and preserve these classes:

```text
RETRIEVED_EVIDENCE
MODEL_INFERENCE
SYSTEM_OBSERVATION
POLICY_DECISION
HUMAN_DECISION
```

At every boundary, consumers should be able to determine which class they are receiving and what use is allowed. In particular:

```text
MODEL_INFERENCE != RETRIEVED_EVIDENCE
```

Generated repetition must never transform inference into evidence. A policy decision must not be presented as a source observation, and a human decision must not be inferred from a packet merely because a packet was stored.

## 6. Protocol 66 and handoffs

Investigate whether Protocol 66 should classify cross-agent propagation attempts, including:

- authority escalation;
- guardrail override;
- audit modification;
- permission escalation;
- provenance fabrication;
- quarantine bypass;
- contaminated-state propagation.

The governing principle remains:

> Protocol 66 contains. It does not acquire authority.

This work must remain classification-only until a contract and tests prove otherwise. Containment must not become an autonomous decision path, permission escalator, or hidden recovery mechanism.

## 7. MCP 2.0 compatibility

The current local stdio path remains authoritative. The compatibility boundary documented in [MCP_SPEC_SHADOW_MODE.md](MCP_SPEC_SHADOW_MODE.md) remains in force.

Shadow experimentation must remain:

- read-only;
- non-authoritative;
- incapable of issuing a second authoritative call;
- incapable of shadow writes;
- incapable of automatic fallback;
- observational only.

A result-shape match does not establish semantic equivalence, safety, or production readiness. SDK compatibility evidence is not migration approval.

Future HTTP, stateless transport, MRTR, Tasks, authorization, or routing experiments require independent scope, acceptance criteria, failure handling, and review. They must not alter the authoritative stdio path until separately approved.

## 8. Dataset adapter decision: HOLD

Do not select an upstream source before hackathon guidance.

```text
SyntheticDatasetAdapter  -\
                            > Evidence Contract -> PRAETOR
PublicDataAdapter        -/
ApprovedSandboxAdapter   -/
```

After training and judging requirements are known:

- use synthetic data if permitted and appropriate;
- use approved public/open data only if integration adds meaningful research value;
- use an official sandbox if one is provided;
- avoid live operational dependencies merely to make the demo appear more sophisticated.

An adapter supplies data, never governance authority. Any future adapter requires explicit selection, bounded requests and responses, provenance preservation, privacy and licensing review, failure handling, and a dedicated adversarial test pass. There must be no silent fallback between adapters.

## Definition of done for this research track

A workstream is complete only when its implementation, tests, documentation, and limitations are all present:

- contract and scope written before expansion;
- happy-path and adversarial tests are pytest/Vitest discoverable;
- denial, quarantine, malformed input, and contamination cases are covered;
- no new authority path, silent fallback, or hidden retry is introduced;
- focused validation and the full suite pass;
- generated artifacts are removed before publication;
- findings and residual risk are documented;
- the claim is bounded to the tested conditions.

## Explicitly out of scope for the hackathon

- multi-agent swarm or autonomous coordination;
- production reliability certification;
- live FAA, agency, or internal data;
- operational maintenance decisions or work orders;
- public HTTP deployment;
- automatic migration to a newer MCP transport;
- autonomous recovery after denial or quarantine.

These may become future research questions, but they are not demo capabilities or implied support claims.
