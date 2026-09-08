import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { byteHash } from '../g3a/contract.js';

const root = fileURLToPath(new URL('./', import.meta.url));
export function assertG3BExecutionBlocked() {
  const required = ['G3B_PRE_EXECUTION_MANIFEST.json', 'G3B_HUMAN_EXECUTION_AUTHORIZATION.json', 'G3B_START-RECEIPT.json', 'G3B_START-RECEIPT.sha256'];
  if (!required.every(name => existsSync(resolve(root, name)))) throw new Error('G3B_EXECUTION_BLOCKED');
  const manifest = JSON.parse(readFileSync(resolve(root, 'G3B_PRE_EXECUTION_MANIFEST.json'), 'utf8'));
  const authorization = JSON.parse(readFileSync(resolve(root, 'G3B_HUMAN_EXECUTION_AUTHORIZATION.json'), 'utf8'));
  const receipt = JSON.parse(readFileSync(resolve(root, 'G3B_START-RECEIPT.json'), 'utf8'));
  const receiptBytes = readFileSync(resolve(root, 'G3B_START-RECEIPT.json'));
  if (byteHash(receiptBytes) !== readFileSync(resolve(root, 'G3B_START-RECEIPT.sha256'), 'utf8').trim()) throw new Error('G3B_EXECUTION_BLOCKED');
  const lock = manifest.G3B_EXECUTION_LOCK_SHA256;
  const componentHashes = manifest.components as Record<string, string> | undefined;
  const componentPath = (name: string) => name.includes('/') ? resolve(root, '..', name) : resolve(root, name);
  if (!lock || !componentHashes || Object.entries(componentHashes).some(([name]) => !existsSync(componentPath(name)))) throw new Error('G3B_EXECUTION_BLOCKED');
  const actualHashes = Object.fromEntries(Object.keys(componentHashes).map(name => [name, byteHash(readFileSync(componentPath(name)))]));
  if (JSON.stringify(actualHashes) !== JSON.stringify(componentHashes) || receipt.execution_lock_sha256 !== lock || authorization.execution_authorized !== true || manifest.g3b_execution_authorized !== true || receipt.human_g3b_authorization_signed !== true || manifest.execution_ready !== true) throw new Error('G3B_EXECUTION_BLOCKED');
  return { lock, observations: 0 };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) assertG3BExecutionBlocked();