import { HANDOFF_SCENARIOS, MEMORY_SCENARIOS, PERMISSION_SCENARIOS, PHASE_ONE_SCENARIOS, runHandoffStudy, runMemoryStudy, runPermissionStudy, runPressureStudy, runRepeatedReliabilityStudy, runReliabilityStudy, runToolFailureStudy, TOOL_FAILURE_SCENARIOS } from '../src/research/reliabilityStudy.js';

const results = runReliabilityStudy(PHASE_ONE_SCENARIOS);
const repeated = runRepeatedReliabilityStudy(PHASE_ONE_SCENARIOS, 10);
const summary = results.map(result => ({
  condition: result.condition,
  baseline: {
    accepted: result.baseline.accepted,
    verdict: result.baseline.verdict,
    confidence: result.baseline.confidence,
    human_review_required: result.baseline.human_review_required
  },
  praetor: {
    accepted: result.praetor.accepted,
    verdict: result.praetor.verdict,
    capped_confidence: result.praetor.capped_confidence,
    human_review_required: result.praetor.human_review_required,
    summary: result.praetor.summary
  }
}));

console.log('PRAETOR Behavioral Reliability Study: Phase 1');
console.log('Structural comparison only; claims are bounded to these synthetic conditions.');
console.log(`Repeated identical harness runs: ${repeated.repetitions}; outcome signatures consistent: ${repeated.consistent}.`);
console.log(JSON.stringify(summary, null, 2));
console.log('Tool-failure preservation slice:');
console.log(JSON.stringify(runToolFailureStudy(TOOL_FAILURE_SCENARIOS), null, 2));
console.log('Permission and runtime-denial slice:');
console.log(JSON.stringify(await runPermissionStudy(PERMISSION_SCENARIOS), null, 2));
console.log('Memory and context poisoning slice:');
console.log(JSON.stringify(await runMemoryStudy(MEMORY_SCENARIOS), null, 2));
console.log('Malformed agent handoff slice:');
console.log(JSON.stringify(await runHandoffStudy(HANDOFF_SCENARIOS), null, 2));
console.log('Resource pressure, latency, and governance overhead slice:');
console.log(JSON.stringify(await runPressureStudy(), null, 2));