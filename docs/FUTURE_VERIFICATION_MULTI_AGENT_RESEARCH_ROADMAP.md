# TODO - Future Verification and Multi-Agent Research Roadmap

## Specification Correctness, Distributed Search, and Bounded Authority

> **Status: FUTURE RESEARCH ONLY. DO NOT IMPLEMENT YET.**

This roadmap records research questions inspired in part by external large-scale
AI reasoning claims, including reported claims about many-agent systems solving
advanced mathematical problems such as Navier-Stokes. Those claims are treated
only as motivation for investigation, comparison, or research stimulus. They
are not treated as authoritative evidence, verified results, or a design
requirement for PRAETOR.

Nothing in this document changes frozen G0/G1/G2/G3A/G3B findings.

## Current Execution Priorities

1. Complete PRAETOR-VERIFY-001 G3B runtime validation and comparative study.
2. Complete PRAETOR-GAN-001.
3. Revisit the bounded multi-agent hackathon phase.
4. Begin these research threads only after the preceding work is stable.

The tentative order is:

```text
G3B
-> PRAETOR-GAN-001
-> Bounded Multi-Agent Hackathon Phase
-> PRAETOR-SPEC-001
-> PRAETOR-MAV-001
-> PRAETOR-PROV-MA-001
-> PRAETOR-DAS-001
-> PRAETOR-FORMAL-001
-> PRAETOR-SCALE-001
-> candidate transfer to Nova Aegis
```

This is not a frozen experiment order.

## Motivation

The central question is:

> When reasoning becomes too large, distributed, or complex for any single
> human to inspect directly, what independent machinery distinguishes
> collective intelligence from collective error?

The roadmap investigates:

- verifier correctness versus specification correctness;
- distributed search versus centralized authority;
- correlated agent agreement;
- formal verification boundaries;
- provenance and attribution across contributors;
- reconstructability of large trajectories;
- bounded certification when verification power is incomplete.

## Core Invariants

Preserve these distinctions:

```text
capability != authority
authority != proof availability
proof availability != persuasive pressure
persuasive pressure != adaptive search success
formal verification != specification correctness
multi-agent agreement != independent evidence
distributed reasoning != distributed authority
proof validity != claim-scope validity
```

Permanent principles:

> Divide search aggressively; centralize authority conservatively.

> More intelligence, more agents, or more agreement does not imply more authority.

> A conclusion derived by many agents remains bounded by the provenance and
> verification power of the evidence supporting it.

> A formally verified derivation establishes only the statement formalized under
> the assumptions actually encoded.

> A correct verifier does not establish the correctness, completeness, or
> adequacy of the specification it was asked to verify.

When the verification boundary is exceeded, the correct result remains
non-certification, escalation, or explicit uncertainty.

## Research Thread A: PRAETOR-SPEC-001

### Verifier Correctness versus Specification Correctness

Research question:

> Can a verifier correctly satisfy its deterministic contract while the
> contract remains insufficient to establish the broader claim being made?

Do not collapse these outcomes into one `PASS` state:

```text
TEST_CONTRACT_SATISFIED
FORMAL_PROPERTY_ESTABLISHED
SPECIFICATION_MATCH_SUPPORTED
BROADER_CLAIM_SUPPORTED
HUMAN_INTERPRETATION_REQUIRED
NON_CERTIFIED
```

Future synthetic fixtures should cover:

- an exact verifier-to-claim match, expected `VERIFIED`;
- a narrower verified property with the broader claim non-certified;
- an ambiguous specification requiring review;
- an internally satisfiable contract that mismatches the intended external
  property.

Potential metric: **Specification Overreach Rate (SOR)**, defined only within
bounded synthetic fixtures as broader claims incorrectly certified divided by
claims exceeding established specification scope. Target: `SOR = 0` under the
tested conditions. Do not generalize beyond those conditions.

## Research Thread B: PRAETOR-MAV-001

### Multi-Agent Verification Independence

Test one, five, twenty, and one hundred agents while keeping the underlying
evidence unchanged. Agreement may affect confidence telemetry, but agreement
count cannot create missing authority or proof.

Explicitly model:

- independent disagreement;
- correlated agreement;
- shared-model agreement;
- shared-context agreement;
- shared-retrieval agreement;
- shared-prompt agreement.

Each vote or assessment should preserve agent/model identity, model family,
prompt and retrieval fingerprints, tool context, evidence sources, seed,
configuration, and dependency group. Numerical agreement must remain distinct
from epistemically independent agreement.

## Research Thread C: PRAETOR-DAS-001

### Distributed Agent Search

This is not a swarm-authority experiment. Searchers, retrievers, critics,
counterexample hunters, proof-candidate generators, and specification critics
may produce proposals only.

```text
                 Search Coordinator
                        |
         +--------------+--------------+
         |              |              |
         v              v              v
     Searcher A      Searcher B     Searcher N
         |              |              |
         +--------------+--------------+
                        |
                        v
                Candidate Artifacts
                        |
              +---------+---------+
              |                   |
              v                   v
       Deterministic /        Semantic
       Formal Verifier        Evaluation
              |                   |
              +---------+---------+
                        |
                        v
                Governance Fusion
                        |
                        v
                   Human Review
```

A coordinator may allocate work but may not grant authority. Prohibit both
`majority vote => VERIFIED` and `all agents agree => AUTHORIZED`.

## Research Thread D: PRAETOR-FORMAL-001

### Formal Verification Boundary

Separate:

```text
formal derivation validity
specification validity
real-world interpretation
```

Future states may include:

```text
FORMALLY_DERIVED
FORMALIZATION_MATCH_UNVERIFIED
FORMALIZATION_MATCH_SUPPORTED
EXTERNAL_INTERPRETATION_REQUIRED
NON_CERTIFIED
```

Test formal statements that match the intended claim, are weaker than it,
contain an extra assumption, or omit relevant operational context. A formal
checker passing does not make broader interpretations pass.

## Research Thread E: PRAETOR-PROV-MA-001

### Multi-Agent Provenance and Attribution

Track:

```text
idea origin
retrieval origin
agent transformation
cross-agent transfer
derived artifact
verification result
final claim
```

Every lineage edge should preserve source, timestamp, operation, agent identity,
and artifact hash. Test copied unsupported assumptions, shared errors,
provenance loss during summarization, inherited reasoning presented as
independent discovery, and consensus originating from one incorrect source.
Shared lineage must not count as independent evidence.

## Research Thread F: PRAETOR-SCALE-001

### Verification Under Reasoning Scale

Measure agents, messages, evidence items, candidate claims, dependency depth,
cross-agent transfers, and verification steps. Candidate metrics include:

```text
trace_reconstructability
provenance_completeness
dependency_graph_depth
verification_latency
oracle_cost
duplicate_reasoning_rate
correlated_failure_rate
unresolved_claim_count
non_certification_rate
human_review_load
```

Success must not be defined solely as task completion. Measure claims and
artifacts requiring review, time to reconstruct lineage, and unresolved
specification questions.

## Research Thread G: PRAETOR-COLLECTIVE-ERROR-001

Inject synthetic shared false premises, corrupted retrieval, prompt bias,
incorrect specifications, tool defects, and misleading summaries. Compare
independent agents with correlated agents and measure whether a common error
survives:

```text
search -> critique -> synthesis -> verification
```

A large number of agreeing agents may still represent one common upstream
failure.

## Research Thread H: PRAETOR-META-VERIFY-001

### Verification Capability Map

For every claim, record:

```text
claim
-> verifier
-> verification power
-> proof obligation
-> specification boundary
-> remaining uncertainty
```

Possible capability classes include:

```text
DEDUCTIVELY_VERIFIABLE
EMPIRICALLY_ASSESSABLE
SEMANTICALLY_ASSESSABLE
INDISTINGUISHABILITY_LIMITED
TRADEOFF_CONSTRAINED
COMPUTATIONALLY_INTRACTABLE
HUMAN_REVIEW_REQUIRED
CURRENTLY_UNVERIFIABLE
```

Future verifier composition must state what each bounded verifier established.
Multiple partial checks must not silently become universal certification. A
future composition receipt may include formal verification, provenance
verification, semantic assessment, human review, remaining uncertainty,
certified scope, and non-certified scope.

## Bounded Hackathon Connection

The previously documented `COMS Specialist Agent` and `Data Access Agent` remain
operationally bounded. Later research roles such as `Provenance Auditor`,
`Specification Critic`, `Counterexample Searcher`, `Formalization Reviewer`,
and `Evidence Independence Auditor` remain research-only possibilities.
Each future role requires explicit inputs, outputs, authority boundaries, and
prohibited actions.

The hackathon architecture must not become an uncontrolled swarm.

## Human Boundary

Human review remains responsible for specification adequacy, policy intent,
real-world interpretation, authority delegation, unresolved ambiguity, and
claim-scope acceptance. Human review itself must not be mislabeled as
mathematical or formal proof.

## Nova Aegis Transfer Gate

PRAETOR findings must not migrate automatically to Nova Aegis. A result becomes
an architectural candidate only after bounded implementation, adversarial
validation, claim-boundary review, and human approval. PRAETOR remains the
proving ground; Nova Aegis remains the broader architecture.

Possible future concepts include a verifier capability map, specification
boundary registry, independent evidence graph, agent dependency/correlation
graph, formal verification receipt, claim composition receipt, distributed
search coordinator, bounded specialist agents, and an explicit
non-certification layer. None should be implemented until supported by
research.

## Final Research Question

> When reasoning becomes larger than any single reviewer can reasonably inspect,
> how can a system preserve enough provenance, independent verification,
> specification discipline, and bounded authority to know what has actually
> been established?
