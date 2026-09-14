export type ArtifactAvailabilityStatus =
  | 'AVAILABLE_VERIFIED'
  | 'AVAILABLE_UNVERIFIED'
  | 'MISSING'
  | 'CORRUPT'
  | 'RECOVERY_REQUIRED';

export type ArtifactIntegrityStatus = 'CONFIRMED' | 'DEGRADED' | 'FAILED' | 'UNKNOWN';

export type RetentionClass = 'RESEARCH' | 'AUTHORITY' | 'PERMANENT';

export interface EvidenceStoreReplica {
  replica_id: string;
  root: string;
  tier: 3;
}

export interface ArtifactStorageLocation {
  store_id: string;
  replica_id: string;
  tier: 2 | 3;
  root: string;
  relative_path: string;
}

export interface StoreArtifactMetadata {
  artifact_id: string;
  media_type: string;
  logical_type: string;
  experiment_id: string;
  phase: string;
  created_at: string;
  authority_role: string;
  original_path: string;
  retention_class: RetentionClass;
  predecessor_sha256?: string;
  supersedes_sha256?: string;
}

export interface StoredArtifactRecord extends StoreArtifactMetadata {
  sha256: string;
  byte_length: number;
  storage_locations: ArtifactStorageLocation[];
  availability_status: ArtifactAvailabilityStatus;
  integrity_status: ArtifactIntegrityStatus;
  /** Kept null inside the manifest to avoid circular self-certification. */
  manifest_sha256: null;
}

export interface StorageLocationVerification extends ArtifactStorageLocation {
  path: string;
  exists: boolean;
  hash_matches: boolean;
  observed_sha256: string | null;
}

export interface ArtifactVerification {
  sha256: string;
  registered: boolean;
  byte_length: number | null;
  availability_status: ArtifactAvailabilityStatus;
  integrity_status: ArtifactIntegrityStatus;
  locations: StorageLocationVerification[];
}

export interface ArtifactAvailabilityGate {
  sha256: string;
  qualified: boolean;
  status: ArtifactAvailabilityStatus;
  checks: {
    IDENTITY_CONFIRMED: boolean;
    BYTES_AVAILABLE: boolean;
    INTEGRITY_CONFIRMED: boolean;
    RETENTION_REGISTERED: boolean;
  };
  failures: string[];
}

export interface ReplicaSetVerification {
  sha256: string;
  complete: boolean;
  replicas: StorageLocationVerification[];
}

export interface EvidenceManifest {
  schema_version: 'praetor-evidence-manifest-v1';
  store_id: string;
  exported_at: string;
  stores: Array<{
    store_id: string;
    replica_id: string;
    tier: 2 | 3;
    root: string;
  }>;
  artifacts: StoredArtifactRecord[];
}

export interface ExportedManifest {
  manifest: EvidenceManifest;
  sha256: string;
  bytes: Uint8Array;
  locations: ArtifactStorageLocation[];
}

export interface ManifestVerification {
  sha256: string;
  valid: boolean;
  identity_confirmed: boolean;
  structure_valid: boolean;
  graph_complete: boolean;
  replicas_complete: boolean;
  artifact_gates_passed: boolean;
  failures: string[];
}
