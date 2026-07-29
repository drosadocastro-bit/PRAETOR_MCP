# PRAETOR-MCP Implementation Adversarial Findings

## Scope

This document consolidates the adversarial findings for the major implementation areas completed so far. It is a navigation and publication summary; the linked tier documents and tests remain the detailed evidence.

PRAETOR-MCP remains local, synthetic, offline-first, advisory-only, and human-reviewed. These findings do not establish production readiness, predictive accuracy, operational authority, or complete host containment.

## Contained Boundaries

| Implementation area | Result | Evidence |
| --- | --- | --- |
| Protocol 66 hard and bounded soft-trigger classification | CONTAINED | [docs/PROTOCOL_66.md](PROTOCOL_66.md), [test/protocol66.test.ts](../test/protocol66.test.ts) |
| Stale contract and session identity mismatch | CONTAINED | [docs/ADVERSARIAL_TIER1_FINDINGS.md](ADVERSARIAL_TIER1_FINDINGS.md), [test/host-adversarial-tier1.test.ts](../test/host-adversarial-tier1.test.ts) |
| Quarantine blocking new tool work and normal output | CONTAINED | [docs/AGENT_K_QUARANTINE_MODE.md](AGENT_K_QUARANTINE_MODE.md), [test/quarantine-mode.test.ts](../test/quarantine-mode.test.ts) |
| Evidence origin, provenance, contradiction, and circular-evidence checks | CONTAINED | [docs/PRAETOR_MCP_EVIDENCE_BOUNDARY.md](PRAETOR_MCP_EVIDENCE_BOUNDARY.md), [test/evidence-gate.test.ts](../test/evidence-gate.test.ts), [test/adversarial-battery.test.ts](../test/adversarial-battery.test.ts) |
| Adapter output validation and authority separation | CONTAINED | [docs/PRAETOR_MCP_V0_5_VALIDATION.md](PRAETOR_MCP_V0_5_VALIDATION.md), [test/adapter-boundary.test.ts](../test/adapter-boundary.test.ts) |
| ReviewAgent raw-client separation and runtime routing | CONTAINED | [docs/REVIEW_AGENT.md](REVIEW_AGENT.md), [test/review-agent-runtime-boundary.test.ts](../test/review-agent-runtime-boundary.test.ts) |
| Real local MCP stdio integration | CONTAINED FOR DEMO | [test/mcp-smoke.test.ts](../test/mcp-smoke.test.ts), [test/review-agent-stdio.test.ts](../test/review-agent-stdio.test.ts) |
| Open-data adapter payload contract before HTTP implementation | CONTAINED OFFLINE | [docs/OPEN_DATA_API_ADVERSARIAL_FINDINGS.md](OPEN_DATA_API_ADVERSARIAL_FINDINGS.md), [test/open-data-adapter-adversarial.test.ts](../test/open-data-adapter-adversarial.test.ts) |

## Confirmed Limitations

| Boundary | Result | Evidence |
| --- | --- | --- |
| Direct low-level `ToolGateway` bypass | LIMITATION CONFIRMED | The gateway alone does not enforce pre-action inspection; host routing through `AgentKRuntime` is required. |
| In-flight result after quarantine | LIMITATION CONFIRMED | An admitted callback can resolve after quarantine without a late-result output gate or cancellation token. |
| Session replacement and resume | LIMITATION CONFIRMED | A new in-memory session with the same ID does not recover prior state, events, or work. |
| Cross-process and durable concurrency | NOT CLAIMED | Current state and traces are in-memory or local append-only files, without a durable task protocol or cross-process lock. |
| External API transport security | NOT IMPLEMENTED | SSRF, redirects, DNS rebinding, timeouts, rate limits, TLS, credentials, retries, and remote schema drift require an HTTP-specific suite before an adapter is enabled. |
| Semantic assurance of lexical detectors | NOT CLAIMED | Adversarial tests establish observable containment cases, not complete semantic detection. |

## Current Validation Snapshot

The latest local validation after adding the pre-adapter open-data contract was:

- Full suite: 179/179 tests passed;
- 21 test files passed;
- TypeScript check passed;
- `git diff --check` passed;
- generated integration artifacts removed.

The full suite is evidence for the fixed synthetic test fixtures only. It is not evidence that PRAETOR can safely connect to live systems or external providers.

## Publication Rule

Future implementation work should preserve this pattern:

1. define the hostile boundary and acceptance tests;
2. implement the smallest local adapter or runtime change;
3. rerun focused and full validation;
4. document contained cases and confirmed limitations;
5. keep unsupported capabilities unavailable rather than silently falling back.
