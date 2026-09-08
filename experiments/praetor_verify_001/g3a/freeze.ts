import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifyFreeze as verifyG2 } from '../g2/freeze.js';
import { REGIMES, byteHash, canonical, fingerprints, sha256 } from './contract.js';
import { SEARCH_CONFIG } from './search.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
function fileHash(path: string) { return byteHash(readFileSync(resolve(root, path))); }
function verifyHashes(files: Record<string, string>) {
  for (const [path, hash] of Object.entries(files)) if (fileHash(path) !== hash) throw new Error(`Frozen source changed: ${path}`);
}
export function verifyPrerequisites() {
  const prerequisites = JSON.parse(readFileSync(new URL('./prerequisites.json', import.meta.url), 'utf8'));
  if (prerequisites.g3a_1 !== 'PASS_BOUNDED_EXPERIMENTAL_RUNTIME' || prerequisites.g3a_2 !== 'PASS_SEPARATE_EXPERIMENTAL_DECISION_PATHS'
    || prerequisites.privileged_information_leakage !== false || prerequisites.g3b_execution_authorized !== false) throw new Error('Prerequisite gates not passed');
  verifyHashes(prerequisites.files);
  const g2 = verifyG2().fingerprint;
  if (g2 !== prerequisites.g2_fingerprint) throw new Error('G2 fingerprint changed');
  const g3 = JSON.parse(readFileSync(new URL('../g3/design-freeze.json', import.meta.url), 'utf8'));
  verifyHashes(g3.files);
  verifyHashes(g3.referenced_frozen_baselines);
  return { prerequisites_sha256: sha256(prerequisites), g2, g3_design_sha256: fileHash('experiments/praetor_verify_001/g3/design-freeze.json') };
}
export function selectionSnapshot() {
  const names = ['PROTOCOL.md', 'prerequisites.json', 'contract.ts', 'evaluator.ts', 'oracle.ts', 'comparison.ts',
    'exposure.ts', 'runtime.ts', 'search.ts', 'selection.ts', 'freeze.ts', 'pilot.ts', 'run.ts'];
  const paths = names.map(name => `experiments/praetor_verify_001/g3a/${name}`)
    .concat(['test/praetor-g3a-runtime.test.ts', 'test/praetor-g3a-search.test.ts', 'test/praetor-g3a-pilot.test.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts']);
  return {
    version: 'g3a-selection-freeze-v1', phase: 'G3A', status: 'FROZEN_BEFORE_INSTRUMENT_PILOT',
    prerequisites: verifyPrerequisites(), source_hashes: Object.fromEntries(paths.map(path => [path, fileHash(path)])),
    components: fingerprints(), configuration: SEARCH_CONFIG, configuration_sha256: sha256(SEARCH_CONFIG),
    cells: SEARCH_CONFIG.methods.flatMap(method => REGIMES.flatMap(regime => SEARCH_CONFIG.seeds.map(seed => ({ method, regime, seed, budget: SEARCH_CONFIG.budget })))),
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    g3b_execution_authorized: false, g3b_comparative_observations: 0, holdout_constructed: false, holdout_contamination_detected: null
  };
}
export function verifySelectionFreeze() {
  const stored = JSON.parse(readFileSync(new URL('./selection-freeze.json', import.meta.url), 'utf8'));
  const current = selectionSnapshot();
  if (canonical(current) !== canonical(stored)) throw new Error('Selection freeze mismatch; do not overwrite. Human-reviewed amendment required.');
  return { snapshot: current, sha256: sha256(stored) };
}