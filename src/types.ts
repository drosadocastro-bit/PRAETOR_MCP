export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface SyntheticMaintenanceRecord {
  record_id: string;
  equipment_id: string;
  subsystem: string;
  component: string;
  event_date: string;
  event_type: string;
  anomaly_code: string;
  severity: Severity;
  technician_note: string;
  corrective_action: string;
  recurrence_count: number;
  source_id: string;
  source_type: string;
  confidence_hint: number;
  independence_group: string;
  assessment: 'elevated' | 'stable' | 'normal' | 'uncertain';
}

export interface SyntheticSourceMetadata {
  source_id: string;
  source_type: string;
  timestamp: string;
  title: string;
  provenance_metadata: string;
  independence_group: string;
  uncertainty_notes: string[];
}

export interface SyntheticDocumentExcerpt {
  excerpt_id: string;
  source_id: string;
  source_type: string;
  timestamp: string;
  equipment_id: string;
  anomaly_code: string;
  excerpt: string;
  provenance_metadata: string;
  uncertainty_notes: string[];
  independence_group: string;
}

export interface SyntheticPriorCase {
  case_id: string;
  source_id: string;
  source_type: string;
  timestamp: string;
  equipment_id: string;
  anomaly_code: string;
  finding: string;
  excerpt: string;
  provenance_metadata: string;
  uncertainty_notes: string[];
  independence_group: string;
}

export interface EvidenceItem {
  source_id: string;
  source_type: string;
  timestamp: string;
  excerpt: string;
  provenance_metadata: string;
  uncertainty_notes: string[];
  independence_group: string;
  assessment?: 'elevated' | 'stable' | 'normal' | 'uncertain';
  confidence_hint?: number;
}

export type IntegrityVerdict = 'safe' | 'doubtful' | 'unsafe' | 'untrusted';

export interface GuardrailResult {
  check:
    | 'evidence_presence'
    | 'provenance_required'
    | 'confidence_boundary'
    | 'human_review_boundary'
    | 'mission_boundary'
    | 'false_consensus'
    | 'contradiction_handling';
  status: 'pass' | 'flag' | 'block';
  detail: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AdvisoryPacketDraft {
  packet_id: string;
  finding: string;
  equipment_id: string;
  subsystem?: string;
  component?: string;
  supporting_evidence: EvidenceItem[];
  confidence: number;
  uncertainty: string[];
  human_review_required: boolean;
  advisory_only_statement: string;
  guardrail_results?: GuardrailResult[];
}

export interface AdvisoryPacketRecord extends AdvisoryPacketDraft {
  source_ids: string[];
  evidence_summary: string;
  contradiction_status: 'present' | 'not_detected';
  circular_evidence_status: 'present' | 'not_detected';
  integrity_verdict: IntegrityVerdict;
  integrity_summary: string;
  stored_at: string;
  guardrail_results: GuardrailResult[];
}

export interface IntegrityDimensionScores {
  evidence_support: number;
  provenance_integrity: number;
  confidence_discipline: number;
  contradiction_handling: number;
  human_review_boundary: number;
  mission_drift: number;
  circular_evidence_risk: number;
  reconstructability: number;
}

export interface IntegrityAssessment {
  verdict: IntegrityVerdict;
  dimension_scores: IntegrityDimensionScores;
  guardrail_results: GuardrailResult[];
  summary: string;
  capped_confidence: number;
  human_review_required: boolean;
}
