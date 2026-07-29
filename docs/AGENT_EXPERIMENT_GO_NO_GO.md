# Agent Experiment GO / NO-GO Decision

Date: 2026-07-28

## Decision

| Experiment | Decision | Scope |
| --- | --- | --- |
| Bounded `ReviewAgent` | GO | Continue the local synthetic hackathon demonstration and contract validation. |
| Evidence Comparison Agent | NO-GO | Do not implement the second agent until the gates below are satisfied. |
| Multi-agent coordination or swarm | NO-GO | Outside the current experiment and support claim. |

## GO: ReviewAgent

The first agent is approved for continued experimentation within its existing contract:

- retrieve synthetic anomaly context;
- evaluate the evidence boundary;
- build a bounded review-only advisory packet;
- submit only through deterministic governance;
- stop on runtime denial or evidence-boundary refusal;
- preserve human review as the final authority.

The agent has no raw MCP client, operational tool access, maintenance authority, work-order path, equipment safety authority, or autonomous recovery path. Its contained runtime boundary is documented in [docs/REVIEW_AGENT.md](REVIEW_AGENT.md) and exercised by [test/review-agent-runtime-boundary.test.ts](../test/review-agent-runtime-boundary.test.ts).

## NO-GO: Evidence Comparison Agent

The next proposed agent remains blocked from implementation until it has its own contract and acceptance tests. The proposed role is read-only comparison of already-retrieved evidence, not retrieval authority or decision authority.

It must not:

- call arbitrary MCP tools or own a raw MCP client;
- submit advisory packets or write to a service;
- declare equipment safe or unsafe;
- authorize maintenance or create work orders;
- treat another agent's output as independent evidence;
- convert prompt text, model inference, or generated summaries into source evidence;
- produce a normal result after runtime denial or quarantine.

## Entry Gates for the Second Agent

Implementation may change from NO-GO to GO only after all gates pass:

1. **Role contract:** purpose, inputs, outputs, forbidden claims, allowed tools, and refusal behavior are written before implementation.
2. **Runtime contract:** the agent receives only a runtime-bound invoker or typed read-only interface; raw MCP, gateway, storage, and arbitrary callback access are structurally unavailable.
3. **Evidence contract:** source IDs, provenance, timestamps, uncertainty, independence groups, and evidence origin remain attached; agent output is explicitly non-authoritative.
4. **Adversarial tests:** tests cover authority laundering, cross-agent prompt injection, circular or duplicated evidence, contradictory records, weak provenance, quarantine, denial, and no alternate response paths.
5. **Handoff contract:** ReviewAgent and governance accept the comparison result only as an untrusted draft or analysis input, never as independent corroboration.
6. **Failure and lifecycle scope:** cancellation, late results, session identity, and unsupported resume behavior are either tested or explicitly excluded from the claim.
7. **Validation evidence:** focused tests, full suite, strict TypeScript validation, diff validation, and findings documentation pass before integration.

Any failed gate keeps the experiment at NO-GO. The response is to narrow the design or document the limitation, not to bypass the gate.

## Hackathon Alignment

The current `ReviewAgent` already supports the intended demonstration path:

```text
Dataset Access Server
  -> Service Read Integration
  -> bounded ReviewAgent
  -> Service Write Integration
  -> deterministic governance
  -> human review
```

The hackathon does not require a swarm or multiple agents. A single contract-bound agent can demonstrate dataset access, service reads, and review-only service writes while making the safety boundary visible.

## Reassessment Trigger

Reassess this decision only after the ReviewAgent evidence remains green and the second-agent contract, tests, and implementation plan are available for review. A future public API adapter is a separate gate and must satisfy [docs/OPEN_DATA_API_ADVERSARIAL_FINDINGS.md](OPEN_DATA_API_ADVERSARIAL_FINDINGS.md) before external access is enabled.
