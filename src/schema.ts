import * as z from 'zod/v4';

const EvidenceItemSchema = z.object({
  source_id: z.string().min(1),
  source_type: z.string().min(1),
  timestamp: z.string().datetime(),
  excerpt: z.string().min(1),
  provenance_metadata: z.string().min(1),
  uncertainty_notes: z.array(z.string()),
  independence_group: z.string().min(1),
  assessment: z.enum(['elevated', 'stable', 'normal', 'uncertain']).optional(),
  confidence_hint: z.number().min(0).max(1).optional(),
  derived_from_source_id: z.string().min(1).optional(),
  upstream_assumption: z.string().min(1).optional()
});

const GuardrailResultSchema = z.object({
  check: z.enum([
    'evidence_presence',
    'provenance_required',
    'confidence_boundary',
    'human_review_boundary',
    'mission_boundary',
    'false_consensus',
    'contradiction_handling',
    'schema_validation',
    'evaluator_manipulation',
    'retry_pressure'
  ]),
  guardrail: z.string().min(1),
  status: z.enum(['pass', 'flag', 'block']),
  detail: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high']),
  reason: z.string().min(1),
  affected_fields: z.array(z.string()),
  recommended_action: z.string().min(1)
});

export const EvidenceIndependenceSchema = z.object({
  independent_source_count: z.number().int().nonnegative(),
  total_evidence_count: z.number().int().nonnegative(),
  shared_source_ids: z.array(z.string()),
  dependency_risk: z.enum(['low', 'medium', 'high']),
  notes: z.string().min(1)
});

export const AdvisoryPacketSchema = z.object({
  packet_id: z.string().min(1).optional(),
  advisory_id: z.string().min(1),
  equipment_id: z.string().min(1),
  subsystem: z.string().min(1),
  component: z.string().min(1),
  finding: z.string().min(1),
  evidence_summary: z.string().min(1),
  source_ids: z.array(z.string().min(1)).min(1),
  provenance: z.string().min(1),
  supporting_evidence: z.array(EvidenceItemSchema).min(1),
  confidence: z.number().min(0).max(1),
  uncertainty: z.array(z.string()),
  contradiction_status: z.enum(['present', 'not_detected']),
  circular_evidence_status: z.enum(['present', 'not_detected']),
  human_review_required: z.boolean(),
  advisory_only_statement: z.string().min(1),
  guardrail_results: z.array(GuardrailResultSchema).min(1),
  integrity_verdict: z.enum(['safe', 'doubtful', 'unsafe', 'untrusted']),
  evidence_independence: EvidenceIndependenceSchema.optional(),
  retry_count: z.number().int().nonnegative().optional()
});

export type AdvisoryPacketInput = z.input<typeof AdvisoryPacketSchema>;

export function validateAdvisoryPacket(packet: unknown): { valid: true; data: AdvisoryPacketInput } | { valid: false; issues: string[] } {
  const result = AdvisoryPacketSchema.safeParse(packet);
  if (result.success) {
    return { valid: true, data: result.data };
  }

  return {
    valid: false,
    issues: result.error.issues.map(issue => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
  };
}
