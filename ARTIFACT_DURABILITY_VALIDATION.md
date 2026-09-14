# Artifact Durability Validation

**Classification:** RESEARCH PROTOTYPE
**Validation state:** PASS
**Validation date:** 2026-09-14

The synthetic recovery exercise is implemented in
`test/evidence-store/local-evidence-store.test.ts` and passed all six cases.

| Case | Result |
|---|---|
| Store an authority fixture, delete its working copy, recover by SHA-256, and verify exact bytes | PASS |
| Verify a hash whose bytes were never stored | PASS — `RECOVERY_REQUIRED`, fail closed |
| Offer semantically similar JSON with different byte ordering | PASS — distinct identity, no substitution |
| Remove a Tier 3 replica while Tier 2 remains readable | PASS — retrieval remains exact, availability gate fails |
| Corrupt Tier 2 while Tier 3 retains exact bytes | PASS — corrupt copy rejected, exact replica retrieved, gate fails |
| Claim an occupied logical role and then explicitly supersede it | PASS — ambiguity rejected, explicit supersession accepted |

Manifest verification passed byte identity, replica completeness, graph
completeness, logical-role uniqueness, and per-artifact availability gates. The
manifest body contains no self-hash; its SHA-256 is carried by the external
envelope and content-addressed filename.

## Repository validation

- `npm run test:durability`: 1 file, 6 tests passed;
- `npm run test:hybrid-shadow`: 1 file, 6 tests passed;
- `npm test -- --run`: 55 files, 510 tests passed;
- `npm run check`: passed;
- `git diff --check` and staged-diff whitespace validation: passed;
- MCP smoke test: passed with the existing 11-tool surface;
- historical G2/G3/G3B byte-freeze tests: passed after checkout-stable line
  ending attributes were added; no frozen hash was recalculated.

The 510-test total consists of the clean tracked baseline plus 12 new tests.
The 523-test total previously observed in `D:\Preator_MCP` included 25 tests
from the untracked file
`test/g3b-adaptive-input-implementation-design.test.ts`; that draft was not
promoted into this branch.

This validation does not claim production-grade durability, independent-host
disaster recovery, calibrated hybrid performance, or any change to G3B.
