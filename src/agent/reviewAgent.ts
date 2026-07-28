import { analyzeEvidenceIndependence } from '../dependencyGraph.js';
import { RuntimeSession } from '../runtime/runtimeState.js';
import { AgentKRuntime } from '../safety/agentKRuntime.js';
import type { DeliberationContract } from '../safety/deliberationContract.js';
import type { ToolActionType, ToolRequest } from '../runtime/toolGateway.js';
import type { AdvisoryPacketDraft, EvidenceItem, SyntheticMaintenanceRecord } from '../types.js';

export interface PraetorToolClient {
  callTool(request: { name: string; arguments: Record<string, unknown> }): Promise<unknown>;
}

interface AnomalyContext {
  record: SyntheticMaintenanceRecord | null;
  evidence: EvidenceItem[];
}

export interface ReviewRequest {
  sessionId: string;
  equipmentId: string;
  anomalyCode?: string;
  question?: string;
}

export interface ReviewResult {
  packet: AdvisoryPacketDraft;
  submitted: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readToolPayload(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('PRAETOR tool returned a non-object payload.');
  }
  return value;
}

function isBlockedResult(value: unknown): boolean {
  return isRecord(value) && (value.status === 'blocked' || value.code === 'protocol_66_quarantine');
}

function readContext(value: unknown): AnomalyContext {
  const payload = readToolPayload(value);
  const record = payload.record;
  const evidence = payload.evidence;
  if (record !== null && !isRecord(record)) {
    throw new Error('PRAETOR anomaly context returned an invalid record.');
  }
  if (!Array.isArray(evidence) || !evidence.every(isRecord)) {
    throw new Error('PRAETOR anomaly context returned invalid evidence.');
  }
  return {
    record: record as SyntheticMaintenanceRecord | null,
    evidence: evidence as unknown as EvidenceItem[]
  };
}

function toolRequest(traceId: string, toolName: string, actionType: ToolActionType, argumentSummary: string): ToolRequest {
  return {
    traceId,
    toolName,
    actionType,
    sensitive: false,
    argumentSummary
  };
}

function deliberation(sessionId: string, traceId: string, toolName: string, actionType: DeliberationContract['action_type'], intendedAction: string): DeliberationContract {
  return {
    trace_id: traceId,
    session_id: sessionId,
    intended_action: intendedAction,
    requested_tool: toolName,
    action_type: actionType,
    reason_summary: 'Build a synthetic advisory packet for human review.',
    expected_output_type: actionType === 'submit' ? 'review-only advisory packet' : 'synthetic anomaly context',
    touches_restricted_resource: false,
    requires_human_review: true,
    retry_of_denied_action: false
  };
}

function buildPacket(request: ReviewRequest, context: AnomalyContext): AdvisoryPacketDraft {
  if (!context.record || context.evidence.length === 0) {
    throw new Error('Insufficient synthetic evidence for a review packet.');
  }

  const independence = analyzeEvidenceIndependence(context.evidence);
  const publicIndependence = {
    independent_source_count: independence.independent_source_count,
    total_evidence_count: independence.total_evidence_count,
    shared_source_ids: independence.shared_source_ids,
    dependency_risk: independence.dependency_risk,
    notes: independence.notes,
    repeated_excerpt_count: independence.repeated_excerpt_count
  };
  const sourceIds = [...new Set(context.evidence.map(item => item.source_id))];
  const contradiction = new Set(context.evidence.map(item => item.assessment).filter(Boolean)).has('normal')
    && new Set(context.evidence.map(item => item.assessment).filter(Boolean)).has('elevated');
  const uncertainty = [
    'Synthetic evidence only; root cause is not established.',
    ...context.evidence.flatMap(item => item.uncertainty_notes)
  ].filter((note, index, notes) => notes.indexOf(note) === index);
  const finding = `Evidence suggests ${context.record.technician_note} This possible recurring pattern for ${context.record.equipment_id} and ${context.record.anomaly_code} should be reviewed by a human.`;

  return {
    packet_id: `PKT-${request.sessionId}`,
    advisory_id: `ADV-${request.sessionId}`,
    finding,
    equipment_id: context.record.equipment_id,
    subsystem: context.record.subsystem,
    component: context.record.component,
    evidence_summary: context.evidence.map(item => `${item.source_id}: ${item.excerpt}`).join(' | '),
    source_ids: sourceIds,
    provenance: 'Evidence retrieved from the local synthetic PRAETOR MCP dataset by the bounded review agent.',
    supporting_evidence: context.evidence,
    confidence: Math.min(0.49, Math.max(0.1, context.evidence.length * 0.1)),
    uncertainty,
    contradiction_status: contradiction ? 'present' : 'not_detected',
    circular_evidence_status: independence.circular_evidence_risk ? 'present' : 'not_detected',
    human_review_required: true,
    advisory_only_statement: 'Advisory only. The evidence should be reviewed by a qualified human; no maintenance action is authorized.',
    guardrail_results: [{
      check: 'evidence_presence',
      guardrail: 'evidence_presence',
      status: 'pass',
      detail: 'The bounded agent supplied retrieved synthetic evidence for governance recomputation.',
      severity: 'low',
      reason: 'Retrieved evidence is present.',
      affected_fields: ['supporting_evidence'],
      recommended_action: 'Review the authoritative governance output.'
    }],
    integrity_verdict: 'doubtful',
    evidence_independence: publicIndependence,
    retry_count: 0
  };
}

function evidenceBoundaryArguments(request: ReviewRequest, packet: AdvisoryPacketDraft): Record<string, unknown> {
  return {
    session_id: request.sessionId,
    user_prompt: request.question ?? `Review synthetic evidence for ${request.equipmentId}.`,
    draft_answer: packet.finding,
    domain: 'synthetic aviation maintenance advisory',
    retrieved_evidence: packet.supporting_evidence.map((item, index) => ({
      id: `mcp-evidence-${index + 1}`,
      text: item.excerpt,
      source_type: 'MCP_RETRIEVED',
      source_id: item.source_id,
      source_domain: 'synthetic aviation maintenance',
      provenance: item.provenance_metadata
    }))
  };
}

export class ReviewAgent {
  private readonly runtime: AgentKRuntime;

  constructor(
    readonly client: PraetorToolClient,
    readonly session = new RuntimeSession('review-agent-session')
  ) {
    this.runtime = new AgentKRuntime(session);
  }

  async buildAndSubmit(request: ReviewRequest): Promise<ReviewResult> {
    const contextTraceId = `${request.sessionId}-context`;
    const contextResult = await this.runtime.executeTool(
      deliberation(request.sessionId, contextTraceId, 'retrieve_anomaly_context', 'retrieve', 'retrieve synthetic anomaly context'),
      toolRequest(contextTraceId, 'retrieve_anomaly_context', 'retrieve', `context for ${request.equipmentId}`),
      () => this.client.callTool({
        name: 'retrieve_anomaly_context',
        arguments: { equipment_id: request.equipmentId, anomaly_code: request.anomalyCode }
      })
    );
    if (isBlockedResult(contextResult)) {
      throw new Error('PRAETOR context retrieval was blocked by the host runtime.');
    }

    const packet = buildPacket(request, readContext(contextResult));
    const boundaryTraceId = `${request.sessionId}-evidence-boundary`;
    const boundaryResult = await this.runtime.executeTool(
      deliberation(request.sessionId, boundaryTraceId, 'evaluate_evidence_boundary', 'retrieve', 'validate retrieved evidence before packet submission'),
      toolRequest(boundaryTraceId, 'evaluate_evidence_boundary', 'retrieve', 'validate evidence provenance and claim boundary'),
      () => this.client.callTool({ name: 'evaluate_evidence_boundary', arguments: evidenceBoundaryArguments(request, packet) })
    );
    if (isBlockedResult(boundaryResult)) {
      throw new Error('PRAETOR evidence boundary was blocked by the host runtime.');
    }
    const boundaryPayload = readToolPayload(boundaryResult);
    if (boundaryPayload.decision !== 'allow' && boundaryPayload.decision !== 'revise_with_boundary') {
      throw new Error(`PRAETOR evidence boundary rejected packet preparation: ${String(boundaryPayload.decision ?? 'unknown')}.`);
    }

    const submitTraceId = `${request.sessionId}-submit`;
    const submitted = await this.runtime.executeTool(
      deliberation(request.sessionId, submitTraceId, 'submit_review_advisory_packet', 'submit', 'submit a review-only synthetic advisory packet'),
      toolRequest(submitTraceId, 'submit_review_advisory_packet', 'submit', 'review-only advisory packet'),
      () => this.client.callTool({ name: 'submit_review_advisory_packet', arguments: packet as unknown as Record<string, unknown> })
    );
    if (isBlockedResult(submitted)) {
      throw new Error('PRAETOR packet submission was blocked by the host runtime.');
    }

    return { packet, submitted };
  }
}
