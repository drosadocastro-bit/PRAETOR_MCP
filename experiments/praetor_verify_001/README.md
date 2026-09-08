# PRAETOR-VERIFY-001: Claim Verifiability and Non-Certification

**Status:** PILOT / INSTRUMENT VALIDATION ONLY  
**Scope:** G0 and G1 bounded synthetic fixtures  
**Core PRAETOR changes:** None

This isolated harness tests whether claims are routed only to verifiers whose
declared capability covers the claim. It does not modify PRAETOR governance,
semantic evaluation, frozen v6/v6.1 artifacts, or prior study outputs.

The central boundary is:

> Non-overridable authority must not be confused with unlimited authority.

Agent K remains authoritative within its deterministic boundary, but it cannot
certify semantic claims, universal safety, future reliability, or complete
controllability. The semantic judge is observational and cannot authorize an
action. Human review is an explicit result, not an error. `NON_CERTIFIED`
means that no legitimate verifier can certify the claim; it does not mean the
claim was proven false and it is distinct from `REJECTED`.

Run the focused G0 tests with:

```sh
npx vitest run test/praetor-verify-001.test.ts
npx vitest run test/praetor-verify-001-g1.test.ts
```

The G1 runner is `npm run pilot:verify-001-g1`. It evaluates eight matched
pairs and reports boundary transition accuracy, abstention correctness,
eligible certification accuracy, overreach, proof-obligation failures, and
replay consistency. It emits JSON to stdout and does not persist result files.

The G0/G1 implementation uses deterministic synthetic fixtures only. It records
claim taxonomy, selected verifier, bounded outcome, provenance, registry and
oracle fingerprints, and replay identifiers. It does not use an LLM or claim
universal protection against verifier overreach.