import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

type JsonObject = Record<string, unknown>;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const freezePath = join(repositoryRoot, 'experiments', 'praetor_verify_001', 'g2', 'freeze.json');
const baselinePath = join(repositoryRoot, 'POST_G3B_APPLICATION_RUNTIME_BASELINE_V1.json');

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new Error('Non-JSON fingerprint input');
    }
    return encoded;
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

function fileHash(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function treeHash(path: string): string {
  const entries = readdirSync(path, { withFileTypes: true })
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  return sha256(entries.map(entry => ({
    name: entry.name,
    hash: entry.isDirectory() ? treeHash(join(path, entry.name)) : fileHash(join(path, entry.name))
  })));
}

type GitDirectory = { files: Set<string>; directories: Map<string, GitDirectory> };

function gitTreeHash(commit: string, root: string): string {
  const output = execFileSync('git', ['ls-tree', '-r', '-z', '--full-tree', commit, '--', root], { cwd: repositoryRoot });
  const rootDirectory: GitDirectory = { files: new Set(), directories: new Map() };
  for (const entry of output.toString('utf8').split('\0').filter(Boolean)) {
    const separator = entry.indexOf('\t');
    const relativePath = entry.slice(separator + 1).replace(`${root}/`, '');
    const pathParts = relativePath.split('/');
    let directory = rootDirectory;
    for (const part of pathParts.slice(0, -1)) {
      let child = directory.directories.get(part);
      if (!child) {
        child = { files: new Set(), directories: new Map() };
        directory.directories.set(part, child);
      }
      directory = child;
    }
    directory.files.add(pathParts.at(-1)!);
  }

  const hashDirectory = (directory: GitDirectory, prefix: string): string => sha256([
    ...Array.from(directory.files).map(name => {
      const content = execFileSync('git', ['show', `${commit}:${prefix}${name}`], { cwd: repositoryRoot });
      const checkoutBytes = Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'utf8');
      return { name, hash: createHash('sha256').update(checkoutBytes).digest('hex') };
    }),
    ...Array.from(directory.directories.entries()).map(([name, child]) => ({ name, hash: hashDirectory(child, `${prefix}${name}/`) }))
  ].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

  return hashDirectory(rootDirectory, `${root}/`);
}

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} is missing or invalid.`);
  }
  return value;
}

function assertValue(value: unknown, expected: string, label: string): void {
  if (value !== expected) {
    throw new Error(`${label} must be ${expected}.`);
  }
}

export function verifyHistoricalG2Archive(): {
  status: 'HISTORICAL_G2_ARCHIVE_INTACT';
  protected_file_count: number;
  source_file_count: number;
  historical_tree_hash: string;
} {
  const freeze = readJson(freezePath);
  const baseline = readJson(baselinePath);
  const protectedFiles = freeze.protected_files as JsonObject;
  const sourceHashes = freeze.source_hashes as JsonObject;
  if (!protectedFiles || !sourceHashes) {
    throw new Error('G2 freeze manifest is missing its historical hash sets.');
  }

  for (const [relativePath, expectedHash] of Object.entries(protectedFiles)) {
    const actualHash = fileHash(join(repositoryRoot, relativePath));
    if (actualHash !== expectedHash) {
      throw new Error(`Historical G2 protected artifact changed: ${relativePath}`);
    }
  }
  for (const [relativePath, expectedHash] of Object.entries(sourceHashes)) {
    const actualHash = fileHash(join(repositoryRoot, relativePath));
    if (actualHash !== expectedHash) {
      throw new Error(`Historical G2 source artifact changed: ${relativePath}`);
    }
  }

  const historicalTreeHash = assertString(freeze.protected_core_tree, 'G2 protected_core_tree');
  const baselineCommit = assertString(baseline.baseline_commit, 'baseline_commit');
  const baselineTreeHash = assertString(baseline.canonical_src_tree_hash, 'canonical_src_tree_hash');
  const archivedTreeHash = gitTreeHash(baselineCommit, 'src');
  if (archivedTreeHash !== historicalTreeHash || archivedTreeHash !== baselineTreeHash) {
    throw new Error(`Historical G2 source archive does not match the canonical freeze or application baseline: ${archivedTreeHash}`);
  }
  return {
    status: 'HISTORICAL_G2_ARCHIVE_INTACT',
    protected_file_count: Object.keys(protectedFiles).length,
    source_file_count: Object.keys(sourceHashes).length,
    historical_tree_hash: historicalTreeHash
  };
}

export function verifyCurrentApplicationBaseline(): {
  status: 'CURRENT_RUNTIME_BASELINE_MATCH' | 'INTENTIONAL_APPLICATION_EVOLUTION';
  baseline_commit: string;
  current_commit: string;
  baseline_src_tree_hash: string;
  current_src_tree_hash: string;
  historical_g2_status: string;
} {
  const baseline = readJson(baselinePath);
  const baselineCommit = assertString(baseline.baseline_commit, 'baseline_commit');
  const baselineTreeHash = assertString(baseline.canonical_src_tree_hash, 'canonical_src_tree_hash');
  const historicalStatus = assertString(baseline.historical_g2_freeze_status, 'historical_g2_freeze_status');
  assertValue(historicalStatus, 'PASS', 'historical_g2_freeze_status');
  assertValue(baseline.classification, 'APPLICATION_RUNTIME_BASELINE', 'classification');
  assertValue(baseline.authority_effect, 'NONE', 'authority_effect');
  assertValue(baseline.research_effect, 'NONE', 'research_effect');
  assertValue(baseline.historical_g2_expected_tree_hash, baselineTreeHash, 'historical_g2_expected_tree_hash');
  const currentCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
  const currentTreeHash = treeHash(join(repositoryRoot, 'src'));
  return {
    status: currentCommit === baselineCommit && currentTreeHash === baselineTreeHash
      ? 'CURRENT_RUNTIME_BASELINE_MATCH'
      : 'INTENTIONAL_APPLICATION_EVOLUTION',
    baseline_commit: baselineCommit,
    current_commit: currentCommit,
    baseline_src_tree_hash: baselineTreeHash,
    current_src_tree_hash: currentTreeHash,
    historical_g2_status: historicalStatus
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const mode = process.argv[2] ?? 'all';
    const result = mode === 'historical'
      ? { historical: verifyHistoricalG2Archive() }
      : mode === 'runtime'
        ? { current: verifyCurrentApplicationBaseline() }
        : mode === 'all'
          ? { historical: verifyHistoricalG2Archive(), current: verifyCurrentApplicationBaseline() }
          : undefined;
    if (!result) {
      throw new Error(`Unknown verification mode '${mode}'. Use historical, runtime, or all.`);
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
