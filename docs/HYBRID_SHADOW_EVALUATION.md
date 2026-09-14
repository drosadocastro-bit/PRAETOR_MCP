# Hybrid Shadow Evaluation

**Status:** HYBRID_SHADOW_RESEARCH_CANDIDATE
**Mode:** OFFLINE / SHADOW / NON-AUTHORITATIVE / NON-MCP-EXPOSED

The legacy hybrid worktree was audited read-only and was not merged. This
module selectively recovers comparison and disagreement concepts while keeping
current PRAETOR deterministic governance unchanged. Its implementation lives
under `experiments/hybrid_shadow/hybridShadowEvaluation.ts`, outside the
historically frozen runtime tree.

## Legacy audit

| Legacy element | Classification | Disposition |
|---|---|---|
| Typed signals, evidence roots, and lineage | USEFUL_CONCEPT | Reduced to explicit evidence-lineage and input fingerprints in each shadow record. |
| Deterministic hard boundary | USEFUL_CONCEPT | Preserved by taking the final authority decision only from `evaluateAdvisoryPacket`. |
| Semantic observation separated from governance | DUPLICATES_CURRENT_V6_1 | Current v6.1 observation, availability, trace, and fingerprint contracts win. |
| Generic `HttpSemanticJudge` | OBSOLETE_IMPLEMENTATION | Not ported; LM Studio v6.1 remains the only supported semantic adapter contract. |
| `FixedSemanticJudge` and implicit fake mode | OBSOLETE_IMPLEMENTATION | Not ported; tests inject transport responses into the current adapter explicitly. |
| Correlation attenuation (`1/N`, confidence cap `0.75`) | UNKNOWN | Not ported; the heuristic was not calibrated or evidence of statistical independence. |
| PISO/MEDIO/TECHO authoritative fusion | UNSAFE_TO_PORT | Replaced by one non-authoritative shadow comparison. |
| Runtime containment and output-gate invocation from the evaluator | DUPLICATES_CURRENT_V6_1 | Runtime boundaries remain in their current modules and are not duplicated. |
| `evaluate_hybrid` MCP tool | UNSAFE_TO_PORT | Explicitly absent from `tools.ts`; the existing MCP list remains unchanged. |
| Ablation reports without gold-label claims | USEFUL_CONCEPT | Retained as bounded aggregate metrics, without superiority claims. |

## Execution model

```text
advisory packet
  |-- evaluateAdvisoryPacket ----------------------> final authority decision
  |
  `-- semantic-only projection
        -> current LM Studio v6.1 judge
        -> semantic observation + trace
        -> disagreement classification
        -> append-only shadow record (optional)
```

The semantic projection contains the finding, evidence excerpts, evidence
summary, and uncertainty context. It does not expose provenance authority or
permission fields. The v6.1 adapter continues to preserve model,
configuration, prompt, request, response, and canonical-payload fingerprints.

## Disagreement matrix

| Semantic observation | Deterministic outcome | Classification | Authority result |
|---|---|---|---|
| safe | allow | `AGREE_SAFE` | deterministic allow |
| block | block | `AGREE_BLOCK` | deterministic block |
| safe | block | `SEMANTIC_SAFE_DETERMINISTIC_BLOCK` | deterministic block |
| block | allow | `SEMANTIC_BLOCK_DETERMINISTIC_ALLOW` | deterministic allow; review candidate only |
| low confidence or invalid schema | either | `SEMANTIC_UNCERTAIN` | deterministic result |
| execution error | either | `SHADOW_ERROR` | deterministic result |
| omitted or unavailable judge | either | `JUDGE_UNAVAILABLE` | deterministic result |

Disagreement is not automatically a failure. “False-positive candidate” and
“false-negative candidate” are investigation labels relative to deterministic
behavior, not ground-truth error findings.

## Metrics

`summarizeHybridShadow` reports agreement and disagreement rates, judge
availability, schema failures, latency, input-token observations when exposed,
deterministic containment, candidate cases, and trace completeness. Output-token
usage remains `null` because the current trace contract does not expose it.

`appendHybridShadowRecord` writes only to an explicitly supplied path. No
default runtime write, automatic network call, or MCP endpoint is introduced.
Generated NDJSON under `experiments/hybrid_shadow/` is ignored by Git unless a
future review deliberately freezes it.

## Authority invariants

Hybrid shadow evaluation may observe, compare, classify disagreement, log, and
aggregate metrics. It cannot grant permission, override denial, modify policy,
authorize execution, widen authority, or self-certify evidence. Every record
states that its authority effect is zero and that the final result came from
`evaluateAdvisoryPacket` unchanged.

This module does not establish predictive value, calibrated error rates,
hybrid superiority, safety improvement, production readiness, or live-study
results.
