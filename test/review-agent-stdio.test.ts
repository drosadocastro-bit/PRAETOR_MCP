import { describe, expect, it } from 'vitest';

import { connectStdioReviewAgent } from '../src/agent/stdioReviewAgent.js';

describe('ReviewAgent stdio integration', () => {
  it('runs the bounded review flow against the real local MCP server', async () => {
    const connection = await connectStdioReviewAgent({
      cwd: process.cwd(),
      sessionId: 'review-agent-stdio-test'
    });

    try {
      const result = await connection.run({
        sessionId: 'review-agent-stdio-test',
        equipmentId: 'PRA-401',
        anomalyCode: 'VIB-14',
        question: 'What does this synthetic pattern suggest for human review?'
      });

      expect(result.packet.human_review_required).toBe(true);
      expect(result.packet.equipment_id).toBe('PRA-401');
      expect(result.packet.source_ids?.length).toBeGreaterThan(0);
      expect(result.packet.advisory_only_statement).toContain('no maintenance action is authorized');
      expect(result.submitted).toMatchObject({
        status: 'stored',
        assessment: {
          verdict: expect.any(String),
          human_review_required: true
        },
        packet: {
          human_review_required: true
        }
      });
      expect(connection.agent.session.trace().map(event => event.event_type)).toEqual([
        'pre_action_inspection',
        'pre_action_inspection',
        'pre_action_inspection'
      ]);
    } finally {
      await connection.close();
    }
  }, 30_000);
});
