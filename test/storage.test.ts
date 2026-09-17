import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { appendAdvisoryPacket, readAdvisoryPackets, StorageError } from '../src/storage.js';
import type { AdvisoryPacketRecord } from '../src/types.js';

async function temporaryStore(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), 'praetor-storage-')), 'advisory-packets.ndjson');
}

function validRecord(): AdvisoryPacketRecord {
  return {
    packet_id: 'PKT-STORAGE',
    advisory_id: 'ADV-STORAGE',
    equipment_id: 'PRA-STORAGE',
    subsystem: 'hydraulic',
    component: 'pump seal',
    finding: 'Synthetic review finding.',
    evidence_summary: 'Synthetic evidence summary.',
    source_ids: ['SRC-STORAGE-A', 'SRC-STORAGE-B'],
    provenance: 'Synthetic storage fixture.',
    supporting_evidence: [{
      source_id: 'SRC-STORAGE-A',
      source_type: 'synthetic_log',
      timestamp: '2026-07-01T00:00:00.000Z',
      excerpt: 'Synthetic observation.',
      provenance_metadata: 'Synthetic provenance.',
      uncertainty_notes: ['Review only.'],
      independence_group: 'STORAGE-A',
      derived_from_source_id: 'SRC-ROOT',
      upstream_assumption: 'Synthetic source lineage.',
      declared_paraphrase_group: 'PARAPHRASE-1'
    }],
    confidence: 0.31,
    uncertainty: ['Synthetic only.'],
    contradiction_status: 'not_detected',
    circular_evidence_status: 'not_detected',
    human_review_required: true,
    advisory_only_statement: 'Advisory only; human review required.',
    guardrail_results: [{
      check: 'evidence_presence',
      guardrail: 'evidence presence',
      status: 'pass',
      detail: 'Evidence is present.',
      severity: 'low',
      reason: 'Synthetic fixture.',
      affected_fields: ['supporting_evidence'],
      recommended_action: 'Review the evidence.'
    }],
    integrity_verdict: 'doubtful',
    integrity_summary: 'Stored for review.',
    stored_at: '2026-07-02T00:00:00.000Z',
    evidence_independence: {
      independent_source_count: 1,
      total_evidence_count: 1,
      shared_source_ids: [],
      dependency_risk: 'low',
      notes: 'Synthetic dependency graph.',
      repeated_excerpt_count: 0,
      circular_evidence_risk: false,
      edges: [{
        evidence_id: 'SRC-STORAGE-A',
        source_id: 'SRC-STORAGE-A',
        derived_from: 'SRC-ROOT',
        upstream_assumption: 'Synthetic source lineage.'
      }]
    }
  };
}

describe('storage integrity handling', () => {
  it('round-trips validated packet and dependency metadata without changing confidence', async () => {
    const storePath = await temporaryStore();
    const record = validRecord();

    await appendAdvisoryPacket(record, storePath);

    await expect(readAdvisoryPackets(storePath)).resolves.toEqual([record]);
  });

  it('returns empty history only when the store is missing', async () => {
    await expect(readAdvisoryPackets(await temporaryStore())).resolves.toEqual([]);
  });

  it('raises a typed error for malformed JSON', async () => {
    const storePath = await temporaryStore();
    await writeFile(storePath, '{"packet_id":"partial"', 'utf8');

    await expect(readAdvisoryPackets(storePath)).rejects.toMatchObject({
      name: 'StorageError',
      code: 'storage_error',
      message: expect.stringContaining('malformed JSON')
    });
  });

  it('raises a typed error for a partial-write line', async () => {
    const storePath = await temporaryStore();
    await writeFile(storePath, '{"packet_id":"complete"}\n{"packet_id":"truncated"', 'utf8');

    await expect(readAdvisoryPackets(storePath)).rejects.toBeInstanceOf(StorageError);
  });

  it('raises a typed error for malformed decoded records', async () => {
    const storePath = await temporaryStore();
    await writeFile(storePath, `${JSON.stringify({ packet_id: 'not-a-valid-record' })}\n`, 'utf8');

    await expect(readAdvisoryPackets(storePath)).rejects.toMatchObject({
      code: 'storage_error',
      message: expect.stringContaining('failed schema validation')
    });
  });

  it('raises a typed error for read failures instead of returning empty history', async () => {
    const directoryPath = await mkdtemp(join(tmpdir(), 'praetor-storage-directory-'));

    await expect(readAdvisoryPackets(directoryPath)).rejects.toMatchObject({
      name: 'StorageError',
      code: 'storage_error'
    });
  });

  it('raises a typed error for append failures', async () => {
    const directoryPath = await mkdtemp(join(tmpdir(), 'praetor-storage-append-directory-'));

    await expect(appendAdvisoryPacket({} as never, directoryPath)).rejects.toMatchObject({
      name: 'StorageError',
      code: 'storage_error',
      message: 'Unable to append advisory packet storage.'
    });
  });
});
