# Bounded Review Agent

The first PRAETOR agent is a deterministic host-side review-packet builder. It is not an autonomous maintenance agent and does not make operational decisions.

Implementation: [src/agent/reviewAgent.ts](../src/agent/reviewAgent.ts)

## Flow

```text
retrieve_anomaly_context
  -> evaluate_evidence_boundary
  -> build bounded advisory packet
  -> submit_review_advisory_packet
  -> human review
```

Every MCP call is routed through `AgentKRuntime`, which applies the deliberation contract, Protocol 66 state, pre-action inspection, and tool gateway. The agent uses an injected `PraetorToolClient`, so a real MCP stdio client can be supplied by the host while tests remain local and deterministic.

The agent is deliberately restricted to:

- synthetic anomaly-context retrieval;
- evidence-boundary validation;
- review-only packet construction;
- governance-backed packet submission;
- human review as the final authority.

It does not call operational tools, authorize maintenance, create work orders, declare equipment safe or unsafe, or treat its generated text as primary evidence. A refusal from the evidence boundary prevents submission.

## Host Boundary

The host should provide a client connected to the local PRAETOR stdio server and construct a `ReviewAgent` with a unique session ID. The agent should not be given direct access to `ToolGateway`, adapter internals, storage, or arbitrary MCP tool names.

The current implementation is intentionally a workflow agent rather than a model loop. A future model may propose the request or draft wording, but the typed request, evidence origin, governance result, and human-review boundary must remain authoritative.

## Current Scope

This first agent does not implement durable task handles, disconnect/resume, cancellation of in-flight callbacks, multi-agent messaging, shared memory, or swarm consensus. Those are separate experiments and remain outside the current support claim.
