# PRAETOR — Linux CI Failure Review

## Final classification

`LINUX_CI_ROOT_CAUSE_IDENTIFIED`

`recommended_fix_scope:`

- `.gitattributes`
- `scripts/verify-baselines.ts` and/or the exact historical-byte verification contract
- `test/g3b-adaptive-field-source-and-adapter-decision-packet.test.ts` only if the canonicalization is implemented in the test rather than through checkout attributes

`authority_effect = NONE`

`research_effect = NONE`

## Scope and remote run

- Branch: `codex/post-g3b-durability-shadow`
- Commit: `a20b64fe17bae0151a010cb0fb0fdf65ada1a4ce`
- GitHub Actions run: [34990328808](https://github.com/drosadocastro-bit/PRAETOR_MCP/actions/runs/34990328808)
- Runner image: `ubuntu-24.04`
- Failing jobs:
  - `ubuntu-latest / Node 22.x`, job `104452998457`
  - `ubuntu-latest / Node 24.x`, job `104452998205`
- Successful comparison jobs:
  - `windows-latest / Node 22.x`, job `104452998572`
  - `windows-latest / Node 24.x`, job `104452998433`

## First causal failure

Both Ubuntu jobs complete the following stages successfully:

- `npm ci`
- `npm run check`
- `npm run build`

Both fail at the first runtime step:

```text
npm test -- --run
```

The Ubuntu shell is `/usr/bin/bash -e {0}`. The step exits with code `1`; the remaining quality steps are skipped.

The two meaningful failures are identical on Node 22 and Node 24:

1. `test/g3b-adaptive-field-source-and-adapter-decision-packet.test.ts:409`

   The `metamorphic_test` reference is checked by hashing raw file bytes.

   ```text
   Expected: 03f3acafbbfb8d548a0ff35fbff52e87b2894f8810e64efca2ac462e3d27676f
   Received: d8f67d5d2bae45abdaeda78a6d778a4be4ed87433f7454850fb4b441c83e099e
   ```

2. `scripts/verify-baselines.ts:118`, called by `test/historical-baseline-verification.test.ts:7`

   ```text
   Error: Historical G2 source artifact changed: test/praetor-verify-001-g2.test.ts
   ```

Vitest reports `2 failed | 53 passed` files and `2 failed | 495 passed` tests out of `497`. The job annotations contain the same two failures plus the generic exit-code annotation. Both jobs also have the non-causal warning that `actions/checkout@v4` and `actions/setup-node@v4` target deprecated Node 20 for the action runtime.

## Root-cause classification

`LINE_ENDING_FAILURE`.

This is an OS portability failure caused by hashing checkout bytes as if they were canonical historical bytes.

The relevant facts are exact:

| File | Expected/passing bytes | SHA-256 | Ubuntu LF bytes | SHA-256 |
|---|---|---|---|---|
| `test/g3b-adaptive-input-minimization-evidence.test.ts` | CRLF | `03f3acafbbfb8d548a0ff35fbff52e87b2894f8810e64efca2ac462e3d27676f` | LF | `d8f67d5d2bae45abdaeda78a6d778a4be4ed87433f7454850fb4b441c83e099e` |
| `test/praetor-verify-001-g2.test.ts` | CRLF / frozen hash | `2adfb738624579282ca6a6b2016ca5a54827a13b83f1847e678f0ace7d29bab0` | LF | `3f0108dc722c2d6ab27ec67d3affc8e3b65bedac943493c14430bc7ea511308b` |

The Windows worktree has `core.autocrlf=true` and checks these files out as CRLF. Its raw working-tree hashes therefore match the historical values and all `497` runtime tests pass on both Node versions.

Ubuntu checks out the same Git blobs as LF because both test files have `text=auto` with `eol` unspecified. The Git blob hashes match the Ubuntu received values. The historical expected hashes were created from CRLF working-tree bytes, so the raw-byte assertions fail without any source-code or behavioral difference.

The existing `.gitattributes` correctly assigns CRLF to `experiments/praetor_verify_001/**`, but it does not assign a canonical line ending to the two referenced files under `test/`. That is the portability gap.

## Windows versus Ubuntu comparison

| Dimension | Windows | Ubuntu | Causal? |
|---|---|---|---|
| Shell | PowerShell 7 | Bash | No; commands through npm are equivalent |
| Node 22 | `v22.23.2`, npm `10.9.8` | `v22.23.2`, npm `10.9.8` | No |
| Node 24 | `v24.20.0`, npm `11.19.0` | `v24.20.0`, npm `11.19.0` | No |
| Path arguments | Forward-slash test paths in CI | Same | No |
| Import/build resolution | Typecheck and build pass | Typecheck and build pass | No casing/import failure |
| Filename casing | Case-insensitive filesystem | Case-sensitive filesystem | No case-only duplicate tracked paths; no failure observed |
| Checkout line endings | CRLF working files | LF working files | Yes |
| npm dependency resolution | Pass | Pass | No |
| Runtime behavior | `497/497` pass | `495/497` pass | Difference is byte identity only |
| Localhost/network | Smoke steps pass on Windows | Not reached after runtime failure | Not causal |
| Signals/processes | Smoke steps pass on Windows | Not reached after runtime failure | Not causal |
| Docker | Quality passes on Windows; container is not in the Windows matrix | Container job is skipped because it needs `quality` | Not causal |

No relevant backslash path, drive-letter dependency, `cmd.exe` command, PowerShell-only CI command, case-mismatched import, or case-only generated file was found. The `new URL(...)`, `path.join(...)`, and `execFileSync('git', ...)` usage is portable and is not implicated by the successful Ubuntu typecheck/build.

The localhost and Docker references are confined to later HTTP/container smoke coverage. The Ubuntu quality jobs fail before those steps, and the separate `container` job is skipped by `needs: quality`; Docker is therefore not the root cause.

## WSL reproduction

WSL is available with `Ubuntu 24.04.3 LTS`, but it is unsuitable for this reproduction because it has no Linux Node binary:

- `node`: not found
- `npm`: `11.6.2` resolves through `/mnt/c/Program Files/nodejs/npm`, but cannot launch without `node`

Attempted command:

```text
wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/draku/.codex/worktrees/815d/Preator_MCP-post-g3b && node --version && npm --version && npm test -- --run"
```

Result: `LOCAL_LINUX_REPRODUCTION_NOT_AVAILABLE`.

The remote Ubuntu logs plus the exact LF/CRLF hash comparison establish the failure without requiring a local Linux Node installation.

## Minimal proposed fix

Do not disable Ubuntu, mark it optional, skip tests, change historical hashes, or weaken assertions.

The smallest safe fix is to make the historical byte contract explicit and platform-independent. The preferred implementation is to verify the canonical historical bytes from Git/archive data rather than raw working-tree bytes. If the intended authority is specifically the preserved CRLF representation, an equally narrow first remediation is to add explicit `eol=crlf` rules for the two referenced test files in `.gitattributes` and then verify on both OS families.

The fix must cover both paths:

- `test/praetor-verify-001-g2.test.ts` used by `verifyHistoricalG2Archive()`;
- `test/g3b-adaptive-input-minimization-evidence.test.ts` used by the G3B source-basis hash assertion.

## Required validation after the fix

Run the same matrix and confirm:

- Windows 22: PASS;
- Windows 24: PASS;
- Ubuntu 22: PASS;
- Ubuntu 24: PASS;
- runtime suite: `55` files / `497` tests;
- historical verification: `HISTORICAL_G2_ARCHIVE_INTACT` and historical tree hash `850312ba9f944e13c9bb01161e4bf10ce4d70bf421534f6429b92da2fe5db419`;
- durability, hybrid shadow, audit, whitespace, MCP smoke, HTTP smoke, and container smoke all execute and pass;
- no G2/G3 historical artifact or authority meaning is changed.

## Risk and authority boundary

Regression risk is low if the change is limited to canonical byte handling/checkout metadata. The main risk is accidentally updating an expected hash instead of preserving the existing historical bytes; that would be invalid and must be rejected.

The failure is an implementation/verification portability defect only. It does not create, expand, or reinterpret any research claim. The authority and research effects are both `NONE`. G2 remains historically frozen; G3B remains unchanged.

No code, CI configuration, historical artifact, commit, or push was modified as part of this investigation.
