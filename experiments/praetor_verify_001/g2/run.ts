import { verifyFreeze } from './freeze.js';
import { fixtures } from './fixtures.js';
import { evaluatePairs, metrics, passes } from './evaluate.js';
import { CONFIG, sha256 } from './contract.js';
import { G0_FIXTURES } from '../fixtures.js';
import { evaluateClaims, calculateMetrics } from '../evaluate.js';
import { G1_PAIRS, evaluateG1Pairs, calculateG1Metrics } from '../g1.js';

const freeze = verifyFreeze();
const records = evaluatePairs(fixtures());
const measured = metrics(records);
const g0 = calculateMetrics(evaluateClaims(G0_FIXTURES), G0_FIXTURES);
const g1 = calculateG1Metrics(evaluateG1Pairs(), G1_PAIRS);
const baselinePass = g0.verifier_overreach_rate === 0 && g0.replay_consistency
  && g1.verifier_overreach_rate === 0 && g1.abstention_correctness_rate === 1
  && g1.eligible_certification_accuracy === 1 && g1.boundary_transition_accuracy === 1 && g1.replay_consistency;
const validated = baselinePass && passes(records, measured);
const artifact = {
  instrument: CONFIG.version, status: 'PILOT / SYNTHETIC INSTRUMENT VALIDATION ONLY',
  validation: validated ? 'G2 VALIDATED' : 'G2 NOT VALIDATED',
  live_study: 'NOT STARTED', experimental_observations: 0,
  limitations: 'Pressure envelope isolation in the existing oracle-derived VERIFY harness; no live semantic or independent efficacy evidence.',
  freeze, records, metrics: measured, preserved_baselines: { g0, g1 }
};
process.stdout.write(`${JSON.stringify({ ...artifact, artifact_fingerprint: sha256(artifact) }, null, 2)}\n`);
if (!validated) process.exitCode = 1;