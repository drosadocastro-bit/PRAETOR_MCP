import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EvidenceStoreError, LocalEvidenceStore, type StoreArtifactMetadata } from '../../experiments/post_g3b/evidence_store/index.js';

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'praetor-evidence-store-'));
  temporaryRoots.push(root);
  return root;
}

function metadata(overrides: Partial<StoreArtifactMetadata> = {}): StoreArtifactMetadata {
  return {
    artifact_id: 'authority-artifact-001',
    media_type: 'application/json',
    logical_type: 'AUTHORITY_DECISION',
    experiment_id: 'SYNTHETIC-RECOVERY-001',
    phase: 'VALIDATION',
    created_at: '2026-09-14T12:00:00.000Z',
    authority_role: 'IMPLEMENTATION_GATE',
    original_path: 'synthetic/authority.json',
    retention_class: 'AUTHORITY',
    ...overrides
  };
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('local content-addressed evidence store', () => {
  it('recovers exact bytes after the working-tree copy is deleted and verifies the manifest graph', async () => {
    const sandbox = await temporaryRoot();
    const workingPath = join(sandbox, 'working', 'authority.json');
    const recoveredPath = join(sandbox, 'recovered', 'authority.json');
    const bytes = Buffer.from('{"decision":"BLOCK","authority":"human"}\n', 'utf8');
    await mkdir(join(sandbox, 'working'), { recursive: true });
    await writeFile(workingPath, bytes);
    const store = new LocalEvidenceStore({
      root: join(sandbox, 'tier-2'),
      replicas: [{ replica_id: 'independent-local-archive', root: join(sandbox, 'tier-3'), tier: 3 }]
    });

    const record = await store.storeArtifact(await readFile(workingPath), metadata());
    expect(record.sha256).toBe(digest(bytes));
    expect(record.availability_status).toBe('AVAILABLE_VERIFIED');
    expect((await store.availabilityGate(record.sha256)).qualified).toBe(true);

    await rm(workingPath);
    const recovered = await store.getArtifact(record.sha256);
    await mkdir(join(sandbox, 'recovered'), { recursive: true });
    await writeFile(recoveredPath, recovered, { flag: 'wx' });
    expect(await readFile(recoveredPath)).toEqual(bytes);

    const exported = await store.exportManifest('2026-09-14T13:00:00.000Z');
    expect(exported.manifest).not.toHaveProperty('manifest_sha256');
    expect(exported.manifest.artifacts[0]?.manifest_sha256).toBeNull();
    expect(await store.verifyManifest(exported.sha256)).toMatchObject({ valid: true, graph_complete: true, replicas_complete: true });
  });

  it('fails closed for a known hash whose exact bytes were never stored', async () => {
    const sandbox = await temporaryRoot();
    const store = new LocalEvidenceStore({ root: join(sandbox, 'tier-2') });
    const knownSha = digest(Buffer.from('missing exact authority bytes', 'utf8'));

    expect(await store.artifactExists(knownSha)).toBe(false);
    expect(await store.verifyArtifact(knownSha)).toMatchObject({ registered: false, availability_status: 'MISSING' });
    expect(await store.availabilityGate(knownSha)).toMatchObject({ qualified: false, status: 'RECOVERY_REQUIRED' });
    await expect(store.getArtifact(knownSha)).rejects.toMatchObject({ code: 'artifact_unavailable' });
  });

  it('does not accept semantically similar bytes as the identity referenced by another hash', async () => {
    const sandbox = await temporaryRoot();
    const store = new LocalEvidenceStore({ root: join(sandbox, 'tier-2') });
    const original = Buffer.from('{"decision":"BLOCK","reason":"missing authority"}\n', 'utf8');
    const substitute = Buffer.from('{"reason":"missing authority","decision":"BLOCK"}\n', 'utf8');
    await store.storeArtifact(substitute, metadata());

    expect(digest(substitute)).not.toBe(digest(original));
    await expect(store.getArtifact(digest(original))).rejects.toBeInstanceOf(EvidenceStoreError);
  });

  it('marks a degraded replica set as recovery-required while retaining exact-byte retrieval', async () => {
    const sandbox = await temporaryRoot();
    const store = new LocalEvidenceStore({
      root: join(sandbox, 'tier-2'),
      replicas: [{ replica_id: 'archive', root: join(sandbox, 'tier-3'), tier: 3 }]
    });
    const bytes = Buffer.from('immutable authority bytes', 'utf8');
    const record = await store.storeArtifact(bytes, metadata());
    const replicas = await store.listReplicas(record.sha256);
    await rm(replicas[0]!.path);

    expect(await store.verifyReplicaSet(record.sha256)).toMatchObject({ complete: false });
    expect(await store.verifyArtifact(record.sha256)).toMatchObject({ availability_status: 'RECOVERY_REQUIRED', integrity_status: 'DEGRADED' });
    expect(await store.availabilityGate(record.sha256)).toMatchObject({ qualified: false, status: 'RECOVERY_REQUIRED' });
    expect(await store.getArtifact(record.sha256)).toEqual(bytes);
  });

  it('detects corruption and retrieves only a hash-matching replica', async () => {
    const sandbox = await temporaryRoot();
    const store = new LocalEvidenceStore({
      root: join(sandbox, 'tier-2'),
      replicas: [{ replica_id: 'archive', root: join(sandbox, 'tier-3'), tier: 3 }]
    });
    const bytes = Buffer.from('exact bytes', 'utf8');
    const record = await store.storeArtifact(bytes, metadata());
    const primary = (await store.verifyArtifact(record.sha256)).locations.find(location => location.tier === 2)!;
    await writeFile(primary.path, 'corrupt bytes', 'utf8');

    expect(await store.verifyArtifact(record.sha256)).toMatchObject({ availability_status: 'RECOVERY_REQUIRED', integrity_status: 'DEGRADED' });
    expect(await store.getArtifact(record.sha256)).toEqual(bytes);
  });

  it('requires explicit supersession when two byte identities claim the same active logical role', async () => {
    const sandbox = await temporaryRoot();
    const store = new LocalEvidenceStore({ root: join(sandbox, 'tier-2') });
    const first = await store.storeArtifact(Buffer.from('first', 'utf8'), metadata());

    await expect(store.storeArtifact(Buffer.from('first', 'utf8'), metadata({ artifact_id: 'authority-artifact-alias' })))
      .rejects.toMatchObject({ code: 'logical_role_conflict' });
    await expect(store.storeArtifact(Buffer.from('second', 'utf8'), metadata({ artifact_id: 'authority-artifact-002' })))
      .rejects.toMatchObject({ code: 'logical_role_conflict' });

    const second = await store.storeArtifact(
      Buffer.from('second', 'utf8'),
      metadata({ artifact_id: 'authority-artifact-002', supersedes_sha256: first.sha256 })
    );
    expect(second.availability_status).toBe('AVAILABLE_VERIFIED');
    expect((await store.exportManifest('2026-09-14T14:00:00.000Z')).manifest.artifacts).toHaveLength(2);
  });
});
