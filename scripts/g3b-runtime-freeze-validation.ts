import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { executeNonHoldoutValidation, runtimeManifest } from '../experiments/praetor_verify_001/g3b/runtime.js';

const outputRoot = resolve('experiments/praetor_verify_001/g3b');
const runnerCommitSha = process.env.G3B_VALIDATION_COMMIT_SHA ?? 'uncommitted-working-tree';
const observations = [];
for (const regime of ['G3-observable', 'G3-white-box'] as const) {
  for (const seed of [0, 1] as const) {
    for (const arm of ['random', 'rule_based'] as const) {
      observations.push(executeNonHoldoutValidation(arm, regime, seed, 0, runnerCommitSha));
    }
  }
}
const replay = executeNonHoldoutValidation('random', 'G3-observable', 0, 0, runnerCommitSha);
const replayAgain = executeNonHoldoutValidation('random', 'G3-observable', 0, 0, runnerCommitSha);
const replayExact = ['input_hash', 'configuration_hash', 'output', 'oracle_output'].every(field => JSON.stringify(replay[field as keyof typeof replay]) === JSON.stringify(replayAgain[field as keyof typeof replayAgain]));
const validation = {
  version: 'g3b-runtime-freeze-validation-v1', experiment_id: 'PRAETOR-VERIFY-001', runner_version: 'g3b-executable-runtime-v1',
  runner_commit_sha: runnerCommitSha, validation_scope: 'instrument_validation_only', holdout_access_status: 'NOT_ACCESSED',
  holdout_evaluated: false, execution_performed: false, comparative_observations: 0, validation_observations: observations.length,
  arms_validated: ['random', 'rule_based'], adaptive_status: 'BLOCKED_REAUTHORIZATION_REQUIRED',
  replay: { status: replayExact ? 'PASS' : 'FAIL', exact_fields: ['input_hash', 'configuration_hash', 'output', 'oracle_output'] },
  parity: { status: observations.every(observation => observation.provenance.holdout_access === false && observation.provenance.oracle_feedback_exposed === false) ? 'PASS' : 'FAIL' },
  oracle_isolation: { status: observations.every(observation => observation.provenance.oracle_feedback_exposed === false) ? 'PASS' : 'FAIL' },
  evidence_preserved_before_aggregation: true,
  stopping_events: [],
  review_required: ['adaptive action-to-candidate mapping', 'validation evaluator-path equivalence'],
  observations
};
writeFileSync(resolve(outputRoot, 'G3B_EXECUTABLE_RUNTIME_MANIFEST.json'), `${JSON.stringify(runtimeManifest(), null, 2)}\n`, 'utf8');
writeFileSync(resolve(outputRoot, 'G3B_RUNTIME_FREEZE_VALIDATION.json'), `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ manifest: runtimeManifest(), validation: { ...validation, observations: undefined } }, null, 2));
