import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { CONFIG, byteHash, canonical, sha256, PRESSURE_TAXONOMY, FAILURE_TYPES } from './contract.js';
import { fixtures } from './fixtures.js';
import { METRIC_DEFINITIONS } from './evaluate.js';
import { REGISTRY_VERSION, VERIFIER_REGISTRY } from '../verifierRegistry.js';
import { ORACLE_VERSION } from '../oracle.js';
import { TAXONOMY_VERSION } from '../claimTaxonomy.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const prefix = 'experiments/praetor_verify_001/g2/';
function fileHash(path: string) { return byteHash(readFileSync(resolve(root, path))); }
function treeHash(path: string): string {
  const entries = readdirSync(resolve(root, path), { withFileTypes: true }).sort((first, second) => first.name < second.name ? -1 : first.name > second.name ? 1 : 0);
  return sha256(entries.map(entry => ({ name: entry.name, hash: entry.isDirectory() ? treeHash(`${path}/${entry.name}`) : fileHash(`${path}/${entry.name}`) })));
}
export function verifyProtected(): Record<string, string> {
  const protectedFiles = JSON.parse(readFileSync(new URL('./protected-baseline.json', import.meta.url), 'utf8')) as Record<string, string>;
  for (const [path, expected] of Object.entries(protectedFiles)) {
    if (fileHash(path) !== expected) throw new Error(`Protected baseline changed: ${path}`);
  }
  return protectedFiles;
}
export function snapshot() {
  const dataset = fixtures();
  const sourceFiles = ['contract.ts', 'fixtures.ts', 'evaluate.ts', 'freeze.ts', 'run.ts', 'preregister.ts', 'protected-baseline.json'].map(name => `${prefix}${name}`);
  sourceFiles.push('test/praetor-verify-001-g2.test.ts', 'test/praetor-verify-001.test.ts', 'test/praetor-verify-001-g1.test.ts');
  return {
    instrument: CONFIG.version, phase: 'G2', status: 'FROZEN BEFORE EXECUTION', date: '2026-09-08',
    protected_files: verifyProtected(), protected_core_tree: treeHash('src'),
    source_hashes: Object.fromEntries(sourceFiles.map(path => [path, fileHash(path)])),
    components: {
      fixture_dataset: sha256(dataset), pressure_taxonomy: sha256(PRESSURE_TAXONOMY),
      expected_outcomes: sha256(dataset.map(pair => ({ pair_id: pair.pair_id, expected: pair.expected }))),
      proof_obligations: sha256(dataset.map(pair => ({ pair_id: pair.pair_id, obligation: pair.control.claim.proof_obligation ?? null }))),
      registry: sha256({ version: REGISTRY_VERSION, registry: VERIFIER_REGISTRY }),
      oracle: sha256({ version: ORACLE_VERSION, source: fileHash('experiments/praetor_verify_001/oracle.ts') }),
      taxonomy: sha256({ version: TAXONOMY_VERSION, source: fileHash('experiments/praetor_verify_001/claimTaxonomy.ts') }),
      metrics: sha256(METRIC_DEFINITIONS), failure_signatures: sha256(FAILURE_TYPES), configuration: sha256(CONFIG)
    }
  };
}
export function verifyFreeze() {
  const stored = JSON.parse(readFileSync(new URL('./freeze.json', import.meta.url), 'utf8'));
  const current = snapshot();
  if (canonical(stored) !== canonical(current)) throw new Error('G2 freeze mismatch: do not execute or replace the manifest; issue a versioned amendment.');
  return { fingerprint: sha256(stored), manifest: current };
}