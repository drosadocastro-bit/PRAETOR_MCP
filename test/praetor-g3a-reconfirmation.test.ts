import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { byteHash } from '../experiments/praetor_verify_001/g3a/contract.js';
import { verifyPreRunGate } from '../experiments/praetor_verify_001/g3a/reconfirmation-v1/run.js';

describe('G3A reconfirmation receipt gate', () => {
  it('refuses execution when the receipt is missing', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'praetor-reconfirmation-'));
    expect(() => verifyPreRunGate(root)).toThrow('RECONFIRMATION_NOT_STARTED');
  });

  it('refuses execution when the receipt references different freeze bytes', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'praetor-reconfirmation-'));
    const freeze = Buffer.from('{"frozen":true}\n');
    const receipt = Buffer.from(JSON.stringify({ phase: 'G3A_RECONFIRMATION', version: 'g3a-reconfirmation-v1', selection_freeze_sha256: 'wrong', pilot_started: false, g3b_execution_authorized: false, g3b_comparative_observations: 0, holdout_constructed: false }) + '\n');
    writeFileSync(resolve(root, 'selection-freeze.json'), freeze);
    writeFileSync(resolve(root, 'selection-freeze.sha256'), `${byteHash(freeze)}\n`);
    writeFileSync(resolve(root, 'START-RECEIPT.json'), receipt);
    writeFileSync(resolve(root, 'START-RECEIPT.sha256'), `${byteHash(receipt)}\n`);
    writeFileSync(resolve(root, 'run-manifest.json'), JSON.stringify({ selection_freeze_sha256: byteHash(freeze), start_receipt_sha256: byteHash(receipt), g3b_execution_authorized: false, g3b_comparative_observations: 0, holdout_constructed: false }));
    expect(() => verifyPreRunGate(root)).toThrow('RECONFIRMATION_NOT_STARTED');
  });
});