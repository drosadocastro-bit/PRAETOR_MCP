# Artifact Durability Model

**Status:** RESEARCH PROTOTYPE
**Scope:** Local exact-byte preservation and recovery
**Production durability claim:** NONE

Artifact durability is part of governance. A hash can prove identity; it
cannot prove availability. Capability does not create authority.

This model responds to the failure exposed by closed G3B without reopening or
repairing that experiment. It provides a bounded local prototype for future
artifacts only.

## Failure model

| Failure | Required behavior |
|---|---|
| Working-tree file deleted or worktree abandoned | Recover exact bytes from Tier 2 or Tier 3 by SHA-256. |
| Branch rewritten or Git unavailable | Storage roots remain independently addressable; Git is not the sole store. |
| Referenced artifact never stored | Return `MISSING`; downstream availability gate returns `RECOVERY_REQUIRED`. |
| Hash known but bytes unavailable | Fail closed; do not reconstruct semantically. |
| Partial backup or missing replica | Return `RECOVERY_REQUIRED` even if one verified copy remains retrievable. |
| Corrupted copy | Mark the location corrupt; read only a replica whose bytes hash exactly. |
| Two byte identities claim one active logical role | Reject unless the new record explicitly identifies `supersedes_sha256`. |
| Semantically similar replacement has different bytes | Treat it as a distinct artifact identity. |
| Manifest absent or integrity mismatch | Manifest verification fails closed. |
| Metadata event log is malformed | Block manifest generation rather than skipping the event. |

## Storage tiers

1. **Tier 1 — working repository.** The original path is recorded as provenance,
   but the repository is not treated as the durable source of bytes.
2. **Tier 2 — local content-addressed store.** Exact bytes are stored under a
   SHA-256-derived path and created with exclusive, no-overwrite semantics.
3. **Tier 3 — independent local archive.** One or more separately configured
   roots receive the same exact bytes and manifest.

A Tier 3 directory on the same host is not an independent disaster-recovery
system. External or cloud storage, host-failure isolation, access control,
encryption, retention enforcement, and backup operations remain unimplemented.

## Artifact record

The prototype records:

- `artifact_id`, `sha256`, and `byte_length`;
- `media_type`, `logical_type`, `experiment_id`, and `phase`;
- `created_at`, `authority_role`, and `original_path`;
- `storage_locations`, `retention_class`, availability, and integrity state;
- optional `predecessor_sha256` and `supersedes_sha256`;
- `manifest_sha256: null` inside the manifest.

The manifest hash is returned in an external envelope and encoded in the
content-addressed manifest filename. It is deliberately absent from the
manifest body, preventing circular self-certification.

## Operations

The implementation is isolated under
`experiments/post_g3b/evidence_store/` so that the historically frozen `src/`
tree remains byte-identical. `LocalEvidenceStore` implements:

- `storeArtifact(bytes, metadata)`;
- `getArtifact(sha256)`;
- `verifyArtifact(sha256)`;
- `artifactExists(sha256)`;
- `listReplicas(sha256)`;
- `verifyReplicaSet(sha256)`;
- `exportManifest()`;
- `verifyManifest(sha256)`;
- `availabilityGate(sha256)`.

Artifact bytes are immutable. Metadata is recorded as append-only NDJSON.
Manifests are deterministic key-order JSON snapshots, stored and replicated by
their exact byte hash. The serializer is intentionally not claimed to be an
RFC 8785 implementation.

## Availability gate

An artifact qualifies for downstream authority reference only when all four
checks pass:

- `IDENTITY_CONFIRMED`;
- `BYTES_AVAILABLE`;
- `INTEGRITY_CONFIRMED`;
- `RETENTION_REGISTERED`.

The observable states are `AVAILABLE_VERIFIED`, `AVAILABLE_UNVERIFIED`,
`MISSING`, `CORRUPT`, and `RECOVERY_REQUIRED`. Missing or corrupt bytes map to a
fail-closed `RECOVERY_REQUIRED` gate result. A degraded replica set also fails
the gate even when exact bytes can still be read from a surviving copy.

## Manifest and artifact graph

The manifest contains storage descriptors and artifact records sufficient to
reconstruct experiment ownership, authority role, predecessor and supersession
edges, exact hashes, locations, and observed availability. Verification checks:

- manifest byte identity and replica completeness;
- schema and non-circular hash structure;
- predecessor and supersession target presence;
- uniqueness of every active logical role;
- the live availability gate for each artifact.

## Prototype limitations

This implementation is process-local research infrastructure. It does not yet
provide multi-process locking, remote replication, transactional coordination
across tiers, automated repair, key management, authentication, operating
system immutability, retention-policy enforcement, or production monitoring.
Directory loss, malicious host access, or simultaneous corruption of all local
tiers can still destroy availability.

The recovery validation is documented in
[`ARTIFACT_DURABILITY_VALIDATION.md`](../ARTIFACT_DURABILITY_VALIDATION.md).
