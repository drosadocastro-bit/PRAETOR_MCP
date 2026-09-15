import { fileURLToPath } from 'node:url';
import { assertHoldoutRemainsUntouched, writeG3BRuntimePrevalidationArtifact } from '../experiments/praetor_verify_001/g3b/prevalidation.js';

assertHoldoutRemainsUntouched();
const artifact = writeG3BRuntimePrevalidationArtifact(fileURLToPath(new URL('../experiments/praetor_verify_001/g3b/G3B_RUNTIME_PREVALIDATION.json', import.meta.url)));
console.log(JSON.stringify({ runtime_prevalidation: artifact.runtime_prevalidation, eligibility: artifact.eligibility, gates: Object.fromEntries(Object.entries(artifact.gates).map(([name, gate]) => [name, gate.status])), holdout_access_status: artifact.holdout_access_status, comparative_observations: artifact.comparative_observations, human_authorization: artifact.human_authorization }, null, 2));
