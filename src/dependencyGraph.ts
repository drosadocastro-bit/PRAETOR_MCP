import type { EvidenceIndependence, EvidenceItem } from './types.js';

export interface DependencyGraphReport extends EvidenceIndependence {
  circular_evidence_risk: boolean;
  edges: Array<{ evidence_id: string; source_id: string; derived_from?: string; upstream_assumption?: string }>;
}

export function analyzeEvidenceIndependence(evidence: EvidenceItem[]): DependencyGraphReport {
  const sourceCounts = new Map<string, number>();
  for (const item of evidence) {
    sourceCounts.set(item.source_id, (sourceCounts.get(item.source_id) ?? 0) + 1);
  }

  const sharedSourceIds = [...sourceCounts.entries()].filter(([, count]) => count > 1).map(([sourceId]) => sourceId);
  const independentSourceCount = new Set(evidence.map(item => item.derived_from_source_id ?? item.source_id)).size;
  const circularEvidenceRisk = sharedSourceIds.length > 0 || evidence.some(item => Boolean(item.derived_from_source_id || item.upstream_assumption));
  const dependencyRisk = circularEvidenceRisk ? (independentSourceCount <= 1 ? 'high' : 'medium') : 'low';

  return {
    independent_source_count: independentSourceCount,
    total_evidence_count: evidence.length,
    shared_source_ids: sharedSourceIds,
    dependency_risk: dependencyRisk,
    notes: circularEvidenceRisk
      ? 'Consensus is not independent evidence; one or more evidence items reuse a source or upstream assumption.'
      : 'Evidence items map to distinct synthetic source lineages.',
    circular_evidence_risk: circularEvidenceRisk,
    edges: evidence.map((item, index) => ({
      evidence_id: `EV-${index + 1}`,
      source_id: item.source_id,
      derived_from: item.derived_from_source_id,
      upstream_assumption: item.upstream_assumption
    }))
  };
}
