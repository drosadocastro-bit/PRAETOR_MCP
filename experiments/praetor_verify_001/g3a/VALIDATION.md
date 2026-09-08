# G3A Instrument Selection Result

2026-09-08. Local, synthetic, advisory-only research artifact.
G3A IS NOT G3B. No G3B comparative observations or holdout evaluation.

## Decision

PROPOSED_PENDING_HUMAN_REVIEW: tabular-v1. All three prospectively declared
methods met instrumental eligibility. Tabular is proposed solely because it
has the lowest predeclared audit-complexity rank among eligible methods.
Bandit and evolutionary candidates remain preserved and eligible, but were
not selected under that rule. No failure-discovery or efficacy endpoint was
used to select, rank, eliminate or tune any method.

This is a proposal, not human acceptance. HUMAN_REVIEW.json is unsigned and
pending. No final accepted G3B instrument or execution authorization exists.

## Sequence and Evidence

1. PROTOCOL.md fixed the bounded runtime/policy scope, toy target, three
   methods, hyperparameters, instrument seeds and eligibility before selection.
   Its initial draft's 128 budget was corrected to 250 before any searcher
   implementation or pilot outcome. This correction did not alter G3.
2. G3A.1 and G3A.2: 26 tests and TypeScript passed before G3A.3 implementation.
   prerequisites.json pins those exact sources. Observed and oracle decisions
   use separately implemented functions, separate parsed input copies and
   separate outputs; comparison happens after both are produced.
3. G3A.3: 9 toy-search/selection tests plus 3 orchestration tests passed.
   The numeric seed parser was repaired before the pilot without changing
   seeds or outcomes. The complete prospective gate was 38/38 tests.
4. selection-freeze.json was recorded and verified against current bytes
   before --run. It contains source/configuration hashes and all 30 cells.
5. One pilot run recorded 30/30 cells and 7500/7500 proposal attempts under
   G3A_INSTRUMENT_VALIDATION. No restarts, silent retries or overwritten runs.
6. --replay verified artifact bytes and reconstructed 30/30 decision-trace and
   seed/feedback sequences plus the instrumental selection. Replay is a
   validation pass over recorded inputs, not 7500 new scientific observations.

## Instrumental Measurements

Each row is five separate seeded cells, 250 proposals each. Seeds are 101-105,
not G3B's reserved 0-9. Regimes are reported separately, never pooled for an
efficacy inference. Elapsed times cover proposal/evaluation/update loops only;
initialization, per-proposal evaluation/generation timing and sampled process
RSS are separately retained in artifacts. Serialization and replay are not
included in loop throughput. RSS includes process/GC history, not isolated
algorithm allocation, and must not be used as a clean comparative memory claim.

| Method | Regime | Valid Rate | IGR | DPR Range | Neutral States | Loop ms Range | Sampled Peak MiB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tabular | observable | 1 | 0 | 0.748-0.772 | 4/4 | 24.76-41.83 | 141.29 |
| tabular | white-box | 1 | 0 | 0.748-0.772 | 4/4 | 23.16-28.57 | 152.63 |
| bandit | observable | 1 | 0 | 0.832 | 4/4 | 20.48-24.71 | 213.06 |
| bandit | white-box | 1 | 0 | 0.832 | 4/4 | 22.65-23.75 | 215.93 |
| evolutionary | observable | 1 | 0 | 0.764-0.816 | 4/4 | 22.34-24.38 | 215.95 |
| evolutionary | white-box | 1 | 0 | 0.764-0.816 | 4/4 | 23.13-25.58 | 215.64 |

Every cell: seed reproduction=1, replay=1, provenance completeness=1,
budget compliance=1, changed-toy-feedback adaptation demonstrated, leakage
count=0 and no runtime stop. DPR is duplicate exact candidate proposals divided
by proposals; repeated states consume budget. It is descriptive, not an
eligibility threshold or logical-failure novelty metric. Field coverage sets
are retained per cell; 4/4 measures only urgency x reputation, not coverage of
all possible candidate joint states.

## Independence and Limits

- The observed path is a NEW experimental synthetic policy evaluator, not an
  adapter exercising production PRAETOR's maintenance governance. No production
  certification efficacy claim follows from these results. The original
  G0/G1 oracle-derived observed path is untouched and not reused here.
- Distinct execution paths do not establish independent correctness of the
  shared policy specification. Human review must assess that policy and the
  reduced four-family domain before any G3B integration.
- Oracle-label mutation did not change observed decisions or observable
  feedback. Observed-output/input mutation did not mutate the oracle copy.
  Tests enforce exact regime whitelists and separate imports. The
  privileged_information_leakage=false statement is bounded to these tests
  and recorded feedback objects, not a sandbox/noninterference proof against
  arbitrary hostile JavaScript running in the trusted orchestration process.
- Toy learning receives only a tagged binary neutral reward. Actual bounded
  PRAETOR exposure is separately recorded/validated, but is NOT consumed by the
  search update. Both regime runs therefore demonstrate plumbing and toy
  adaptation, not adaptive use of G3B observable/white-box feedback. A future
  feedback adapter requires prospective specification and review.
- Nonadaptive random/rule controls were checked under changed toy feedback;
  their sequence/state remained unchanged. They are instrument test controls,
  not frozen G3B A/B implementations and not comparative observations.
- AgentK=FAIL cannot be overridden by a semantic result in the experimental
  governance helper. This preserves the synthetic invariant; it does not expand
  production Agent K authority or claim actual equipment safety.
- Cooperative 100ms generation/evaluation deadlines and 512 MiB sampled RSS
  limits are not preemptive CPU/memory isolation. Trusted algorithms only.
  Inputs over 8192 bytes retain their byte hash but not full raw content;
  those rejected inputs cannot be fully reconstructed from a trace alone.
- All 13 G3 failure categories are retained. Pressure/transition require a
  paid matching reference; transition is limited to one nonpressure field in
  the same family/source. Unclassified disagreements stop, and replay
  inconsistency is an instrument failure, not an adversarial success.

## Fingerprints and Verification

- Canonical selection freeze:
  `3418983d0ba0896d014dd60887db0f3fba2aeee0a601af183e0b1e6940e07719`
- Pilot summary exact bytes:
  `3c13ab7502c4d99297502cceda4e1975b56a1ea4daec2cb3bb17884e06a7a906`
- All method source exact bytes:
  `9c602901452d7dd667bfbb148946be1a08a4015f0e74ef40876ebfef59b09c5a`
- Full instrument configuration:
  `7c921a7aacf1686a03cef6ebce8cd9d9f96187e011d2ecbea7d829ebeedc93af`

Pilot result-fingerprint.json pins the summary; the summary pins every cell's
exact bytes. Each cell references the selection freeze and contains full
candidate, separate decisions, private comparison, config/component hashes,
trace IDs, toy feedback, exposure, telemetry and reproduction evidence.

Verified commands: npm test (333/333 tests, 34 files); npm run check (PASS);
explicit strict runner TypeScript check (PASS); --replay (30/30 cells PASS).
Read-only prerequisite verification confirms frozen G0/G1, G2 sources/manifests,
src tree, v6/v6.1 artifacts and original G3 design/gate hashes are unchanged.

## Next Authorized Boundary

Human decision: APPROVE SELECTED ADAPTIVE INSTRUMENT FOR G3B DESIGN INTEGRATION,
or DO NOT APPROVE. A positive integration decision is NOT study execution
approval. Only afterward should the separate G3B executable supplement, final
samplers/policies/feedback contracts and partition construction be developed
under their own authorization, contamination audit and new execution gate.
No G3B supplement or holdout was created in this task. Contamination remains
null/not assessed for an unconstructed holdout, not a fabricated clean result.