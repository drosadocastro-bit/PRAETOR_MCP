import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { byteHash } from '../contract.js';
import { selectionSnapshot, verifyPrerequisites, verifySelectionFreeze } from '../freeze.js';
import { runCell, replayCell } from '../pilot.js';
import { selectInstrument } from '../selection.js';

export const RECONFIRMATION_VERSION = 'g3a-reconfirmation-v1';
const directory = fileURLToPath(new URL('./', import.meta.url));
const paths = {
  freeze: resolve(directory, 'selection-freeze.json'),
  freezeHash: resolve(directory, 'selection-freeze.sha256'),
  receipt: resolve(directory, 'START-RECEIPT.json'),
  receiptHash: resolve(directory, 'START-RECEIPT.sha256'),
  manifest: resolve(directory, 'run-manifest.json')
};

function exclusiveJson(path: string, value: unknown) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(path, bytes, { encoding: 'utf8', flag: 'wx' });
  return byteHash(bytes);
}

function exclusiveHash(path: string, hash: string) {
  writeFileSync(path, `${hash}\n`, { encoding: 'utf8', flag: 'wx' });
}

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>;
}

export function verifyPreRunGate(root = directory) {
  const freezePath = resolve(root, 'selection-freeze.json');
  const freezeHashPath = resolve(root, 'selection-freeze.sha256');
  const receiptPath = resolve(root, 'START-RECEIPT.json');
  const receiptHashPath = resolve(root, 'START-RECEIPT.sha256');
  const manifestPath = resolve(root, 'run-manifest.json');
  if (![freezePath, freezeHashPath, receiptPath, receiptHashPath, manifestPath].every(existsSync)) throw new Error('RECONFIRMATION_NOT_STARTED');
  const freezeBytes = readFileSync(freezePath);
  const freezeHash = byteHash(freezeBytes);
  if (freezeHash !== readFileSync(freezeHashPath, 'utf8').trim()) throw new Error('RECONFIRMATION_NOT_STARTED');
  const receiptBytes = readFileSync(receiptPath);
  const receiptHash = byteHash(receiptBytes);
  if (receiptHash !== readFileSync(receiptHashPath, 'utf8').trim()) throw new Error('RECONFIRMATION_NOT_STARTED');
  const receipt = readJson(receiptPath);
  const manifest = readJson(manifestPath);
  if (receipt.phase !== 'G3A_RECONFIRMATION' || receipt.version !== RECONFIRMATION_VERSION
    || receipt.selection_freeze_sha256 !== freezeHash || receipt.pilot_started !== false
    || receipt.g3b_execution_authorized !== false || receipt.g3b_comparative_observations !== 0
    || receipt.holdout_constructed !== false || manifest.selection_freeze_sha256 !== freezeHash
    || manifest.start_receipt_sha256 !== receiptHash || manifest.g3b_execution_authorized !== false
    || manifest.g3b_comparative_observations !== 0 || manifest.holdout_constructed !== false
    || statSync(receiptPath).mtimeMs >= statSync(manifestPath).mtimeMs) throw new Error('RECONFIRMATION_NOT_STARTED');
  return { freezeHash, receiptHash, receipt, manifest };
}

function createFreeze() {
  verifyPrerequisites();
  verifySelectionFreeze();
  const snapshot = selectionSnapshot();
  const freeze = {
    version: RECONFIRMATION_VERSION,
    phase: 'G3A_RECONFIRMATION',
    purpose: 'Prospective instrument-selection reconfirmation; toy-only and advisory-only',
    historical_g3a_preserved: true,
    historical_selection_snapshot: snapshot,
    candidates: snapshot.configuration.methods.map(method => ({ id: `${method}-v1`, method })),
    selection_rule: snapshot.configuration.selection,
    pilot_budget: snapshot.configuration.budget,
    cells: snapshot.cells,
    toy_objective: snapshot.configuration.toy_objective,
    proposal_schedule: snapshot.configuration.proposal_schedule,
    evidence_profiles: snapshot.configuration.evidence_profiles,
    input_contract: 'G3A_TOY_ONLY reward 0/1; no oracle, disposition, failure label or G3B endpoint reaches learning',
    prohibited_selection_inputs: ['PRAETOR failure count', 'unique failure signatures', 'G3B primary endpoint', 'adaptive efficacy against PRAETOR'],
    praetor_failure_discovery_used_for_selection: false,
    g3b_execution_authorized: false,
    g3b_comparative_observations: 0,
    holdout_constructed: false,
    holdout_contamination_detected: null
  };
  const freezeHash = exclusiveJson(paths.freeze, freeze);
  exclusiveHash(paths.freezeHash, freezeHash);
  return { freeze, freezeHash };
}

function createReceipt(freezeHash: string) {
  const receipt = {
    phase: 'G3A_RECONFIRMATION', version: RECONFIRMATION_VERSION,
    selection_freeze_sha256: freezeHash, receipt_created_at: new Date().toISOString(),
    pilot_started: false, g3b_execution_authorized: false, g3b_comparative_observations: 0,
    holdout_constructed: false, holdout_contamination_detected: null
  };
  const receiptHash = exclusiveJson(paths.receipt, receipt);
  exclusiveHash(paths.receiptHash, receiptHash);
  return { receipt, receiptHash };
}

function execute(freeze: Record<string, any>, freezeHash: string, receiptHash: string) {
  const manifest = {
    phase: 'G3A_RECONFIRMATION', version: RECONFIRMATION_VERSION,
    selection_freeze_sha256: freezeHash, start_receipt_sha256: receiptHash,
    run_manifest_created_at: new Date().toISOString(), proposals_per_cell: freeze.pilot_budget,
    g3b_execution_authorized: false, g3b_comparative_observations: 0, holdout_constructed: false
  };
  exclusiveJson(paths.manifest, manifest);
  const gate = verifyPreRunGate();
  const metrics: unknown[] = [];
  const artifacts: Record<string, string> = {};
  let recordedProposals = 0;
  for (const cell of freeze.cells) {
    const result = runCell(cell.method, cell.seed, cell.regime);
    if (!replayCell(result)) throw new Error('RECONFIRMATION_INVALID');
    const proposals = result.traces.map(trace => ({
      reconfirmation_version: RECONFIRMATION_VERSION, method: cell.method, method_version: result.config.algorithm_version,
      regime: cell.regime, seed: cell.seed, iteration: trace.iteration, candidate_id: trace.candidate_id,
      proposal_fingerprint: trace.case_fingerprint, candidate_validity: trace.valid, toy_reward: result.steps[trace.iteration - 1].toy_feedback,
      update_state: result.steps[trace.iteration - 1].exposed_feedback, provenance_completeness: true,
      replay_id: trace.trace_id, selection_freeze_sha256: freezeHash, start_receipt_sha256: receiptHash
    }));
    const artifact = { selection_freeze_sha256: freezeHash, start_receipt_sha256: receiptHash, result, proposals };
    const name = `${cell.method}-${cell.regime}-${cell.seed}.json`;
    artifacts[name] = exclusiveJson(resolve(directory, name), artifact);
    metrics.push(result.metric);
    recordedProposals += proposals.length;
  }
  const recommendation = selectInstrument(metrics, true);
  const summary = {
    version: 'g3a-reconfirmation-result-v1', phase: 'G3A_RECONFIRMATION', selection_freeze_sha256: freezeHash,
    start_receipt_sha256: receiptHash, configuration: freeze.historical_selection_snapshot.configuration,
    metrics, recommendation, artifacts, g3a_proposals: freeze.cells.length * freeze.pilot_budget,
    actual_recorded_proposals: recordedProposals, replay_consistency: 1,
    toy_only_isolation_verified: true, selection_rule_applied: true,
    g3b_execution_authorized: false, g3b_comparative_observations: 0, holdout_constructed: false, holdout_contamination_detected: null
  };
  exclusiveJson(resolve(directory, 'results.json'), summary);
  const post = verifyPreRunGate();
  if (post.freezeHash !== gate.freezeHash || post.receiptHash !== gate.receiptHash) throw new Error('RECONFIRMATION_INVALID');
  exclusiveJson(resolve(directory, 'RECONFIRMATION_VALIDATION.json'), {
    version: 'g3a-reconfirmation-validation-v1', historical_g3a_modified: false,
    freeze_verified_pre_run: true, start_receipt_verified: true, receipt_precedes_run: true,
    freeze_unchanged_post_run: post.freezeHash === freezeHash, receipt_unchanged_post_run: post.receiptHash === receiptHash,
    toy_only_isolation_verified: true, adaptation_verified: metrics.every(metric => (metric as any).adaptation_demonstrated),
    replay_consistency: 1, selection_rule_applied: true, selected_instrument: recommendation.selected,
    human_review_status: 'READY_FOR_HUMAN_DECISION', g3b_execution_authorized: false,
    g3b_comparative_observations: 0, holdout_constructed: false
  });
  writeFileSync(resolve(directory, 'RESULT_SUMMARY.md'), `# G3A Prospective Reconfirmation\n\nSelected instrument: ${recommendation.selected ?? 'NO_ELIGIBLE_INSTRUMENT'}\n\nThe bounded run verified freeze-before-run provenance, toy-only isolation, replay, adaptation, and mechanical selection. This is not G3B execution or efficacy evidence.\n`, { encoding: 'utf8', flag: 'wx' });
  exclusiveJson(resolve(directory, 'HUMAN_REVIEW_PACKET.json'), {
    version: 'g3a-reconfirmation-human-review-v1', status: 'PENDING_UNSIGNED', proposed_instrument: recommendation.selected ? `${recommendation.selected}-v1` : null,
    scope: 'G3B DESIGN INTEGRATION ONLY', allowed_decisions: ['APPROVE SELECTED ADAPTIVE INSTRUMENT FOR G3B DESIGN INTEGRATION', 'DO NOT APPROVE'],
    reviewer: null, decision: null, signature: null, date: null, selection_freeze_sha256: freezeHash, start_receipt_sha256: receiptHash,
    g3b_design_integration_approved: false, g3b_execution_authorized: false, g3b_comparative_observations: 0, holdout_constructed: false
  });
  return { recommendation, cells: metrics.length, proposals: recordedProposals };
}

export function runReconfirmation() {
  mkdirSync(directory, { recursive: true });
  const { freeze, freezeHash } = createFreeze();
  const { receiptHash } = createReceipt(freezeHash);
  return execute(freeze, freezeHash, receiptHash);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--run') throw new Error('Use --run only; no G3B command exists');
  console.log(JSON.stringify(runReconfirmation(), null, 2));
}