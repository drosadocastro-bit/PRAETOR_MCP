# PRAETOR-MCP Future Multi-Agent Phase

## Role-Separated Bounded Agents for Hackathon Demonstration

> **Status: FUTURE PHASE ONLY. DO NOT IMPLEMENT YET.**

This document records a future design reference. It is not an implementation
plan authorized for the current phase, and it does not change frozen G0/G1/G2/
G3A/G3B findings, observations, locks, receipts, or execution gates.

## Priority Order

The current priority remains:

1. Complete G3B runtime validation and execution gating.
2. Complete PRAETOR-GAN-001 experimental work.
3. Revisit this bounded multi-agent phase for hackathon integration.

No multi-agent runtime, orchestration path, swarm behavior, or new operational
capability should be added before those priorities and their human review gates
are complete.

## Goal

Add a minimal multi-agent architecture suitable for an MCP Server and AI Agent
Government Hackathon demonstration without turning PRAETOR into an autonomous
swarm.

The design uses:

- specialized roles;
- bounded authority;
- deterministic governance;
- explicit service-health states;
- graceful degradation;
- human-review boundaries.

Agents may observe, retrieve, classify, and propose. Agents must not
independently authorize operational actions.

## Proposed Agents

### Agent A: COMS Specialist Agent

**Purpose:** Monitor the health and degradation state of MCP-accessible services
and supporting interfaces.

**Responsibilities:**

- observe service availability;
- observe latency and timeouts;
- detect degraded dependencies;
- classify service-health state;
- report affected capabilities;
- recommend bounded degraded operation.

**Explicit prohibitions:**

- restart services;
- modify infrastructure;
- change permissions;
- authorize maintenance;
- widen tool access;
- alter governance policy;
- self-certify recovery.

### Agent B: Data Access Agent

**Purpose:** Retrieve approved synthetic maintenance evidence through
PRAETOR-MCP.

**Responsibilities:**

- search maintenance records;
- retrieve equipment history;
- retrieve source metadata;
- retrieve supporting evidence;
- assemble evidence packets;
- preserve provenance;
- represent unavailable data explicitly.

**Explicit prohibitions:**

- invent evidence;
- convert inference into provenance;
- authorize maintenance;
- bypass unavailable services;
- directly modify operational systems.

## Conceptual Architecture

```text
                    AI Host / Orchestrator
                           |
              +------------+------------+
              |                         |
              v                         v
      COMS Specialist Agent       Data Access Agent
              |                         |
              v                         v
       Service health state        PRAETOR-MCP
              |                         |
              |                  Synthetic Dataset
              |                         |
              +------------+------------+
                           |
                           v
                 Deterministic Governance
                    PRAETOR / Agent K
                           |
                           v
                       Human Review
```

Role separation is the primary control. The orchestrator may coordinate
bounded observations and retrieval, but it must not grant an agent authority
that the underlying MCP server and governance layer do not provide.

## Required Boundaries

- All data remains synthetic and local.
- All agents remain advisory and human-reviewed.
- Service health is an explicit state, not an implicit fallback.
- Unavailable, stale, contradictory, or incomplete evidence is represented as
  unavailable or uncertain.
- No agent may silently substitute another service or source.
- Deterministic governance remains authoritative for packet validation.
- Agent K remains a host-side containment and integrity concept, not a claim
  that direct MCP access enforces host quarantine.
- No path may authorize maintenance, determine equipment safety, create a work
  order, modify infrastructure, or connect to live government systems.
- Research agents and demonstrations must remain separate from submission-time
  governance and from frozen experiment findings.

## Future Validation Gates

Before any implementation or demonstration decision, the design would require
an explicit human-reviewed contract covering at least:

- role-specific tool allowlists;
- service-health and graceful-degradation states;
- provenance and unavailable-evidence semantics;
- authority and handoff boundaries;
- deterministic governance integration;
- audit and reconstructability requirements;
- adversarial tests for role confusion, authority escalation, false recovery,
  provenance fabrication, circular evidence, and silent fallback;
- replay and failure-injection checks;
- confirmation that no G3B state or finding was modified retroactively.

Until those gates are satisfied, this document is reference material only and
must not be treated as evidence of multi-agent support.
