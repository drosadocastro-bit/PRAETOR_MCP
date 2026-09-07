# PRAETOR-GAN-001: Learned Adversarial Boundary Exploration

**Status:** Future research line; not implemented  
**Scope:** Isolated pilot design only  
**PRAETOR runtime impact:** None  
**Experimental observations:** 0

## Purpose

PRAETOR-GAN-001 is a proposed learning exercise and future instrument for
testing whether a learned generator can explore structurally valid synthetic
PRAETOR states near deterministic decision boundaries more efficiently, or in
qualitatively different ways, than random and rule-based perturbations.

This line is deliberately separate from the frozen PRAETOR instruments,
historical artifacts, production logic, policy semantics, and preregistered
live study. It must not be presented as a robustness, security, reliability,
or operational-safety result.

## Core separation

The GAN is an adversarial **case generator only**. It may propose candidate
feature vectors, but it cannot determine whether a case succeeded, define the
expected policy outcome, authorize an action, or certify an escape.

The discriminator is also not an adjudicator. Its task is limited to learning
whether a candidate resembles the synthetic training distribution. A trained
discriminator may eventually fail to distinguish generated states from real
training samples; that is a normal generative-model limitation, not evidence
that the generated state is policy-valid or operationally meaningful.

Every candidate must therefore pass through an independent deterministic
schema validator and policy oracle. The oracle computes the expected result;
PRAETOR under test computes the observed result; the comparison defines any
synthetic escape signature. Neither the GAN, discriminator, LLM judge, nor
PRAETOR self-report may replace the oracle.

## Proposed phases

### G0: Instrument validation

Use structured state vectors only. Natural-language generation, horizon
trajectories, live model calls, and operational data remain deferred.

The initial feature schema is:

```text
provenance_complete   binary
authority_valid       binary
duplicate_lineage     binary
contradiction_score   float [0,1]
evidence_confidence   float [0,1]
review_present        binary
tool_permission       binary
memory_authority      binary
```

The final schema must be documented and fingerprinted if it changes. Training
data must use synthetic or already-approved fixtures only, and training and
evaluation cases must be separated. Invalid generated states are rejected
before PRAETOR evaluation and counted in `invalid_generation_rate`.

### G1: Boundary exploration

Explore states near deterministic boundaries such as:

```text
SAFE <-> DOUBTFUL
DOUBTFUL <-> UNSAFE
TRUSTED <-> UNTRUSTED
ACCEPT <-> REJECT / REVIEW_REQUIRED
```

The initial question is concentration and structural validity, not bypass.

### G2: Adversarial objective

Only after G0 and G1 are independently validated may the experiment consider
an objective combining plausibility, structural validity, and policy-relevant
conditions. The expected policy behavior remains defined by the deterministic
oracle, never by the generator or discriminator.

### G3: Controlled comparison

Compare random fuzzing, deterministic rule-based perturbation, and GAN-guided
generation under equal candidate-evaluation budgets where practical. Negative
results are valid. A GAN that finds no novel failure signatures is still a
useful training result.

G4 horizon-aware trajectories and natural-language rendering are deferred.
If rendering is later introduced, the structured state remains authoritative:

```text
structured state -> deterministic/template renderer -> scenario -> PRAETOR
```

## Independent adjudication contract

For each structurally valid synthetic case:

```text
expected = deterministic_policy_oracle(case)
observed = praetor_under_test(case)

escape = expected in {REJECT, UNSAFE, UNTRUSTED, REVIEW_REQUIRED}
         and observed in {ACCEPT, SAFE, TRUSTED}
```

Exact enum names must follow the approved PRAETOR contract at implementation
time. The oracle must remain independent of GAN training, discriminator output,
LLM judgments, and PRAETOR self-reported success.

## Required provenance

Each generated case must retain the seed, generator and discriminator
configuration, architecture and hyperparameters, generator version, source
distribution, training-dataset fingerprint, feature-schema fingerprint,
oracle version and fingerprint, PRAETOR configuration fingerprint, git commit,
library versions, and an explicit `synthetic=true` marker.

Synthetic cases are never real operational evidence and cannot be used to
authorize maintenance, determine equipment safety, or establish an empirical
claim about a deployed system.

## Metrics

The first implementation should record total cases, structurally valid cases,
invalid-generation rate, contained cases, oracle-defined escape cases,
adversarial escape rate, unique failure signatures, duplicate-failure rate,
cases to first escape, oracle disagreement rate, replay consistency, and
boundary distance where measurable. A SHA-256 fingerprint of the canonical
features plus expected and observed outcomes defines a failure signature.

## Acceptance gates before implementation

- Isolated module with no core PRAETOR behavior changes.
- Equal-budget interfaces for random, rule-based, and GAN generation.
- Deterministic schema rejection before evaluation.
- Independent oracle for every evaluated case.
- Reproducible seeds and complete provenance.
- Tests proving the GAN cannot set expected outcomes or self-certify success.
- Existing PRAETOR suite remains unchanged and green.
- No security, robustness, semantic-performance, or operational claims.
- Human review before any phase beyond instrument validation.

This document records a future research direction only. It does not authorize
implementation, experimental collection, or modification of frozen PRAETOR
artifacts.
