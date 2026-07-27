# PRAETOR-MCP AI Technical Debt and Follow-up Security Audit

Audit date: 2026-07-27
Version under review: v0.5 integrity-boundary remediation
Disposition: **HOLD for production consideration**

This follow-up re-checks every finding from the original v0.4 audit. A finding is marked **CLOSED** only when implementation and regression evidence demonstrate the stated property. **DEFERRED BY DESIGN** is distinct from an open defect: it describes a capability intentionally not implemented in the current synthetic prototype, with its future boundary documented.

## Executive Disposition

- Local synthetic demo path: **acceptable for continued local testing** within the offline, synthetic-only, advisory-only, human-reviewed boundary.
- SEC-001 malformed Protocol 66 input, SEC-003 packet bounds, SEC-004 storage integrity, SEC-005 adapter output validation, and SEC-007 application error boundary: **CLOSED to tested scope**.
- SEC-002 stateful Protocol 66 identity/ingestion: **DEFERRED BY DESIGN, NOT A GAP**; the classifier remains pure and the future boundary is documented.
- SEC-006 external integration/provenance: **OPEN / NO-GO**. The misleading fallback is closed, but no external adapter or adapter-owned provenance architecture exists.
- SEC-008 exported storage path containment and SEC-009 legacy helper bypass: **OPEN**.
- Production readiness: **NO-GO** because calibration, semantic validation, provenance architecture, authentication, and operational controls remain unresolved.

## Original Finding Status

| Finding | Status | Follow-up evidence |
| --- | --- | --- |
| SEC-001 malformed Protocol 66 timestamps and thresholds | **CLOSED** | Runtime validation; 27 Protocol 66 tests |
| SEC-002 missing Protocol 66 session/event identity | **DEFERRED BY DESIGN, NOT A GAP** | Pure classifier; future ingestion design note |
| SEC-003 unbounded packet fields | **CLOSED for current schema** | Explicit limits; schema-bound tests |
| SEC-004 storage errors swallowed and records unvalidated | **CLOSED for read and append paths** | Typed errors; record schema; storage tests |
| SEC-005 adapter output types unvalidated | **CLOSED for implemented methods** | Strict adapter schemas; malicious adapter tests |
| SEC-006 external fallback and synthetic provenance coupling | **PARTIALLY CLOSED / OPEN RISK** | Fallback removed; provenance remains synthetic-only |
| SEC-007 missing MCP error boundary | **CLOSED for application boundary** | Stable envelopes; adapter fault tests; stdio smoke |
| SEC-008 unconstrained exported storage paths | **OPEN** | No current MCP path input, but API remains unconstrained |
| SEC-009 legacy helper bypass | **OPEN** | Compatibility helpers still read static synthetic data |

## 1. Original Findings Re-checked

### SEC-001: Protocol 66 accepted malformed timestamps and policies - CLOSED

**Why this was a real risk:** This was an input-integrity bug, not a best-practice gap. Before the fix, invalid timestamps could become timestamp `0`; interaction-index logic could then count malformed events. A negative threshold could make an empty event set satisfy escalation. Attacker-controlled or corrupted telemetry could therefore alter a containment decision.

**Before evidence:** Three malformed timestamp events with indexes `1`, `2`, and `3` could return `PROTOCOL_66`; `softThreshold: -1` could escalate an empty event set.

**Fix:** `src/protocol66.ts` validates event shape, trigger kind, strict ISO timestamp format, finite parsing, safe non-negative interaction indexes, detail type, and bounded positive policy values before filtering or counting.

**After evidence:** The same malformed timestamp and policy fixtures throw `Protocol66InputError`. The Protocol 66 suite passes **27/27** tests.

### SEC-002: Protocol 66 has no session or event-stream identity - DEFERRED BY DESIGN, NOT A GAP

**Why this matters if state is added:** A stateful caller without session, stream, event identity, deduplication, ordering, and retention semantics could combine events across conversations or retain triggers indefinitely. That would be a correctness and isolation failure.

**Current evidence:** `classifyProtocol66` is pure, receives one validated event array, and has no mutable shared event state. Current invocations cannot race through a shared event store or leak events between sessions.

**Decision:** Stateful ingestion is intentionally deferred rather than silently omitted. [docs/PRAETOR_MCP_PROTOCOL66_INGESTION_DESIGN.md](docs/PRAETOR_MCP_PROTOCOL66_INGESTION_DESIGN.md) specifies session IDs, stream IDs, event IDs, monotonic indexes, deduplication, bounded retention, timestamp/order semantics, concurrency, and recovery requirements. This is not an open defect in the current pure classifier, but it is a prerequisite before stateful ingestion is implemented.

### SEC-003: Schema resource bounds were incomplete - CLOSED for current schema

**Why this was a real risk:** Strict objects prevent unknown keys but do not stop valid oversized arrays or strings. A caller could consume memory, CPU, serialized response space, or append-file capacity with structurally valid packets, impairing availability and auditability.

**Before evidence:** `uncertainty`, `source_ids`, `guardrail_results`, `advisory_only_statement`, evidence `uncertainty_notes`, guardrail `affected_fields`, and multiple nested identifiers/text fields had no explicit maximum.

**Fix:** `src/schema.ts` now bounds packet identifiers, text, source IDs, uncertainty notes, evidence collections, guardrail collections, affected-field collections, dependency source IDs, and nested evidence strings.

**After evidence:** [test/schema-bounds.test.ts](test/schema-bounds.test.ts) rejects over-limit uncertainty, source IDs, guardrail results, advisory text, nested evidence notes, and guardrail field lists. The test file passes **5/5** tests.

### SEC-004: Stored NDJSON errors were swallowed and records were unvalidated - CLOSED for read and append paths

**Why this was a real risk:** Returning empty history on permission failure, corruption, or partial write makes unavailable audit history indistinguishable from no history. Casting decoded JSON without validation lets tampered or malformed records enter review, weakening reconstructability.

**Before evidence:** `readAdvisoryPackets` caught all errors and returned `[]`; decoded lines were cast to `AdvisoryPacketRecord`; append failures were not classified.

**Fix:** `src/storage.ts` returns empty history only for `ENOENT`, validates every decoded record with `AdvisoryPacketRecordSchema`, raises `StorageError` for malformed JSON, partial writes, invalid records, and read failures, and wraps mkdir/append failures as `storage_error`.

**After evidence:** [test/storage.test.ts](test/storage.test.ts) covers missing files, malformed JSON, truncated lines, invalid records, read failures, and append failures. It passes **6/6** tests, and corruption is never converted into false empty history.

### SEC-005: Adapter output types were weak and unvalidated - CLOSED for implemented methods

**Why this was a real risk:** An adapter is an untrusted extension boundary. Malformed or oversized records, evidence, excerpts, metadata, or fake authority fields could otherwise be serialized into MCP responses or consumed by governance as valid evidence.

**Before evidence:** Read-side methods exposed `unknown[]` or `unknown | null` results and handlers serialized returned values without runtime validation.

**Fix:** `DatasetAdapter` uses concrete result types. `src/adapters/adapterValidation.ts` applies strict bounded schemas to every implemented result family before serialization or governance. Adapter verdict/guardrail fields are rejected as unknown fields.

**After evidence:** Malicious adapter tests cover malformed records, oversized arrays, invalid source metadata, fake authority fields, thrown exceptions, bounded history, and adapter-independent governance/Protocol 66 behavior. The adapter boundary file passes **14/14** tests.

### SEC-006: External mode fell back to synthetic data and provenance ownership was synthetic-only - PARTIALLY CLOSED / OPEN RISK

**Why this was a real risk:** A caller selecting `external` could believe an external source was active while receiving synthetic data. That is a configuration-integrity and provenance risk. A future adapter that self-supplied provenance or verdicts could also undermine independent governance.

**Before evidence:** `external` existed in the mode union and unknown values fell back to the synthetic adapter. Provenance validation was tied to the static synthetic source registry.

**Fix implemented:** `src/adapters/adapterRegistry.ts` raises `unavailable_adapter` for `external` and unknown values. README and architecture documentation state that no external adapter is implemented.

**After evidence:** Registry tests verify explicit unavailable behavior; no live or external integration was added. The fallback sub-finding is closed.

**Still open:** Provenance ownership remains coupled to synthetic data, and no adapter-owned authoritative source identity exists. External mode remains **NO-GO** until provenance architecture, independent validation, and security review are implemented. This is not marked fully resolved.

### SEC-007: MCP application error boundary was missing - CLOSED for covered application paths

**Why this was a real risk:** Unnormalized adapter, storage, or governance exceptions can leak implementation details, make rejection indistinguishable from infrastructure failure, and complicate audit/retry behavior. SDK behavior alone was not a repository-level contract.

**Before evidence:** Tool handlers had no stable application error code/detail envelope, and adapter/storage exception behavior was not tested over the real transport.

**Fix:** `src/errors.ts` defines stable error codes and `safeTool` converts application failures to `{ error: { code, detail } }`. Unexpected errors are logged to stderr only. Adapter, storage, governance, Protocol 66, unavailable-adapter, and internal failures are separated.

**After evidence:** Direct handler tests verify `schema_rejected`; malicious adapter tests verify `adapter_error` without stack/path leakage; [test/mcp-smoke.test.ts](test/mcp-smoke.test.ts) verifies a real stdio `governance_rejected` envelope. Invalid tool arguments rejected before handler execution remain an SDK-level safe protocol error.

### SEC-008: Exported storage paths are unconstrained - OPEN

**Why this is a real risk:** The current MCP tools do not accept a path, but exported `advisoryStorePath` and `appendAdvisoryPacket` accept arbitrary paths. A future integration forwarding user-controlled data could read or write outside the intended project data directory through traversal, absolute paths, symlinks, or unexpected extensions.

**Current evidence:** No current MCP path-traversal route was found, but the exported API has no containment policy.

**Required fix:** Keep path selection internal or enforce an allowlisted root and reject traversal, absolute paths, symlinks, and unexpected extensions before filesystem access. This remains open and is not counted as v0.5 closed.

### SEC-009: Legacy synchronous helpers bypass the adapter boundary - OPEN

**Why this is a real risk:** Two read paths can disagree: MCP tools use the active adapter, while exported synchronous helpers read `src/data.ts` directly. A future integration could bypass adapter provenance, isolation, or validation assumptions.

**Current evidence:** Compatibility helper exports remain in `src/tools.ts` and directly use static synthetic data. No adapter parity contract exists.

**Required fix:** Mark them synthetic-only in a compatibility module, route callers through an adapter-aware service, or remove them after migration. This remains open.

## 2. Remaining Original Audit Debt

### OPEN: Synthetic-only provenance coupling

Governance still resolves provenance against the synthetic source registry. This is acceptable for the local fixture path but blocks a credible external adapter. Rejecting external mode does not resolve provenance ownership.

### OPEN: Lexical guardrails are not semantic validation

Mission drift, generated-output, speculation, temporal precision, evaluator manipulation, and grounding checks use deterministic lexical patterns and token overlap. The fixed adversarial battery does not establish semantic coverage, false-negative rates, or robustness across domains. Human review remains mandatory.

### OPEN: Calibration debt

Protocol thresholds, confidence caps, support scores, and independence scores are deterministic policy knobs, not calibrated probabilities. Representative data and human review are required before production consideration.

### OPEN: Authentication and production controls

No production authentication, authorization, live integration, operational write path, or production security model exists. The prototype must remain local, synthetic, review-only, and offline-first.

## 3. Intentional Prototype Choices

These are not silently resolved security findings, but intentional choices that require review before broader use:

- asynchronous adapter methods with synchronous synthetic compatibility helpers;
- lexical guardrails rather than semantic models;
- dependency-graph provenance rather than complete lineage objects;
- NDJSON append storage rather than transactional storage;
- pure Protocol 66 classification rather than stateful ingestion.

## 4. Follow-up Validation

Executed on 2026-07-27 after the final audit fixes:

```text
npm run check
npm test -- --run
npx vitest run test/protocol66.test.ts --reporter=dot
npx vitest run test/mcp-smoke.test.ts --reporter=dot
npm run test:adversarial:report
npm audit
git diff --check
```

Results:

- TypeScript check: **PASS**.
- Full Vitest suite: **10 test files, 112 tests passed**.
- Protocol 66: **27/27 tests passed**.
- MCP stdio smoke: **1/1 test passed**.
- Adversarial battery: **25/25 assertions passed**.
- Dependency audit: **0 vulnerabilities**.
- Whitespace check: **PASS**; only the generated-report LF-to-CRLF normalization warning was emitted.

The prior complete suite was 9 files and 106 tests. The increase is accounted for by the 5 schema-bound tests and one additional storage append-integrity test.

## Final Disposition

The original malformed-input, packet-bound, storage-handling, adapter-output, external-fallback, and application-error-boundary findings are implemented and regression-tested to the stated scope. External adapter/provenance architecture, exported path containment, legacy helper bypass, semantic guardrail reliability, calibration, authentication, and production controls remain open or unavailable. Protocol 66 stateful ingestion is **deferred by design, not a gap**, and must satisfy its design note before implementation.

PRAETOR-MCP remains **local synthetic prototype only; advisory-only; human-reviewed; no operational authority**.
