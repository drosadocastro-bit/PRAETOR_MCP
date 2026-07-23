import type { AdvisoryPacketDraft, EvidenceItem, GuardrailResult, IntegrityAssessment, IntegrityDimensionScores, IntegrityVerdict } from './types.js';

const MISSION_DRIFT_PATTERNS = [
  /must replace/i,
  /confirmed failure/i,
  /system confirms failure/i,
  /maintenance action required/i,
  /authorized corrective action/i,
  /system determines/i,
  /safe to operate/i,
  /unsafe to operate/i
];

function clampConfidence(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function isFullyProvenanced(evidence: EvidenceItem): boolean {
  return Boolean(evidence.source_id && evidence.source_type && evidence.timestamp && evidence.provenance_metadata);
}

function hasContradiction(evidence: EvidenceItem[]): boolean {
  const labels = new Set(evidence.map(item => item.assessment).filter(Boolean));
  return labels.has('elevated') && (labels.has('normal') || labels.has('stable'));
}

function countIndependentGroups(evidence: EvidenceItem[]): number {
  return new Set(evidence.map(item => item.independence_group)).size;
}

function buildGuardrail(check: GuardrailResult['check'], status: GuardrailResult['status'], detail: string, severity: GuardrailResult['severity']): GuardrailResult {
  return { check, status, detail, severity };
}

export function scoreIntegrity(packet: AdvisoryPacketDraft): IntegrityAssessment {
  const evidence = packet.supporting_evidence;
  const guardrail_results: GuardrailResult[] = [];
  let verdict: IntegrityVerdict = 'safe';
  let cappedConfidence = clampConfidence(packet.confidence);
  let human_review_required = packet.human_review_required;

  if (evidence.length === 0) {
    guardrail_results.push(buildGuardrail('evidence_presence', 'block', 'No supporting evidence was supplied.', 'high'));
    return {
      verdict: 'untrusted',
      dimension_scores: {
        evidence_support: 0,
        provenance_integrity: 0,
        confidence_discipline: 0,
        contradiction_handling: 0,
        human_review_boundary: 0,
        mission_drift: 1,
        circular_evidence_risk: 0,
        reconstructability: 0
      },
      guardrail_results,
      summary: 'Rejected because the advisory lacks supporting evidence.',
      capped_confidence: 0,
      human_review_required: true
    };
  }

  if (evidence.some(item => !isFullyProvenanced(item))) {
    guardrail_results.push(buildGuardrail('provenance_required', 'block', 'At least one evidence item is missing provenance metadata.', 'high'));
    verdict = 'untrusted';
    cappedConfidence = Math.min(cappedConfidence, 0.25);
  } else {
    guardrail_results.push(buildGuardrail('provenance_required', 'pass', 'Every evidence item includes source metadata.', 'low'));
  }

  if (evidence.length < 2) {
    guardrail_results.push(buildGuardrail('confidence_boundary', 'flag', 'Single-source evidence is capped to a cautious confidence band.', 'medium'));
    cappedConfidence = Math.min(cappedConfidence, 0.45);
    human_review_required = true;
  } else {
    guardrail_results.push(buildGuardrail('confidence_boundary', 'pass', 'Evidence is sufficiently multi-item to support a review-only advisory.', 'low'));
  }

  const driftMatch = [packet.finding, packet.advisory_only_statement].find(text => MISSION_DRIFT_PATTERNS.some(pattern => pattern.test(text)));
  if (driftMatch) {
    guardrail_results.push(buildGuardrail('mission_boundary', 'block', 'Advisory language implies operational authority.', 'high'));
    verdict = 'unsafe';
    cappedConfidence = Math.min(cappedConfidence, 0.2);
  } else {
    guardrail_results.push(buildGuardrail('mission_boundary', 'pass', 'Advisory language stays bounded and review-only.', 'low'));
  }

  if (hasContradiction(evidence)) {
    guardrail_results.push(buildGuardrail('contradiction_handling', 'flag', 'Conflicting elevated and normal assessments are present.', 'high'));
    verdict = verdict === 'unsafe' ? verdict : 'doubtful';
    cappedConfidence = Math.min(cappedConfidence, 0.5);
    human_review_required = true;
  } else {
    guardrail_results.push(buildGuardrail('contradiction_handling', 'pass', 'No contradiction was detected in the evidence set.', 'low'));
  }

  const uniqueSources = new Set(evidence.map(item => item.source_id));
  const uniqueGroups = countIndependentGroups(evidence);
  const circularEvidence = uniqueSources.size < evidence.length || uniqueGroups < Math.min(2, evidence.length);
  if (circularEvidence) {
    guardrail_results.push(buildGuardrail('false_consensus', 'flag', 'Evidence reuses the same source or upstream assumption.', 'high'));
    if (verdict !== 'unsafe') {
      verdict = 'untrusted';
    }
    cappedConfidence = Math.min(cappedConfidence, 0.35);
    human_review_required = true;
  } else {
    guardrail_results.push(buildGuardrail('false_consensus', 'pass', 'Evidence sources are independent enough for review-only use.', 'low'));
  }

  const supportScore = evidence.length >= 3 ? 1 : evidence.length === 2 ? 0.8 : 0.35;
  const provenanceScore = evidence.every(isFullyProvenanced) ? 1 : 0;
  const confidenceScore = packet.confidence <= 0.4 ? 0.2 : packet.confidence <= 0.7 ? 0.7 : 1;
  const contradictionScore = hasContradiction(evidence) ? 0.2 : 1;
  const humanReviewScore = packet.human_review_required || human_review_required ? 1 : 0.5;
  const missionScore = driftMatch ? 0 : 1;
  const circularScore = circularEvidence ? 0.1 : 1;
  const reconstructabilityScore = evidence.every(item => Boolean(item.excerpt)) ? 1 : 0.4;

  if (verdict === 'safe' && cappedConfidence < 0.55) {
    verdict = 'doubtful';
  }
  if (verdict === 'safe' && (circularEvidence || hasContradiction(evidence))) {
    verdict = 'doubtful';
  }
  if (verdict === 'doubtful' && driftMatch) {
    verdict = 'unsafe';
  }

  if (driftMatch) {
    guardrail_results.push(buildGuardrail('human_review_boundary', 'block', 'Mission-drift violations always require human review.', 'high'));
    human_review_required = true;
  } else if (packet.human_review_required || human_review_required) {
    guardrail_results.push(buildGuardrail('human_review_boundary', 'flag', 'The packet must remain on the human-review path.', 'medium'));
  } else {
    guardrail_results.push(buildGuardrail('human_review_boundary', 'pass', 'No human-review override was needed beyond the review-only posture.', 'low'));
  }

  const dimension_scores: IntegrityDimensionScores = {
    evidence_support: supportScore,
    provenance_integrity: provenanceScore,
    confidence_discipline: confidenceScore,
    contradiction_handling: contradictionScore,
    human_review_boundary: humanReviewScore,
    mission_drift: missionScore,
    circular_evidence_risk: circularScore,
    reconstructability: reconstructabilityScore
  };

  const summary =
    verdict === 'safe'
      ? 'Evidence is sufficiently supported, provenance is intact, and the packet remains review-only.'
      : verdict === 'doubtful'
        ? 'The packet is structurally usable for review, but confidence or evidence quality is constrained.'
        : verdict === 'unsafe'
          ? 'The packet violates a mission boundary and cannot be treated as a safe advisory.'
          : 'The packet cannot be trusted because provenance, evidence independence, or traceability is insufficient.';

  return {
    verdict,
    dimension_scores,
    guardrail_results,
    summary,
    capped_confidence: cappedConfidence,
    human_review_required
  };
}
