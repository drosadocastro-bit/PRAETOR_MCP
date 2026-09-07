# GSA Submission Checklist

**Claim freeze:** September 6, 2026  
**Current capability:** Dataset Access Server, read-only, synthetic, advisory-only

This checklist packages the three requested submission deliverables without
claiming capabilities that are not implemented.

## 1. GitHub repository

- [x] Local MCP stdio server and structured tools
- [x] Synthetic dataset and provenance metadata
- [x] Deterministic governance and integrity checks
- [x] Review-only local packet persistence
- [x] Frozen demo workflow
- [x] Adapter boundary with explicit unavailable behavior
- [ ] Future Service Read adapter: intentionally not implemented
- [ ] Future Service Write adapter: intentionally not implemented

## 2. Presentation deck

Primary artifact: [GSA_PRESENTATION_DECK.md](GSA_PRESENTATION_DECK.md)

Presentation spine:

1. Problem: advisory language can outrun evidence.
2. Retrieve: collect synthetic evidence and provenance.
3. Challenge: introduce a controlled evidence or caller-claim defect.
4. Bound: deterministic governance constrains or rejects the packet.
5. Close: human authority remains outside the system.

## 3. Evaluation documentation

Primary artifact: [PRAETOR_MCP_EVALUATION.md](PRAETOR_MCP_EVALUATION.md)

Supporting evidence:

- [PRAETOR_MCP_DEMO_WORKFLOW.md](PRAETOR_MCP_DEMO_WORKFLOW.md)
- [PRAETOR_MCP_BENCHMARK_RESULTS.md](PRAETOR_MCP_BENCHMARK_RESULTS.md)
- [PRAETOR_IMPLEMENTATION_ADVERSARIAL_FINDINGS.md](PRAETOR_IMPLEMENTATION_ADVERSARIAL_FINDINGS.md)
- [AGENT_EXPERIMENT_GO_NO_GO.md](AGENT_EXPERIMENT_GO_NO_GO.md)
- [HACKATHON_PITCH_DRAFT.md](HACKATHON_PITCH_DRAFT.md)

The evaluation must report the actual validation run, not a target or expected
result. It must keep synthetic demonstration evidence separate from the
opt-in local-model instrument pilot and from any future government integration.

## Validation commands

```text
npm run check
npm test -- --run
npm run benchmark
npm run test:adversarial:report
npm audit
npm run demo
```

## Claim gate

Before submission, confirm that every public artifact still says:

- Dataset Access is the current demonstrated GSA track;
- Service Read and Service Write are future adapters only;
- all data is synthetic and local;
- no operational action or safety status is produced; and
- no silent adapter fallback or source substitution exists.

The September 23 MCP 101 session is a useful checkpoint for presentation
questions and format guidance. It does not reopen the frozen implementation
claim by itself.
