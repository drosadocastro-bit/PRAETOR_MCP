# PRAETOR-MCP GSA Presentation Deck

**Working deck outline**  
**Claim freeze:** September 6, 2026  
**Current track:** Dataset Access Server

This outline is the presentation artifact for the GSA MCP hackathon. It is
intentionally concise so it can be transferred to slides without expanding the
technical claim.

## Slide 1: PRAETOR-MCP

**Evidence before authority**

A local synthetic MCP Dataset Access Server that helps an AI organize
maintenance evidence while preserving uncertainty and human review.

- Local and offline-first
- Synthetic data only
- Advisory-only
- Deterministic governance

## Slide 2: The problem

A fluent agent can make incomplete or circular evidence sound authoritative.
The missing layer is not another prediction. It is a traceable boundary between
retrieved evidence, an advisory draft, and a human decision.

## Slide 3: The MCP workflow

```text
Synthetic records -> Dataset Access tools -> Evidence assembly
                 -> Deterministic governance -> Review-only packet
                 -> Human review
```

The server exposes structured retrieval and validation tools. It does not create
work orders, authorize maintenance, determine equipment safety, or connect to
live systems.

## Slide 4: Retrieve

The agent retrieves one fixed synthetic case and its supporting evidence.

Show:

- source IDs and timestamps;
- provenance metadata;
- uncertainty notes;
- independence groups; and
- the difference between a recurring pattern and a confirmed cause.

## Slide 5: Challenge

Submit an advisory packet containing a caller-supplied favorable verdict or a
controlled evidence defect.

Examples:

- missing provenance;
- contradictory evidence;
- circular or falsely independent evidence; or
- unsupported certainty.

The caller's verdict is untrusted input, not authority.

## Slide 6: Bound

Deterministic governance recomputes the result and exposes:

- affected fields;
- confidence limits;
- the integrity verdict;
- recommended reviewer action; and
- the stable rejection or constraint reason.

The output remains advisory and requires human review.

## Slide 7: Evidence of function

The repository contains executable evidence for:

- TypeScript checks;
- unit and integration tests;
- real MCP stdio transport;
- Protocol 66 containment tests;
- adapter boundary tests; and
- the append-only adversarial battery.

The evaluation document reports the exact run results and remaining risks.

## Slide 8: Scope and roadmap

**Current:** governed, read-only Dataset Access using synthetic data.

**Future:** independent Service Read and sandbox-only Service Write adapters.

Each future capability has its own contract, provenance rules, health state,
governance checks, security review, and adversarial validation. An outage must
remain explicit; no adapter silently substitutes for another.

## Slide 9: Closing boundary

PRAETOR does not decide what happened or what maintenance must occur.

It helps an AI organize evidence, show uncertainty, and stop advisory language
from outrunning the evidence. A qualified human remains responsible for
interpretation and action.

## Speaker constraints

Do not claim:

- live government data or service integration;
- predictive accuracy or calibrated confidence;
- production readiness;
- equipment safety status;
- maintenance authorization; or
- operational writes.

The demo should use only the frozen local synthetic workflow in
[PRAETOR_MCP_DEMO_WORKFLOW.md](PRAETOR_MCP_DEMO_WORKFLOW.md).
