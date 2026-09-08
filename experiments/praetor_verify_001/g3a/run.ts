import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { byteHash, canonical, sha256 } from './contract.js';
import { selectionSnapshot, verifySelectionFreeze } from './freeze.js';
import { runCell, replayCell } from './pilot.js';
import { selectInstrument } from './selection.js';

const artifactDirectory = fileURLToPath(new URL('./pilot-v1/', import.meta.url));
function writeExclusive(name: string, value: unknown) {
  const encoded = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(resolve(artifactDirectory, name), encoded, { encoding: 'utf8', flag: 'wx' });
  return byteHash(encoded);
}
const command = process.argv[2];
if (process.argv.length !== 3 || !['--snapshot', '--run', '--replay'].includes(command)) throw new Error('Use --snapshot, --run or --replay only; no G3B command exists');
if (command === '--snapshot') {
  console.log(JSON.stringify(selectionSnapshot(), null, 2));
} else {
  const frozen = verifySelectionFreeze();
  if (command === '--run') {
    mkdirSync(artifactDirectory);
    writeExclusive('STARTED.json', { phase: 'G3A', selection_freeze_sha256: frozen.sha256, started_at: new Date().toISOString(), g3b_execution_authorized: false });
    const metrics = [];
    const artifacts: Record<string, string> = {};
    let recordedProposals = 0;
    for (const cell of frozen.snapshot.cells) {
      const result = runCell(cell.method, cell.seed, cell.regime);
      const name = `${cell.method}-${cell.regime}-${cell.seed}.json`;
      artifacts[name] = writeExclusive(name, { selection_freeze_sha256: frozen.sha256, ...result });
      metrics.push(result.metric);
      recordedProposals += result.traces.length;
      console.log(`${name}: ${result.metric.budget_compliance === 1 && !result.metric.runtime_stopped ? 'RECORDED' : 'INSTRUMENT_STOP_RECORDED'}`);
    }
    const recommendation = selectInstrument(metrics, true);
    const summary = { version: 'g3a-selection-result-v1', phase: 'G3A', selection_freeze_sha256: frozen.sha256,
      configuration: frozen.snapshot.configuration, metrics, recommendation, artifacts,
      metric_provenance: 'Computed from preserved traces, generation steps and runtime measurements; no efficacy fields supplied to selector',
      g3a_proposals: frozen.snapshot.cells.length * frozen.snapshot.configuration.budget,
      actual_recorded_proposals: recordedProposals,
      g3b_execution_authorized: false, g3b_comparative_observations: 0, holdout_constructed: false, holdout_contamination_detected: null };
    const summaryHash = writeExclusive('summary.json', summary);
    writeExclusive('result-fingerprint.json', { summary_sha256: summaryHash, canonical_summary_sha256: sha256(summary), selection_freeze_sha256: frozen.sha256 });
    console.log(JSON.stringify({ recommendation, summary_sha256: summaryHash, cells: metrics.length }, null, 2));
  } else {
    const summaryBytes = readFileSync(resolve(artifactDirectory, 'summary.json'));
    const summary = JSON.parse(summaryBytes.toString('utf8'));
    const fingerprint = JSON.parse(readFileSync(resolve(artifactDirectory, 'result-fingerprint.json'), 'utf8'));
    if (byteHash(summaryBytes) !== fingerprint.summary_sha256 || sha256(summary) !== fingerprint.canonical_summary_sha256 || summary.selection_freeze_sha256 !== frozen.sha256) throw new Error('Result fingerprint mismatch');
    let cells = 0;
    for (const [name, hash] of Object.entries(summary.artifacts)) {
      if (!/^(tabular|bandit|evolutionary)-G3-(observable|white-box)-10[1-5]\.json$/.test(name)) throw new Error('Invalid artifact path');
      const bytes = readFileSync(resolve(artifactDirectory, name));
      if (byteHash(bytes) !== hash) throw new Error(`Artifact changed: ${name}`);
      if (!replayCell(JSON.parse(bytes.toString('utf8')))) throw new Error(`Replay inconsistency: ${name}`);
      cells += 1;
    }
    if (cells !== frozen.snapshot.cells.length || canonical(selectInstrument(summary.metrics, true)) !== canonical(summary.recommendation)) throw new Error('Selection reconstruction mismatch');
    console.log(JSON.stringify({ phase: 'G3A', replayed_cells: cells, replay_consistency: 1, selection_reconstructed: true, g3b_comparative_observations: 0 }, null, 2));
  }
}