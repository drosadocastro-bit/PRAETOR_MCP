# Post-G3B Repository Stabilization Report

**Inventory date:** 2026-09-14
**Phase:** POST-G3B stabilization
**Result:** PASS
**Authority effect:** NONE

This is an administrative repository report, not a governance authorization
artifact. G3B remains closed as **BLOCKED / INCONCLUSIVE**. No historical G3B
artifact was edited, reconstructed, promoted, or used to infer new authority.

## Baseline and ancestry

The expected main development line was verified after fetching `origin`:

- selected baseline: `34b0c4272cc7d02bdbcbc60d5406346cd65f9a04`;
- selected branch at inventory: `mcp-2026-07-28-compat-shadow`;
- remote match: `origin/mcp-2026-07-28-compat-shadow` at the same SHA;
- baseline commit subject: `Document G3B final disposition`;
- new implementation branch: `codex/post-g3b-durability-shadow`;
- the new branch was created directly from `34b0c42`, not from the legacy
  hybrid worktree.

`origin/master` was not selected as the post-G3B baseline. It diverged from
`34b0c42` at `0d79f38`: the selected line had 45 commits absent from
`origin/master`, while `origin/master` had five merge-history commits absent
from the selected line. The remote feature branch, rather than `origin/master`,
was the exact remote match for the G3B closure commit.

## Worktree and branch inventory

| Worktree | Branch / state | HEAD at inventory | Relationship to `34b0c42` | Classification |
|---|---|---|---|---|
| `D:\Preator_MCP` | `mcp-2026-07-28-compat-shadow` | `34b0c42` | exact baseline; dirty | CURRENT_MAIN_CHECKOUT_WITH_PRESERVED_LOCAL_ARTIFACTS |
| `C:\Users\draku\.codex\worktrees\815d\Preator_MCP` | detached HEAD | `a6468d3` | 1 unique commit / 53 commits behind; merge base `2c2709c` | LEGACY_EXPERIMENTAL_WORKTREE |
| `C:\Users\draku\.codex\worktrees\815d\Preator_MCP-post-g3b` | `codex/post-g3b-durability-shadow` | `34b0c42` at creation | exact baseline; clean at creation | POST_G3B_IMPLEMENTATION_WORKTREE |

Other branch observations:

- local `master` at `284a354` was 54 commits behind the selected baseline;
- `origin/master` at `5dc16bd` had the divergence described above;
- no legacy hybrid commit or dirty file was merged into the new branch;
- ignored generated paths in the main checkout were `.pytest_cache/`,
  `node_modules/`, and `data/advisory-packets.ndjson`.

The legacy worktree contains uncommitted hybrid evaluator code, an HTTP judge,
an ablation runner, reports, corpus data, MCP surface edits, and documentation.
Its useful concepts were reviewed read-only. The worktree remains preserved and
unmodified.

## Canonical closure artifacts

These tracked artifacts are the canonical G3B closure record:

| Artifact | Classification |
|---|---|
| `experiments/praetor_verify_001/g3b/G3B_FINAL_DISPOSITION.md` | CANONICAL_CLOSURE_ARTIFACT |
| `experiments/praetor_verify_001/g3b/G3B_MISSING_QUALIFICATION_AUDIT_DISPOSITION_V1.json` | CANONICAL_CLOSURE_ARTIFACT |

They were preserved byte-for-byte. No untracked file in the main checkout
changes their authority or reopens the experiment.

## Main-checkout local artifact classification

The following classifications apply to the dirty state observed in
`D:\Preator_MCP`. No item was deleted or automatically committed merely because
it existed. One exact-byte historical dependency was selected for the new
branch after a tracked test and tracked packet were found to require its pinned
hash; that exception is recorded below.

| Local path or path set | Classification | Rationale |
|---|---|---|
| `README.md` modification | DOCUMENTATION_CHANGE | Useful durability limitation text, but not itself authority. Fresh bounded wording was applied on the new branch. |
| `data/audit-events.ndjson` | RUNTIME_LOG | Append-only local runtime output; now ignored for future runs on the new branch. |
| `G3B_ADAPTIVE_CANDIDATE_SOURCE_MANIFEST_V1.json` | HISTORICAL_INTERMEDIATE | Records a blocked, unresolved Stage-2 source state. |
| `G3B_ADAPTIVE_EXECUTABLE_CONTRACT_HUMAN_DECISION_PACKET_V1.json` | SUPERSEDED_DRAFT | Earlier version; V2 exists locally. |
| `G3B_ADAPTIVE_EXECUTABLE_CONTRACT_HUMAN_DECISION_PACKET_V2.json` | HISTORICAL_INTERMEDIATE | Pending design decisions; preserved closure explicitly references its hash. |
| `G3B_ADAPTIVE_EXECUTABLE_CONTRACT_SPECIFICATION_PACKET_V1.json` | SUPERSEDED_DRAFT | Earlier specification version. |
| `G3B_ADAPTIVE_EXECUTABLE_CONTRACT_SPECIFICATION_PACKET_V2.json` | HISTORICAL_INTERMEDIATE | Incomplete contract specification referenced by closure analysis. |
| `G3B_ADAPTIVE_INPUT_IMPLEMENTATION_DESIGN_REVIEW.json` | HISTORICAL_INTERMEDIATE | Review ended with human semantic-source decision required. Its exact bytes were added to the new branch because a tracked test and tracked authority-reference packet already require SHA-256 `7877F461FCE56BD47FD01C86CA0766E43C85A09EA00ADBB98A2CC1E40D9A9A59`. Inclusion restores repository self-containment; it grants no authority and does not change the artifact. |
| `G3B_IMPLEMENTATION_AUTHORITY_GAP_REVIEW_V1.json` | HISTORICAL_INTERMEDIATE | Completed review input, not the canonical final disposition. |
| `G3B_IMPLEMENTATION_AUTHORIZATION_DECISION_PACKET_V2.json` | HISTORICAL_INTERMEDIATE | Contains the metadata inconsistency recorded below. |
| `G3B_IMPLEMENTATION_AUTHORIZATION_PACKET_V1.json` | HISTORICAL_INTERMEDIATE | Review-ready packet superseded by later events and final closure. |
| `G3B_IMPLEMENTATION_BLOCKER_DESIGN_DECISION_PACKET_V1.json` | HISTORICAL_INTERMEDIATE | Three decisions recorded, but no authority to resume the closed experiment. |
| `G3B_IMPLEMENTATION_BLOCKER_RECORD_V1.json` | HISTORICAL_INTERMEDIATE | Design-blocker record, not a closure override. |
| `G3B_IMPLEMENTATION_DESIGN_DECISION_PACKET_V1.json` | HISTORICAL_INTERMEDIATE | Pending-state design packet referenced by later work. |
| `G3B_IMPLEMENTATION_SPECIFICATION_RECONCILIATION_V2.json` | HISTORICAL_INTERMEDIATE | Read-only reconciliation input. |
| `G3B_SEMANTIC_SOURCE_DESIGN_PACKET_V1.json` | SUPERSEDED_DRAFT | Earlier version; V2 exists locally. |
| `G3B_SEMANTIC_SOURCE_DESIGN_PACKET_V2.json` | HISTORICAL_INTERMEDIATE | Human decision still required. |
| `G3B_STAGE2_DEPENDENCY_HASH_001_INVESTIGATION_V1.json` | HISTORICAL_INTERMEDIATE | Investigation explicitly declined regeneration. |
| `G3B_STAGE_2A_CLAIM_FAMILY_CLASSIFICATIONS_V1.json` | GENERATED_EVIDENCE | Generated Stage-2A review input awaiting human review. |
| `G3B_STAGE_2A_EVIDENCE_ASSERTION_VALIDATION_V1.json` | GENERATED_EVIDENCE | Generated validation output awaiting human review. |
| `G3B_STAGE_2A_FINITE_CONTRADICTION_LEDGER_V1.json` | GENERATED_EVIDENCE | Generated finite ledger awaiting human review. |
| `G3B_STAGE_2A_PROOF_AVAILABILITY_V1.json` | GENERATED_EVIDENCE | Generated inventory awaiting human review. |
| `G3B_STAGE_2A_PROOF_SUPPORT_RELATIONS_V1.json` | GENERATED_EVIDENCE | Generated support assessment awaiting human review. |
| `G3B_STAGE_2A_PROVENANCE_COMPLETENESS_V1.json` | GENERATED_EVIDENCE | Generated provenance assessment awaiting human review. |
| `G3B_STAGE_2A_SOURCE_CONSTRUCTION_PACKET_V1.json` | GENERATED_EVIDENCE | Generated source-construction output. |
| `G3B_STAGE_2A_V1_V2_SEMANTIC_COMPARISON_V1.json` | GENERATED_EVIDENCE | Forward reproducibility review remains pending. |
| `G3B_STAGE_2_HUMAN_SEMANTIC_REVIEW_SUMMARY_V1.json` | HISTORICAL_INTERMEDIATE | Ready-for-review summary with no completed authority effect. |
| `G3B_STAGE_2_SOURCE_INSTANTIATION_REVIEW.json` | HISTORICAL_INTERMEDIATE | Awaiting Stage-2 human review. |
| `stage_2a_assertions/assertion-validate-0000.json` through `assertion-validate-0031.json` | GENERATED_EVIDENCE | Thirty-two generated assertion fixtures; each file is covered by this classification. |
| `generate_stage_2a_v2.mjs` | UNCLASSIFIED_REQUIRES_REVIEW | Untracked generator source should not be promoted merely because generated outputs exist. |
| `test/g3b-adaptive-input-implementation-design.test.ts` | UNCLASSIFIED_REQUIRES_REVIEW | Untracked implementation test affects dirty-worktree totals and requires separate human disposition. |

The unclassified source and test are preserved in place. Their classification
does not block post-G3B durability or shadow work because neither is imported,
copied, or executed by the new branch.

## Historical metadata inconsistency

Classification: **HISTORICAL_METADATA_INCONSISTENCY**

- artifact:
  `experiments/praetor_verify_001/g3b/G3B_IMPLEMENTATION_AUTHORIZATION_DECISION_PACKET_V2.json`;
- observed SHA-256:
  `1d091878174f38a58930e7723b5d3f0e12fe5c951e88c1987dd9d813a3975031`;
- `human_decision.decision` is `AUTHORIZE_IMPLEMENTATION_ONLY`, with reviewer
  `drosado` and timestamp `09/14/2026 0016Z`;
- `authority_effect.current_packet_state.implementation_authorized` is `true`;
- the top-level `packet_status` remains
  `PENDING_HUMAN_IMPLEMENTATION_AUTHORIZATION_DECISION`;
- the top-level `human_signature`, `human_timestamp`, and `human_rationale`
  remain `null`.

The bytes are preserved unchanged because retroactive correction would obscure
the historical record. The inconsistency does not affect current authority:
the artifact is untracked, G3B's canonical final disposition is tracked, G3B is
closed, and the new post-G3B work does not depend on this packet.

## Phase A exit assessment

- main lineage identified: PASS;
- worktrees and divergence classified: PASS;
- local artifacts classified: PASS;
- closure artifacts preserved: PASS;
- historical inconsistency documented without creating an authority chain: PASS;
- accidental authority mutation: NONE;
- clean branch created from verified G3B closure HEAD: PASS;
- artifact deletion or archival: NONE;
- exact historical dependency restored to version control: one, byte-for-byte,
  because it was already pinned and required by tracked repository content.

The implementation work that follows is intentionally isolated on the new
branch. Its resulting Git state is reported in the validation record.

## Baseline self-containment and checkout portability findings

The clean `34b0c42` checkout initially exposed two reproducibility gaps:

1. a tracked test imported
   `G3B_ADAPTIVE_INPUT_IMPLEMENTATION_DESIGN_REVIEW.json`, but the exact file
   was only present as an untracked artifact in the main checkout;
2. several exact-byte tests depended on a historical mixture of CRLF and LF
   working bytes, while no `.gitattributes` policy preserved that mixture in a
   fresh worktree.

The first gap was resolved by adding only the exact artifact whose SHA-256 was
already pinned by tracked content. Its observed bytes matched the expected
`7877F4...9A9A59` identity before inclusion. The second was resolved with
path-specific `.gitattributes` rules. No historical file content or expected
hash was recalculated.

The first implementation layout placed prototype code under `src/`, which
correctly caused the frozen G2 core-tree check to fail. Rather than amend or
replace the historical G2 freeze, the research prototypes were isolated under
`experiments/post_g3b/` and `experiments/hybrid_shadow/`. The original `src/`
tree hash remained `850312ba9f944e13c9bb01161e4bf10ce4d70bf421534f6429b92da2fe5db419`.

This is an intentional deviation from the suggested `src/evidence-store/`
output location. It preserves the stronger invariant that post-G3B research
does not mutate the frozen runtime tree.
