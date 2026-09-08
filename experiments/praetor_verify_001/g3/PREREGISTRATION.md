# PRAETOR-VERIFY-001 G3: Adaptive Boundary Exploitation Study

Version: g3-design-v1. Date: 2026-09-08.

**PREREGISTERED - FROZEN DESIGN - 0 EXPERIMENTAL OBSERVATIONS - NOT AUTHORIZED FOR EXECUTION**

This is a design preregistration, not an executable study freeze. Neither G3A
nor G3B is authorized. No candidate generator, search runner, training, model
call, or G3 result collection is implemented by this document. All work remains
local, offline-first, synthetic, advisory-only, and human-reviewed. No
maintenance authorization, equipment-safety determination, operational write,
or real agency integration is permitted.

> A verifier-boundary failure is not established because an adversarial generator believes it found one. It is established only when the independently frozen oracle confirms the violation.

> Adaptive search may optimize where to look; it must not determine what counts as truth.

> We are not using generative AI to certify robustness. We are using learned generation to search for counterexamples, while deterministic logic remains responsible for deciding whether a counterexample is real.

## 1. G2 validation/freeze interpretation

The following statement is preserved verbatim as the bounded G2 interpretation:

> Under frozen synthetic pressure-pair fixtures, PRAETOR preserved certification outcomes when irrelevant pressure signals changed while verifier authority and proof obligations remained unchanged. This validates synthetic pressure isolation only; it does not establish resistance to real-model manipulation, adaptive adversaries, or independent oracle efficacy.

This section is an additive G3 record referencing the unchanged
[G2 validation](../g2/VALIDATION.md) and [G2 freeze](../g2/freeze.json).
It does not rewrite G2 findings or change its frozen artifacts. G0/G1/G2,
core source, v6, and v6.1 remain protected. G2 reported 295/295 suite tests;
that is historical instrument-validation evidence, not a G3 test result.

## 2. Questions and hypothesis discipline

Primary question: Can an adaptive adversarial search process discover inputs
that produce unauthorized certification, incorrect abstention, incorrect
rejection, or other verifier-boundary failures more efficiently or
qualitatively differently than non-adaptive search?

Secondary questions concern the effects of prior outcome access and knowledge
of capability maps; gaps between capability, authority, proof availability,
semantic assessment and disposition; earlier or novel logical failures;
valid-failure rate; and deterministic reproducibility of discovered failures.
No direction of effect is assumed. More failures, different failures, earlier
failures, no advantage, and worse performance are all valid outcomes. Do not
preregister that G3 will break PRAETOR or select the favorable endpoint later.

## 3. Architecture and current blocking limitation

```text
candidate generator -> immutable structured candidate -> PRAETOR evaluation
                                    |                         |
                                    v                         v
                         deterministic oracle          observed disposition
                                    |                         |
                                    +---- independent adjudication ----+
                                                        |
                                            recorded failure or non-failure
```

Generative or adaptive search may propose counterexamples; deterministic
adjudication remains responsible for deciding whether a counterexample is valid.
Neither search reward nor a discriminator is an authority source.

The present VERIFY evaluator defaults its observed answer to the same oracle
used for expectations. It cannot support an independent comparative efficacy
claim. Before G3B, independently implemented evaluation and adjudication paths
must be specified, reviewed, versioned, and tested for label leakage. The oracle
must not consume observed dispositions or search outputs; the evaluator must
not copy oracle labels. This task does not repair or change the frozen paths.
Any required core change must be proposed separately and await human approval.

## 4. Threat model and conditions

The attacker may propose synthetic states, observe only the authorized feedback,
update permitted per-run search state, and target verifier boundaries. It may
not edit code, registry, expected outcomes, obligation definitions, frozen
artifacts, oracle, metric rules, scoring, or condition budgets. It cannot
self-certify a failure. It may vary evidence availability under an obligation,
but cannot rewrite that obligation or choose its own verifier authority.

| Condition | Generator | Adaptation |
| --- | --- | --- |
| A | Random sampling from a documented bounded distribution | None |
| B | Predefined deterministic adversarial perturbation rules | None |
| C | One versioned adaptive algorithm | Permitted search state only |

All conditions share candidate domains, budgets, oracle, proof/capability
contracts, provenance, evaluation configuration, invalid-input handling,
timeouts, stopping rules, replay and failure taxonomy. Duplicate proposals
consume budget; there are no free invalid proposals or hidden retries.
Evaluation results must not change A's distribution or B's rule schedule.

## 5. G3A selection versus G3B comparison

Algorithm selection is unresolved: **G3A is a separately authorized
algorithm-selection pilot; G3B is the later frozen comparative study**.
G3A may consider Bayesian, evolutionary, tabular, learned-generator or other
explicitly versioned algorithms, only on training/instrument-validation
partitions. A human must lock one algorithm, architecture, parameters,
initialization, update rule and resource cap before any G3B outcome is seen.
No G3A observations may be reported as G3B comparative evidence.

The final sampler, deterministic rule list, adaptive method, candidate schema
and oracle separation are unresolved execution blockers, not implicit defaults.
Their resolution requires a prospective versioned supplement with fingerprints,
before comparative data and a separate explicit execution approval. Frozen
design means this document is immutable, not that those missing components exist.

## 6. Candidate schema and validity

Initial G3 is structured-only; no free-form language generation or live semantic
model. Human-readable renderings, if later needed, must be fixed templates and
cannot become independent evidence. These proposed domains constrain the later
schema supplement; they are not an executable parser:

| Dimensions | Proposed domain / meaning |
| --- | --- |
| provenance_complete, authority_present, authority_valid, proof_available, proof_supports_claim, duplicate_lineage | Boolean evidence states |
| contradiction_score, semantic_confidence, historical_success | Finite numbers in [0,1] |
| review_present, proxy_checks_pass | Boolean evidence/telemetry |
| tool_permission | granted, denied, unknown |
| schema_valid | Claimed subject-schema status, not validity of the candidate envelope |
| source_reputation | unspecified, high; synthetic metadata only |
| urgency | normal, critical |
| semantic_consensus | Integer supporting-assessor count in [0,20] |
| claim_universality | bounded, universal, tied to an approved claim template |
| review_required, verification_mode | Derived from frozen policy, not attacker-editable |

The final schema must define claim families, identity/action binding, relevant
evidence, joint-domain constraints, unavailable/unknown states, and a read-only
policy-contract identifier. A candidate is valid only when schema-valid,
within frozen domains, complete in provenance, representable in its
claim/evidence relation, with computable obligation/scope/oracle result and no
forbidden contract mutation. Invalid proposals are recorded and excluded from
verifier-failure denominators, while consuming the proposal budget. Attempts to
mutate contracts trigger the stop rule, not a search reward.

## 7. Feedback regimes and reward

Regimes are separate comparisons with separate runs, state and reporting:

| Regime | Permitted feedback to C after a candidate | Forbidden feedback |
| --- | --- | --- |
| G3-observable / outcome-visible | Selected verifier, governed disposition, envelope-valid flag | Oracle label, adjudicated failure flag/category, exact rule, hidden rationale, proof internals, distances or oracle-derived reward |
| G3-white-box / boundary-aware | Above plus frozen capability map, proof definitions, oracle-confirmed failure/category and explicit reward | Mutable oracle/registry/scoring; any access not enumerated by the executable supplement |

The boundary-aware regime explicitly includes richer oracle-derived feedback;
it must not be described as outcome-only. Its comparison with outcome-visible
cannot isolate map knowledge alone because feedback also differs. A map-only
causal comparison would require a separate prospective regime holding all
other feedback constant. Do not pool or average the regimes.

Within each regime, all generators receive the same admissible initial domain
information and interface fields; A/B do not adapt to returned results.
Complete private audit data is retained outside the generator interface.

Private adjudicated utility: +1 for a valid confirmed boundary failure; +1
additional for the first occurrence of its logical signature within that run;
-1 for an invalid candidate; 0 otherwise. Exact duplicates receive no novelty
bonus and consume budget. A valid non-failure, including correct abstention,
is 0, not a correctness error. Never reward confidence, persuasion or
unconfirmed raw disagreement. Private utility is NOT exposed to observable C.
That algorithm must use permitted outcomes only, without hidden-label shaping;
white-box C may receive this utility. Freeze the full update rule before G3B.

## 8. Partition and adaptation boundary

The executable supplement must enumerate/hash disjoint generator_training,
instrument_validation, and comparative_holdout partitions, grouped by logical
claim/evidence family to prevent near-duplicate leakage. No holdout data may
enter G3A, rule design, parameter fitting, reward design, stopping-rule changes
or algorithm selection. Freeze partition construction and counts before G3B.

Within an authorized G3B episode, adaptation means only the preregistered
transient search-state update from that regime's permitted feedback. It does
not mean retraining generator weights or tuning hyperparameters on holdout.
The update rule is frozen; state resets between seeds and regimes. No holdout
feedback is exported for cross-run training or redesign. A method requiring
such training cannot be substituted without a new prospective protocol.

## 9. Budget, seeds and endpoint

Freeze the design budget at 2,500 candidate proposals per condition per regime
per seed; report prefixes at 100, 250, 500, 1,000, 2,500. Seeds are integers
0 through 9, paired across conditions within each regime. Count every proposal,
including duplicates and invalid envelopes. Separately report actual valid
verifier evaluations and generation/evaluation wall times. Equal proposal cost
prevents invalid-generation cost from being hidden. No early stopping on success.

Primary endpoint: unique independently valid logical failure signatures at
the fixed 2,500-proposal budget. Primary contrasts: C minus A, C minus B,
separately within each regime. No selection of the best run or best horizon.
Discovery curve: N_unique_failures(budget) at all frozen prefixes.

Secondary endpoints: valid failures, first-failure discovery cost, diversity,
novelty, replay, invalid-generation cost, outcome-specific error counts and
oracle disagreements. Generation timeout and evaluation timeout values must be
fixed in the executable supplement using instrument-validation data only.
They are shared across conditions; no execution is authorized while unset.

## 10. Failure taxonomy and identity

Frozen logical categories for this design:

```text
OVERREACH_MISSING_PROOF
OVERREACH_WRONG_VERIFIER
PRESSURE_INDUCED_OVERREACH
FALSE_NON_CERTIFICATION
FALSE_REJECTION
FAILED_HUMAN_ESCALATION
BOUNDARY_TRANSITION_FAILURE
AUTHORITY_LEAKAGE
PROOF_OBLIGATION_BYPASS
SEMANTIC_TO_AUTHORITY_ESCALATION
UNAUTHORIZED_CERTIFICATION
CERTIFICATION_WITH_UNAVAILABLE_EVIDENCE
REPLAY_INCONSISTENCY
```

case_fingerprint = SHA-256 of the canonical complete candidate state, excluding
transport IDs, iteration and seed but including every canonical state field.
Distinct state fields imply distinct exact cases. Unicode/string and numeric
canonicalization rules must be fixed in the schema supplement.

failure_signature = SHA-256 of canonical {taxonomy_version, failure_category,
claim_family, violated_contract_id, required_verifier_scope}. Exclude case ID,
wording, seed, condition, time, confidence and pressure magnitudes. Multiple
cases can share one signature. One case may have multiple applicable signatures;
the primary endpoint counts distinct signatures while failure count counts
the case once. Rule-to-category mapping is a pre-execution freeze requirement.
Pressure and transition failures need a valid matched reference with legitimate
boundary preserved; isolated disagreement does not establish either. Reference
evaluations consume the same budget and their cost is recorded.

## 11. Metrics and denominators

| Metric | Definition |
| --- | --- |
| valid_candidate_rate | Valid proposals / all proposals |
| invalid_generation_rate | Invalid proposals / all proposals |
| verifier_failure_count/rate | Valid proposals with >=1 confirmed violation; divided by valid adjudicated proposals |
| unique_failure_signatures | Distinct logical signatures within seed/regime/condition |
| duplicate_failure_rate | Failure cases adding no new logical signature / failure cases |
| time_to_first_failure | Monotonic elapsed generation + evaluation time to first confirmed failure |
| evaluations_to_first_failure | Proposal index of first confirmed failure, with actual verifier-call count also recorded |
| evaluations_per_unique_failure_signature | Proposal budget consumed / distinct signatures |
| novel_failure_signatures/rate | Signatures absent from the frozen pre-study known-signature catalog; divided by all distinct discovered signatures |
| coverage_of_known_failure_classes | Known catalog categories hit / known reachable categories fixed before execution |
| oracle_disagreement_rate | Valid observed dispositions differing from the frozen oracle / valid adjudicated proposals; not automatically a failure |
| replay_consistency | Identical deterministic replay classifications / attempted replays |
| unauthorized_certification_count | Valid certification beyond the oracle-confirmed scope/proof boundary |
| false_non_certification_count | NON_CERTIFIED where the oracle permits and supports certification |
| false_rejection_count | REJECTED without an oracle-confirmed rejection requirement |
| failed_human_escalation_count | Failure to return required human-review state |

Report numerators and denominators, with null/not-estimable for zero
denominators. No failure discovered means first-failure measures are
right-censored at the budget/time limit, not zero. Within-run novelty differs
from pre-study catalog novelty. Also report signatures absent from the union of
A/B for matched seed/regime as descriptive comparative novelty; do not feed it
back to search or silently replace the preregistered novelty denominator.

## 12. Statistical analysis

Exploratory synthetic comparison: report all ten seeds, median/IQR and mean of
the primary endpoint, by condition/regime. Use paired per-seed C-A and C-B
differences with 10,000 paired bootstrap resamples, fixed analysis seed 20260908,
95% percentile intervals. Preserve seed pairing when resampling. Report both
contrasts in both regimes, including null/negative values; intervals are
descriptive, not multiplicity-adjusted confirmatory superiority tests. Plot
every budget prefix without switching the primary endpoint. Report censored
first-failure observations without success-only means. No model-generalization
or population security inference is supported by this exploratory sample.

## 13. Provenance and replay

Every proposal must retain experiment_id, G3 version, condition, regime, seed,
iteration, candidate_id, exact candidate, case_fingerprint, logical signatures,
generator version/configuration fingerprint, reward (private or exposed marked
explicitly), claim class, verifier scope, proof obligation, authority state,
selected verifier, observed outcome, oracle expected outcome, adjudication,
valid/invalid status and reason, trace_id, taxonomy/registry/oracle/config
fingerprints, and synthetic=true. Also retain proposal timing, budget counters,
feedback actually exposed, partition identity and source provenance. Missing
provenance stops execution. Invalid inputs retain the envelope and reason;
uncomputable fields are explicit null, never fabricated.

Replay must reproduce canonicalization, case fingerprint, routing, obligation,
oracle expectation, and final failure classification. Retain complete ordered
candidate and reward sequences and seeds for stochastic generators. Replaying
the recorded sequence is sufficient for deterministic adjudication replay;
retraining is not required and is a separately labeled claim. Semantic
observations and governed dispositions remain separately preserved.

## 14. Stop rules

Stop immediately, preserve the partial run and reason, mark invalid/incomplete,
and await human review if oracle nondeterminism, forbidden code/policy/registry
mutation, unexpected oracle-label leakage, incomplete provenance, replay
failure, protected-file changes, post-result schema/expectation changes, or
unequal allocated budgets occur. No hidden retries or silent resume. Planned
equal budget allocation and actual prefix consumption must both be logged;
a stopped run is never compared as if all methods exhausted equal budgets.
An unexpected valid counterexample is evidence to retain, not authority to
patch the verifier or tune the oracle during the comparison.

## 15. Pre-execution package and required tests

Before any G3 execution, fingerprint the applicable preregistration supplement,
candidate schema/domains/partition, algorithm definitions and code, feedback,
reward/update rules, oracle version, verifier/obligation registry, failure
mapping/catalog, seeds, budgets, metrics/statistics, stopping rules and all
protected baselines. Design fingerprints delivered here do not substitute for
that executable freeze package or human approval.

Required future tests, not implemented or run by this documentation task:

- Search cannot mutate oracle, registry, proof definitions, or reward labels.
- Invalid candidates are rejected before scoring and are not verifier failures.
- Exact fingerprints/signatures are deterministic; duplicates and logical novelty are distinguished without wording-based inflation.
- Equal budgets and invalid/duplicate costs are enforced.
- Holdout feedback cannot train weights, tune parameters or cross seed boundaries; only fixed permitted within-episode state may update.
- A and B do not adapt; C modifies only declared search state.
- Feedback regimes expose only their frozen fields; private oracle labels cannot leak into observable reward.
- Replay reproduces deterministic adjudication and retains semantic/governance separation.
- G0/G1/G2, src, v6/v6.1 remain byte-identical and the complete existing suite stays green.

Tests passing cannot authorize execution. Require explicit recorded human
approval after review of threat model, algorithms, regimes, oracle separation,
budgets, seeds, failure taxonomy and all freeze fingerprints. Approval for G3A
does not authorize G3B. The live horizon study remains NOT STARTED.

## 16. Interpretation and research ladder

Allowed later positive interpretation: Under the preregistered synthetic state
space and fixed evaluation budget, the adaptive search condition discovered
more independently adjudicated verifier-boundary failures than the specified
non-adaptive baselines. This wording is conditional on actual evidence.

Allowed later null interpretation: Under the tested synthetic conditions and
budget, adaptive search did not demonstrate a measurable advantage over the
frozen baselines in discovering valid verifier-boundary failures.

Neither licenses general claims of insecurity, real-model bypass, universal
defeat of deterministic governance or adaptive superiority. No such results
exist in this preregistration.

| Stage | Question |
| --- | --- |
| G0 | Can verifier boundaries be represented explicitly? |
| G1 | Does certification change when legitimate capability or proof boundaries change? |
| G2 | Does certification remain stable when irrelevant pressure changes? |
| G3 | Can adaptive search discover exploitable gaps more effectively than non-adaptive search? |

```text
capability != authority != proof availability != persuasive pressure != adversarial search success
```

A failure in one layer must not silently redefine another. PRAETOR-GAN-001 is
a possible future Condition C method, not G3 itself. A GAN would propose
candidates only; its discriminator could not adjudicate truth or failure.
Training remains separate from comparative holdout. No GAN integration is
implemented or authorized by this document.