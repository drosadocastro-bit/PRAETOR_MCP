import { describe, expect, it } from 'vitest';

import { ReviewAgent, type PraetorToolClient } from '../src/agent/reviewAgent.js';
import { RuntimeSession } from '../src/runtime/runtimeState.js';

class FakePraetorClient implements PraetorToolClient {
  readonly calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  boundaryDecision = 'allow';

  async callTool(request: { name: string; arguments: Record<string, unknown> }): Promise<unknown> {
    this.calls.push(request);
    if (request.name === 'retrieve_anomaly_context') {
      return {
        record: {
          record_id: 'REC-401-A',
          equipment_id: 'PRA-401',
          subsystem: 'hydraulic',
          component: 'pump seal',
          event_date: '2026-07-01T00:00:00.000Z',
          event_type: 'inspection',
          anomaly_code: 'VIB-14',
          severity: 'medium',
          technician_note: 'Synthetic vibration observation.',
          corrective_action: 'Logged for review.',
          recurrence_count: 2,
          source_id: 'SRC-401-A',
          source_type: 'synthetic_inspection_log',
          confidence_hint: 0.6,
          independence_group: 'group-401-a',
          assessment: 'elevated'
        },
        evidence: [{
          source_id: 'SRC-401-A',
          source_type: 'synthetic_inspection_log',
          timestamp: '2026-07-01T00:00:00.000Z',
          excerpt: 'Synthetic vibration observation.',
          provenance_metadata: 'Synthetic test source.',
          uncertainty_notes: ['Root cause is not established.'],
          independence_group: 'group-401-a',
          assessment: 'elevated'
        }]
      };
    }
    if (request.name === 'submit_review_advisory_packet') {
      return { integrity_verdict: 'doubtful', human_review_required: true };
    }
    if (request.name === 'evaluate_evidence_boundary') {
      return { decision: this.boundaryDecision };
    }
    throw new Error(`Unexpected tool: ${request.name}`);
  }
}

describe('ReviewAgent', () => {
  it('builds a bounded review packet through the host runtime', async () => {
    const client = new FakePraetorClient();
    const session = new RuntimeSession('review-agent-test');
    const agent = new ReviewAgent(client, session);

    const result = await agent.buildAndSubmit({
      sessionId: 'review-agent-test',
      equipmentId: 'PRA-401',
      anomalyCode: 'VIB-14',
      question: 'What does this synthetic pattern suggest?'
    });

    expect(client.calls.map(call => call.name)).toEqual([
      'retrieve_anomaly_context',
      'evaluate_evidence_boundary',
      'submit_review_advisory_packet'
    ]);
    expect(result.packet.human_review_required).toBe(true);
    expect(result.packet.finding).toContain('should be reviewed by a human');
    expect(result.packet.finding).not.toMatch(/must replace|confirmed failure|safe to operate/i);
    expect(result.packet.advisory_only_statement).toContain('no maintenance action is authorized');
    expect(result.submitted).toEqual({ integrity_verdict: 'doubtful', human_review_required: true });
    expect(session.trace().map(event => event.event_type)).toEqual([
      'pre_action_inspection',
      'pre_action_inspection',
      'pre_action_inspection'
    ]);
  });

  it('does not submit when the evidence boundary refuses preparation', async () => {
    const client = new FakePraetorClient();
    client.boundaryDecision = 'refuse_evidence_based_answer';
    const agent = new ReviewAgent(client, new RuntimeSession('review-agent-refused'));

    await expect(agent.buildAndSubmit({
      sessionId: 'review-agent-refused',
      equipmentId: 'PRA-401',
      anomalyCode: 'VIB-14'
    })).rejects.toThrow('evidence boundary rejected');
    expect(client.calls.map(call => call.name)).toEqual([
      'retrieve_anomaly_context',
      'evaluate_evidence_boundary'
    ]);
  });
});
