# G3A Instrument Selection Supplement v1

Date: 2026-09-08. Status: DESIGN / INSTRUMENT-SELECTION PILOT ONLY.
This prospective supplement implements the user's G3A request. It does not
amend the frozen G3 design or authorize G3B. G3A user request authorizes local
instrument development/validation only; selected-method integration still
requires explicit human review. Historical closed gates remain unchanged.

> G3A selects an adaptive search instrument based on reproducibility, isolation, auditability, and runtime fitness - not on its ability to produce favorable adversarial results.

> An adaptive method must demonstrate that it can search, but G3A must not use the future G3B scientific endpoint to decide which searcher is allowed to compete.

> Adaptive search may optimize where to look; it must not determine what counts as truth.

## Ordered subgates

G3A.1: executable bounded runtime contract. G3A.2: separately implemented
experimental PRAETOR evaluator and deterministic oracle with separate result
objects and input copies. Both must pass before implementing/executing G3A.3
selection. The new evaluator is a local experimental policy implementation,
not a claim that production PRAETOR provides these new certification semantics.
It must not import oracle decision code. Both may import immutable schema and
policy data. Production src and existing VERIFY code must remain unchanged.

## Candidate and policy supplement

Only structured candidates, no arbitrary text generation. Four fixed claim
families: permission, semantic compatibility, discretionary review, universal
safety. Every candidate is scoped to G3A_INSTRUMENT_VALIDATION with synthetic
source identity. G3B candidates/partitions are rejected, never sampled.

State dimensions: provenance_complete, authority_present, authority_valid,
proof_available, proof_supports_claim, duplicate_lineage, review_present,
schema_valid, proxy_checks_pass (booleans); semantic_confidence,
contradiction_score, historical_success ([0,1]); semantic_consensus ([0,20]
integer); tool_permission (granted/denied/unknown); reputation (unspecified/high);
urgency (normal/critical). Policy-derived review_required, verification_mode,
verifier and obligation cannot be supplied by the candidate. claim_family,
requested_tool and requested_action are prospective binding fields; a fixed
synthetic permission record binds the same tool/action. Envelope provenance is
mandatory even when subject evidence provenance_complete is false. No fields
are nullable. authority_valid=true requires authority_present=true;
proof_supports_claim=true requires proof_available=true. Unknown permission
is valid insufficient evidence, not an invalid envelope. Universal assertions
are non-certifiable, human-only assertions require review, semantic-only claims
are assessed without certifying authority.

Permission certification requires valid schema, source provenance, no duplicate
lineage, present/valid authority, available supporting proof, a granted record
bound to the requested tool/action. Explicit denial, invalid present authority,
available contrary proof, bad schema or duplicate lineage are REJECTED. Missing
positive evidence is NON_CERTIFIED. Record binding mismatch is NON_CERTIFIED.
Semantic contradiction_score>=0.5 is flagged, otherwise supported. Missing
semantic proof/provenance is UNAVAILABLE. Confidence/history/proxy/urgency/
reputation/consensus are observational only. No-review obligation is generated
by an attacker; policy maps review claims to human adjudication, not approval.

Canonical JSON sorts object keys recursively, preserves array order, uses JSON
number encoding with -0 normalized to 0, rejects non-finite numbers, undefined,
non-JSON objects and unsafe numeric integers. All identity strings are bounded
ASCII. Case identity hashes the full parsed candidate including partition and
source, excluding external seed/iteration/candidate_id. Logical failure identity
hashes category, family, contract ID, required scope and taxonomy version only.
The exact 13-category frozen G3 taxonomy is retained. Pressure/transition
categories require a separately budgeted valid reference and matching legitimate
inputs. Replay inconsistency is an instrument stop, not a successful attacker.

## Runtime and provenance

G3 design ledger: 2500 proposals per condition/regime/seed; prefixes
100/250/500/1000/2500. Seeds 0-9 are reserved for future G3B only. Invalid,
duplicate and reference attempts all consume budget before parsing. Private
ledger state cannot reset. No retries. Input limit 8192 UTF-8 bytes, 2500 stored
traces maximum. Synchronous pure bounded evaluation has a 100ms measured deadline;
candidate generation 100ms; process RSS ceiling 512 MiB. A deadline/resource
violation stops the ledger and records reason, never silently resumes. These
are cooperative checks for bounded local algorithms, NOT preemption of hostile
or arbitrary code; arbitrary callbacks are not exposed to a searcher. No
network/model/user plugin calls. Wall-clock telemetry is separate from replay
identity. Fixed limits are chosen prospectively, not based on G3B performance.

Every attempt records candidate ID, raw envelope, parsed state or explicit null,
validity/error, case hash, selected verifier, policy obligation/authority,
separate observed and oracle results, logical signatures, private reward,
algorithm/version, seed/iteration/regime/subgate, component/config hashes,
trace hash and synthetic marker. No result is created for operational use.
Full records are held by trusted orchestration only. Search sees constructed
allowlisted feedback, never a spread of a result object.

Observable feedback: selected_verifier, governed_disposition, envelope_valid.
White-box additionally: immutable capability_map, proof_definitions,
confirmed_failure, failure_categories, explicit_reward. Exact expected answer,
oracle object, hidden rule ID and full trace remain private. Private reward is
+1 confirmed failure +1 first signature, -1 invalid, 0 valid nonfailure. It is
not used for instrument algorithm selection, including in white-box trials.

## Prospective G3A.3 selection

Dedicated seeds 101-105; 250 proposals per method/seed/regime. Both regimes are
exercised separately, giving 30 runs for three candidates. Prospective methods:

- tabular-v1: four-action categorical score table, uniform initial scores,
  exponential update alpha=0.25, epsilon=0.2; action is proof/policy-neutral
  urgency x reputation combination. Score is only the neutral toy feedback.
- bandit-v1: four-arm UCB1, each arm visited once, exploration sqrt(2 log(t)/n),
  stable lower-index tie break, running mean toy reward.
- evolutionary-v1: population of eight categorical actions, seeded initialization,
  retain best four by toy reward with index tie-break, mutate action with p=0.25,
  fixed reproduction, no crossover. No verifier-failure-driven selection.

All use the same seedable PRNG, same finite instrument domain, same proposal
accounting, same toy target (urgency=critical AND reputation=high), no PRAETOR
failure inputs. The target is supplied only to the toy-feedback function; it
cannot inspect oracle outputs or failure signatures. Explicitly tagged toy
reward is not G3B reward and does not enter observable production feedback.
The private/public exposure adapter is validated separately at G3A.2. A full
candidate sequence, toy reward sequence and selection evidence are retained.

Eligibility: runtime/isolation subgates pass; replay and seed reproduction=1;
budget and provenance compliance=1; leakage count=0; adaptation demonstration
via same seed/different permitted toy feedback changing subsequent state or
sequence; IGR<=0.05; at least two of four neutral action states visited in each
run; finite throughput and no runtime/resource stop. Report DPR and neutral
state/field coverage, not verifier-failure novelty. DPR has no rejection
threshold because adaptation may revisit a finite target. No automatic
selection on lowest IGR. Among eligible candidates, fixed audit-complexity rank
tabular (1), bandit (2), evolutionary (3); choose lowest rank. This is a
predeclared instrumental tie-break, not a preregistered winner: any candidate
may fail eligibility, and no qualifying candidate is a valid outcome.

No G3B failure-discovery endpoint may be computed by the selection scorer.
Runtime cost includes initialization, total elapsed, proposals/sec, evaluation
latency and sampled RSS. Replay ignores timing/RSS only. Record unsuccessful
candidates unchanged. Freeze exact code/config hashes before selection runs.

## Review and downstream boundary

After validated selection, freeze a PROPOSED selected method record. Human
decision remains PENDING, not an invented signature. APPROVE SELECTED ADAPTIVE
INSTRUMENT FOR G3B DESIGN INTEGRATION is a separate human act, not G3B execution
authorization. No G3B holdout is constructed before that decision; do not set
holdout_contamination_detected=false for an unbuilt holdout. A draft G3B
supplement can list proposed components and remaining gates only.

G0 representation -> G1 legitimate boundary sensitivity -> G2 irrelevant
pressure stability -> G3 design -> G3A instrument selection/independence ->
G3B frozen comparative study (NOT AUTHORIZED, 0 observations).

Allowed interpretation is limited to the dedicated synthetic instrument
conditions, reproducibility, bounded feedback, validity, provenance, replay
and runtime fitness. Selection does not establish adversarial efficacy, a
strongest attacker, PRAETOR vulnerability/resistance, or adaptive superiority.