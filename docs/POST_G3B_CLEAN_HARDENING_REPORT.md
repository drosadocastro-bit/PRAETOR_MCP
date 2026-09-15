# PRAETOR — Post-G3B Clean Hardening Report

Date: 2026-09-15

## Decision and lineage

The implementation starts from clean `cb131103bf20959fe2a30e173052d4407b524019`
(`cb13110`) on `codex/post-g3b-durability-shadow`. The resulting hardening is
currently uncommitted in this worktree; no push or merge was performed by this
task.

The corrected baseline decision is:

- `HISTORICAL_G2_FREEZE_VALID_ON_CB13110`
- canonical historical `src` tree hash:
  `850312ba9f944e13c9bb01161e4bf10ce4d70bf421534f6429b92da2fe5db419`
- `verifyFreeze()` on clean `cb13110`: `PASS`
- auxiliary digest `5d77d2ef...` is recorded only as
  `AUXILIARY_NONCANONICAL_DIGEST` and is not used for freeze decisions
- application baseline artifact:
  `POST_G3B_APPLICATION_RUNTIME_BASELINE_V1.json`
- baseline artifact SHA-256: `ff9ef097b2d80ea72e03d43c1737af44d4616e91bf0709498aadcad48e4ecce2`
- active working-tree `src` tree hash: `83fbc4d10e77c2b1dcc1c44bb300d8712792b6988a319a16ea422f41233c6c9e`

The baseline explicitly separates historical verification from current runtime
evolution. `verify:historical` validates the preserved G2 files and reconstructs
the canonical `src` bytes from the pinned Git commit. `verify:runtime-baseline`
tracks the active source tree. Current source changes are classified as
`INTENTIONAL_APPLICATION_EVOLUTION`, not as G2 failure.

## Files modified or added

`.gitattributes`, `.env.example`, `.dockerignore`, `Dockerfile`,
`docker-compose.yml`, `package.json`, `package-lock.json`, `tsconfig.build.json`,
`vitest.runtime.config.ts`, `POST_G3B_APPLICATION_RUNTIME_BASELINE_V1.json`,
`scripts/verify-baselines.ts`, `src/http-index.ts`, `src/httpServer.ts`,
`src/toolSchemas.ts`, `src/adapters/adapterRegistry.ts`,
`src/adapters/adapterValidation.ts`, `src/errors.ts`, `src/schema.ts`,
`src/storage.ts`, `src/tools.ts`, `src/types.ts`, `test/http-server.test.ts`,
`test/historical-baseline-verification.test.ts`, and hardening assertions in
`test/adapter-boundary.test.ts`, `test/mcp-smoke.test.ts`,
`test/storage.test.ts`, and `test/tools.test.ts`; plus `README.md`,
`QUICKSTART.md`, `docs/HTTP_TRANSPORT.md`, this report, and
`.github/workflows/ci.yml`.

## Implemented hardening

- All 11 existing MCP tools retain their public names and now expose bounded,
  strict input schemas, explicit output schemas, descriptions, annotations, and
  structured MCP output alongside compatibility text output.
- Unknown fields and malformed bounds fail deterministically through the MCP
  schema boundary.
- Missing equipment, source, excerpt, or anomaly identifiers return explicit
  `not_found` errors. Missing anomaly context cannot collect unrelated evidence.
- Adapter responses are validated before serialization. External or unknown
  adapter selections fail explicitly; they never fall back to synthetic data.
- Advisory records are schema-validated before append and after read. Dependency
  graph metadata and the authoritative capped confidence survive round-trip
  persistence.
- HTTP is opt-in and separate from stdio. It provides bounded body size,
  concurrency, timeout, Host and Origin validation, health checks, graceful
  shutdown, constant-time application-key comparison, and read-only-by-default
  behavior. `X-Praetor-Key` remains separate from platform `Authorization`.
- A compiled Node entrypoint, environment validation, multi-stage non-root
  Dockerfile, restricted Compose scaffold, and environment template were added.
- CI validates Linux and Windows on Node 22 and 24, including typecheck, build,
  runtime tests, historical/runtime baseline checks, durability, hybrid shadow,
  dependency audit, whitespace safety, and a Linux container smoke job.

## Deliberately not ported

The previous hardening patch was not applied wholesale. No live or Databricks
adapter, NEXRAD/manual integration, public deployment, platform resource,
cloud credential, distributed persistence, tamper-evident audit store, or
automatic HTTP write mode was introduced. No `evaluate_hybrid` tool was added.
The post-G3B evidence store remains separate from application packet storage.

## Dependencies and validation

Validated dependency versions after `npm ci`:

- `@modelcontextprotocol/server`: `2.0.0`
- `@modelcontextprotocol/client`: `2.0.0`
- `typescript`: `5.9.3`
- `zod`: `4.4.3`
- `tsx`: `4.23.1`
- `vitest`: `5.0.1`
- `@types/node`: `22.20.1`

Results:

| Check | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm run check` | PASS |
| `npm run build` | PASS |
| Runtime test suite | 55 files, 497 passed, 0 skipped |
| MCP tool surface | 11 tools, unchanged |
| stdio MCP smoke | PASS |
| HTTP smoke | PASS, 6 tests |
| Compiled HTTP entrypoint health/auth/shutdown | PASS |
| Post-G3B durability | PASS, 6 tests |
| Hybrid shadow | PASS, 6 tests |
| `npm audit --audit-level=moderate` | PASS, 0 vulnerabilities |
| `git diff --check` | PASS |
| Docker engine runtime | `DOCKER_RUNTIME_NOT_VERIFIED` |

The repository contains two preserved research suites that recalculate the
pre-G3B live `src` tree (`praetor-verify-001-g2` and `praetor-g3a-pilot`). They
remain unchanged and are intentionally outside the current-runtime Vitest
config. This is explicit, not silent: `test:historical` runs the independent
archive/baseline verifier, and `historical-baseline-verification.test.ts`
asserts both boundaries. No historical expected hash was rewritten.

## Research and authority invariants

- Historical G2: `UNCHANGED` and independently verified `PASS` on `cb13110`.
- G3B: `UNCHANGED — BLOCKED / INCONCLUSIVE`.
- Hybrid evaluator: `OFFLINE / SHADOW / NON-AUTHORITATIVE / NON-MCP-EXPOSED`.
- Post-G3B durability store: preserved as research infrastructure and not
  coupled to runtime persistence.
- Authority effect: `NO AUTHORITY EXPANSION`.
- Claim boundary: no production-readiness, predictive-accuracy, live-service,
  maintenance-authority, or deployment claim is created.

Docker scaffolding is present, but the local Docker engine was unavailable, so
the image, health check, authentication, and shutdown path are not reported as
locally runtime-verified. CI contains the executable container checks.
