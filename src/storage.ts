import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { AdvisoryPacketRecord } from './types.js';

export function advisoryStorePath(projectRoot = process.cwd()): string {
  return join(projectRoot, 'data', 'advisory-packets.ndjson');
}

export async function appendAdvisoryPacket(record: AdvisoryPacketRecord, storePath = advisoryStorePath()): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  await appendFile(storePath, `${JSON.stringify(record)}\n`, 'utf8');
}

export async function readAdvisoryPackets(storePath = advisoryStorePath()): Promise<AdvisoryPacketRecord[]> {
  try {
    const raw = await readFile(storePath, 'utf8');
    return raw
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => JSON.parse(line) as AdvisoryPacketRecord);
  } catch {
    return [];
  }
}
