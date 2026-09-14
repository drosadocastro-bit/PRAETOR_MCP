import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

import { canonicalJson } from './canonicalJson.js';
import type {
  ArtifactAvailabilityGate,
  ArtifactAvailabilityStatus,
  ArtifactIntegrityStatus,
  ArtifactStorageLocation,
  ArtifactVerification,
  EvidenceManifest,
  EvidenceStoreReplica,
  ExportedManifest,
  ManifestVerification,
  ReplicaSetVerification,
  StorageLocationVerification,
  StoreArtifactMetadata,
  StoredArtifactRecord
} from './types.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REPLICA_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const EVENT_SCHEMA = 'praetor-evidence-store-event-v1';

interface ArtifactStoredEvent {
  schema_version: typeof EVENT_SCHEMA;
  event_type: 'ARTIFACT_STORED';
  event_id: string;
  recorded_at: string;
  artifact: Omit<StoredArtifactRecord, 'availability_status' | 'integrity_status'>;
}

export class EvidenceStoreError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'EvidenceStoreError';
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function validateSha(value: string): string {
  const normalized = value.toLowerCase();
  if (!SHA256_PATTERN.test(normalized)) throw new EvidenceStoreError('invalid_sha256', 'SHA-256 must be 64 lowercase or uppercase hexadecimal characters.');
  return normalized;
}

function requireNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) throw new EvidenceStoreError('invalid_metadata', `${field} must not be empty.`);
}

function validateMetadata(metadata: StoreArtifactMetadata): void {
  for (const field of ['artifact_id', 'media_type', 'logical_type', 'experiment_id', 'phase', 'authority_role', 'original_path'] as const) {
    requireNonEmpty(metadata[field], field);
  }
  if (Number.isNaN(Date.parse(metadata.created_at))) throw new EvidenceStoreError('invalid_metadata', 'created_at must be an ISO-compatible timestamp.');
  if (metadata.predecessor_sha256) validateSha(metadata.predecessor_sha256);
  if (metadata.supersedes_sha256) validateSha(metadata.supersedes_sha256);
}

function normalizedMetadata(metadata: StoreArtifactMetadata): StoreArtifactMetadata {
  const normalized: StoreArtifactMetadata = {
    artifact_id: metadata.artifact_id,
    media_type: metadata.media_type,
    logical_type: metadata.logical_type,
    experiment_id: metadata.experiment_id,
    phase: metadata.phase,
    created_at: metadata.created_at,
    authority_role: metadata.authority_role,
    original_path: metadata.original_path,
    retention_class: metadata.retention_class
  };
  if (metadata.predecessor_sha256) normalized.predecessor_sha256 = metadata.predecessor_sha256.toLowerCase();
  if (metadata.supersedes_sha256) normalized.supersedes_sha256 = metadata.supersedes_sha256.toLowerCase();
  return normalized;
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT';
}

function isAlreadyPresent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'EEXIST';
}

export interface LocalEvidenceStoreOptions {
  root: string;
  store_id?: string;
  replicas?: readonly EvidenceStoreReplica[];
}

export class LocalEvidenceStore {
  readonly root: string;
  readonly store_id: string;
  readonly replicas: readonly EvidenceStoreReplica[];

  constructor(options: LocalEvidenceStoreOptions) {
    this.root = resolve(options.root);
    this.store_id = options.store_id ?? 'praetor-local-evidence-store';
    requireNonEmpty(this.store_id, 'store_id');
    this.replicas = (options.replicas ?? []).map(replica => ({ ...replica, root: resolve(replica.root) }));
    const ids = new Set<string>();
    for (const replica of this.replicas) {
      if (!REPLICA_ID_PATTERN.test(replica.replica_id)) throw new EvidenceStoreError('invalid_replica_id', `Invalid replica id: ${replica.replica_id}`);
      if (ids.has(replica.replica_id)) throw new EvidenceStoreError('duplicate_replica_id', `Duplicate replica id: ${replica.replica_id}`);
      if (replica.root === this.root) throw new EvidenceStoreError('invalid_replica_root', 'A Tier 3 replica must use a root distinct from Tier 2.');
      ids.add(replica.replica_id);
    }
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(join(this.root, 'artifacts', 'sha256'), { recursive: true }),
      mkdir(join(this.root, 'manifests'), { recursive: true }),
      mkdir(join(this.root, 'metadata'), { recursive: true }),
      ...this.replicas.flatMap(replica => [
        mkdir(join(replica.root, 'artifacts', 'sha256'), { recursive: true }),
        mkdir(join(replica.root, 'manifests'), { recursive: true })
      ])
    ]);
  }

  async storeArtifact(bytes: Uint8Array, metadata: StoreArtifactMetadata): Promise<StoredArtifactRecord> {
    validateMetadata(metadata);
    const normalized = normalizedMetadata(metadata);
    await this.initialize();
    const digest = sha256(bytes);
    const events = await this.readEvents();
    this.assertArtifactIdIsImmutable(events, normalized, digest);
    this.assertLogicalRoleIsUnambiguous(events, normalized, digest);

    const locations = this.artifactLocations(digest);
    await Promise.all(locations.map(location => this.writeImmutable(this.absolutePath(location), bytes, digest)));

    const existing = events.find(event => event.artifact.artifact_id === metadata.artifact_id);
    if (!existing) {
      const event: ArtifactStoredEvent = {
        schema_version: EVENT_SCHEMA,
        event_type: 'ARTIFACT_STORED',
        event_id: randomUUID(),
        recorded_at: new Date().toISOString(),
        artifact: {
          ...normalized,
          sha256: digest,
          byte_length: bytes.byteLength,
          storage_locations: locations,
          manifest_sha256: null
        }
      };
      const eventHandle = await open(this.eventLogPath(), 'a');
      try {
        await eventHandle.writeFile(`${canonicalJson(event)}\n`, 'utf8');
        await eventHandle.sync();
      } finally {
        await eventHandle.close();
      }
    }

    const verification = await this.verifyArtifact(digest);
    return {
      ...normalized,
      sha256: digest,
      byte_length: bytes.byteLength,
      storage_locations: locations,
      availability_status: verification.availability_status,
      integrity_status: verification.integrity_status,
      manifest_sha256: null
    };
  }

  async getArtifact(sha: string): Promise<Uint8Array> {
    const digest = validateSha(sha);
    for (const location of this.artifactLocations(digest)) {
      try {
        const bytes = await readFile(this.absolutePath(location));
        if (sha256(bytes) === digest) return bytes;
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
    throw new EvidenceStoreError('artifact_unavailable', `No exact, hash-matching bytes are available for ${digest}.`);
  }

  async verifyArtifact(sha: string): Promise<ArtifactVerification> {
    const digest = validateSha(sha);
    const events = await this.readEvents();
    const registered = events.some(event => event.artifact.sha256 === digest);
    const locations = await Promise.all(this.artifactLocations(digest).map(location => this.verifyLocation(location, digest)));
    const validCount = locations.filter(location => location.hash_matches).length;
    const corruptCount = locations.filter(location => location.exists && !location.hash_matches).length;
    const allValid = validCount === locations.length;

    let availability: ArtifactAvailabilityStatus;
    let integrity: ArtifactIntegrityStatus;
    if (!registered) {
      availability = validCount > 0 ? 'AVAILABLE_UNVERIFIED' : corruptCount > 0 ? 'CORRUPT' : 'MISSING';
      integrity = validCount > 0 ? 'UNKNOWN' : corruptCount > 0 ? 'FAILED' : 'UNKNOWN';
    } else if (allValid) {
      availability = 'AVAILABLE_VERIFIED';
      integrity = 'CONFIRMED';
    } else if (validCount > 0) {
      availability = 'RECOVERY_REQUIRED';
      integrity = 'DEGRADED';
    } else if (corruptCount > 0) {
      availability = 'CORRUPT';
      integrity = 'FAILED';
    } else {
      availability = 'MISSING';
      integrity = 'UNKNOWN';
    }

    const record = events.find(event => event.artifact.sha256 === digest)?.artifact;
    return {
      sha256: digest,
      registered,
      byte_length: record?.byte_length ?? null,
      availability_status: availability,
      integrity_status: integrity,
      locations
    };
  }

  async artifactExists(sha: string): Promise<boolean> {
    const digest = validateSha(sha);
    for (const location of this.artifactLocations(digest)) {
      try {
        await stat(this.absolutePath(location));
        return true;
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
    return false;
  }

  async listReplicas(sha: string): Promise<StorageLocationVerification[]> {
    const digest = validateSha(sha);
    return Promise.all(this.artifactLocations(digest).filter(location => location.tier === 3).map(location => this.verifyLocation(location, digest)));
  }

  async verifyReplicaSet(sha: string): Promise<ReplicaSetVerification> {
    const digest = validateSha(sha);
    const replicas = await Promise.all(this.artifactLocations(digest).map(location => this.verifyLocation(location, digest)));
    return { sha256: digest, complete: replicas.every(replica => replica.hash_matches), replicas };
  }

  async availabilityGate(sha: string): Promise<ArtifactAvailabilityGate> {
    const verification = await this.verifyArtifact(sha);
    const checks = {
      IDENTITY_CONFIRMED: SHA256_PATTERN.test(verification.sha256),
      BYTES_AVAILABLE: verification.locations.some(location => location.hash_matches),
      INTEGRITY_CONFIRMED: verification.integrity_status === 'CONFIRMED',
      RETENTION_REGISTERED: verification.registered
    };
    const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([check]) => check);
    return {
      sha256: verification.sha256,
      qualified: failures.length === 0 && verification.availability_status === 'AVAILABLE_VERIFIED',
      status: verification.availability_status === 'MISSING' || verification.availability_status === 'CORRUPT'
        ? 'RECOVERY_REQUIRED'
        : verification.availability_status,
      checks,
      failures
    };
  }

  async exportManifest(exportedAt = new Date().toISOString()): Promise<ExportedManifest> {
    await this.initialize();
    const events = await this.readEvents();
    const artifacts: StoredArtifactRecord[] = [];
    for (const event of events) {
      const verification = await this.verifyArtifact(event.artifact.sha256);
      artifacts.push({
        ...event.artifact,
        availability_status: verification.availability_status,
        integrity_status: verification.integrity_status
      });
    }
    artifacts.sort((left, right) => left.artifact_id.localeCompare(right.artifact_id));
    const manifest: EvidenceManifest = {
      schema_version: 'praetor-evidence-manifest-v1',
      store_id: this.store_id,
      exported_at: exportedAt,
      stores: this.storeDescriptors(),
      artifacts
    };
    const bytes = Buffer.from(`${canonicalJson(manifest)}\n`, 'utf8');
    const digest = sha256(bytes);
    const locations = this.manifestLocations(digest);
    await Promise.all(locations.map(location => this.writeImmutable(this.absolutePath(location), bytes, digest)));
    return { manifest, sha256: digest, bytes, locations };
  }

  async verifyManifest(sha: string): Promise<ManifestVerification> {
    const digest = validateSha(sha);
    const failures: string[] = [];
    const locations = this.manifestLocations(digest);
    const verifiedLocations = await Promise.all(locations.map(location => this.verifyLocation(location, digest)));
    const replicasComplete = verifiedLocations.every(location => location.hash_matches);
    const source = verifiedLocations.find(location => location.hash_matches);
    if (!source) {
      return {
        sha256: digest,
        valid: false,
        identity_confirmed: false,
        structure_valid: false,
        graph_complete: false,
        replicas_complete: false,
        artifact_gates_passed: false,
        failures: ['MANIFEST_BYTES_UNAVAILABLE']
      };
    }

    let manifest: EvidenceManifest | null = null;
    let identityConfirmed = false;
    try {
      const bytes = await readFile(source.path);
      identityConfirmed = sha256(bytes) === digest;
      manifest = JSON.parse(bytes.toString('utf8')) as EvidenceManifest;
    } catch {
      failures.push('MANIFEST_PARSE_FAILED');
    }
    const structureValid = this.isManifestStructureValid(manifest);
    if (!identityConfirmed) failures.push('MANIFEST_IDENTITY_MISMATCH');
    if (!structureValid) failures.push('MANIFEST_STRUCTURE_INVALID');
    if (!replicasComplete) failures.push('MANIFEST_REPLICA_SET_DEGRADED');

    let graphComplete = false;
    let artifactGatesPassed = false;
    if (manifest && structureValid) {
      graphComplete = this.isGraphCompleteAndUnambiguous(manifest.artifacts);
      if (!graphComplete) failures.push('ARTIFACT_GRAPH_INCOMPLETE_OR_AMBIGUOUS');
      const gates = await Promise.all([...new Set(manifest.artifacts.map(artifact => artifact.sha256))].map(artifactSha => this.availabilityGate(artifactSha)));
      artifactGatesPassed = gates.every(gate => gate.qualified);
      if (!artifactGatesPassed) failures.push('ARTIFACT_AVAILABILITY_GATE_FAILED');
    }

    return {
      sha256: digest,
      valid: failures.length === 0,
      identity_confirmed: identityConfirmed,
      structure_valid: structureValid,
      graph_complete: graphComplete,
      replicas_complete: replicasComplete,
      artifact_gates_passed: artifactGatesPassed,
      failures
    };
  }

  private artifactLocations(sha: string): ArtifactStorageLocation[] {
    const relativePath = join('artifacts', 'sha256', sha.slice(0, 2), sha);
    return [
      { store_id: this.store_id, replica_id: 'tier2-primary', tier: 2, root: this.root, relative_path: relativePath },
      ...this.replicas.map(replica => ({ store_id: this.store_id, replica_id: replica.replica_id, tier: replica.tier, root: replica.root, relative_path: relativePath }))
    ];
  }

  private manifestLocations(sha: string): ArtifactStorageLocation[] {
    const relativePath = join('manifests', `${sha}.json`);
    return [
      { store_id: this.store_id, replica_id: 'tier2-primary', tier: 2, root: this.root, relative_path: relativePath },
      ...this.replicas.map(replica => ({ store_id: this.store_id, replica_id: replica.replica_id, tier: replica.tier, root: replica.root, relative_path: relativePath }))
    ];
  }

  private storeDescriptors(): EvidenceManifest['stores'] {
    return [
      { store_id: this.store_id, replica_id: 'tier2-primary', tier: 2, root: this.root },
      ...this.replicas.map(replica => ({ store_id: this.store_id, replica_id: replica.replica_id, tier: replica.tier, root: replica.root }))
    ];
  }

  private absolutePath(location: ArtifactStorageLocation): string {
    const candidate = resolve(location.root, location.relative_path);
    const relation = relative(resolve(location.root), candidate);
    if (relation.startsWith('..') || resolve(location.root) === candidate) throw new EvidenceStoreError('unsafe_storage_path', 'Resolved storage path escaped its configured root.');
    return candidate;
  }

  private eventLogPath(): string {
    return join(this.root, 'metadata', 'artifact-events.ndjson');
  }

  private async writeImmutable(path: string, bytes: Uint8Array, expectedSha: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    let handle;
    try {
      handle = await open(path, 'wx');
      await handle.writeFile(bytes);
      await handle.sync();
    } catch (error) {
      if (!isAlreadyPresent(error)) throw error;
      const existing = await readFile(path);
      if (sha256(existing) !== expectedSha) {
        throw new EvidenceStoreError('immutable_path_conflict', `Existing immutable path does not match ${expectedSha}.`);
      }
    } finally {
      await handle?.close();
    }
  }

  private async verifyLocation(location: ArtifactStorageLocation, expectedSha: string): Promise<StorageLocationVerification> {
    const path = this.absolutePath(location);
    try {
      const bytes = await readFile(path);
      const observed = sha256(bytes);
      return { ...location, relative_path: location.relative_path, exists: true, hash_matches: observed === expectedSha, observed_sha256: observed, path };
    } catch (error) {
      if (!isMissing(error)) throw error;
      return { ...location, relative_path: location.relative_path, exists: false, hash_matches: false, observed_sha256: null, path };
    }
  }

  private async readEvents(): Promise<ArtifactStoredEvent[]> {
    let text: string;
    try {
      text = await readFile(this.eventLogPath(), 'utf8');
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
    const events: ArtifactStoredEvent[] = [];
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (line.trim().length === 0) continue;
      try {
        const event = JSON.parse(line) as ArtifactStoredEvent;
        if (event.schema_version !== EVENT_SCHEMA || event.event_type !== 'ARTIFACT_STORED' || !event.artifact) throw new Error('schema');
        validateSha(event.artifact.sha256);
        events.push(event);
      } catch {
        throw new EvidenceStoreError('metadata_log_corrupt', `Metadata event line ${index + 1} is invalid; manifest generation is blocked.`);
      }
    }
    return events;
  }

  private assertArtifactIdIsImmutable(events: readonly ArtifactStoredEvent[], metadata: StoreArtifactMetadata, digest: string): void {
    const existing = events.find(event => event.artifact.artifact_id === metadata.artifact_id);
    if (!existing) return;
    const comparable = normalizedMetadata(metadata);
    const existingMetadata = {
      artifact_id: existing.artifact.artifact_id,
      media_type: existing.artifact.media_type,
      logical_type: existing.artifact.logical_type,
      experiment_id: existing.artifact.experiment_id,
      phase: existing.artifact.phase,
      created_at: existing.artifact.created_at,
      authority_role: existing.artifact.authority_role,
      original_path: existing.artifact.original_path,
      retention_class: existing.artifact.retention_class,
      ...(existing.artifact.predecessor_sha256 ? { predecessor_sha256: existing.artifact.predecessor_sha256 } : {}),
      ...(existing.artifact.supersedes_sha256 ? { supersedes_sha256: existing.artifact.supersedes_sha256 } : {})
    };
    if (existing.artifact.sha256 !== digest || canonicalJson(comparable) !== canonicalJson(existingMetadata)) {
      throw new EvidenceStoreError('artifact_id_conflict', `Artifact id ${metadata.artifact_id} is already bound to different immutable content or metadata.`);
    }
  }

  private assertLogicalRoleIsUnambiguous(events: readonly ArtifactStoredEvent[], metadata: StoreArtifactMetadata, digest: string): void {
    const superseded = new Set(events.map(event => event.artifact.supersedes_sha256).filter((value): value is string => Boolean(value)));
    const conflict = events.find(event => {
      const artifact = event.artifact;
      return !superseded.has(artifact.sha256)
        && artifact.artifact_id !== metadata.artifact_id
        && artifact.experiment_id === metadata.experiment_id
        && artifact.phase === metadata.phase
        && artifact.logical_type === metadata.logical_type
        && artifact.authority_role === metadata.authority_role;
    });
    if (conflict && (conflict.artifact.sha256 === digest || metadata.supersedes_sha256?.toLowerCase() !== conflict.artifact.sha256)) {
      throw new EvidenceStoreError('logical_role_conflict', `Logical role already has active artifact ${conflict.artifact.sha256}; explicit supersedes_sha256 is required.`);
    }
  }

  private isManifestStructureValid(manifest: EvidenceManifest | null): manifest is EvidenceManifest {
    return Boolean(
      manifest
      && manifest.schema_version === 'praetor-evidence-manifest-v1'
      && manifest.store_id === this.store_id
      && Array.isArray(manifest.stores)
      && Array.isArray(manifest.artifacts)
      && !('manifest_sha256' in manifest)
      && manifest.artifacts.every(artifact => SHA256_PATTERN.test(artifact.sha256) && artifact.manifest_sha256 === null)
    );
  }

  private isGraphCompleteAndUnambiguous(artifacts: readonly StoredArtifactRecord[]): boolean {
    const hashes = new Set(artifacts.map(artifact => artifact.sha256));
    const referencesComplete = artifacts.every(artifact =>
      (!artifact.predecessor_sha256 || hashes.has(artifact.predecessor_sha256))
      && (!artifact.supersedes_sha256 || hashes.has(artifact.supersedes_sha256))
    );
    const superseded = new Set(artifacts.map(artifact => artifact.supersedes_sha256).filter((value): value is string => Boolean(value)));
    const activeRoles = new Set<string>();
    for (const artifact of artifacts) {
      if (superseded.has(artifact.sha256)) continue;
      const key = [artifact.experiment_id, artifact.phase, artifact.logical_type, artifact.authority_role].join('\u0000');
      if (activeRoles.has(key)) return false;
      activeRoles.add(key);
    }
    return referencesComplete;
  }
}
