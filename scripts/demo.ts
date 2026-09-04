import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { connectStdioReviewAgent, StdioPraetorToolClient } from '../src/agent/stdioReviewAgent.js';

function readTextResult(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || !('content' in value)) {
    throw new Error('The demo received an invalid MCP response.');
  }
  const content = (value as { content: unknown }).content;
  if (!Array.isArray(content)) {
    throw new Error('The demo received an invalid MCP content response.');
  }
  const text = content.find(item => typeof item === 'object' && item !== null && 'type' in item && item.type === 'text' && 'text' in item)?.text;
  if (typeof text !== 'string') {
    throw new Error('The demo received no JSON text from the MCP tool.');
  }
  return JSON.parse(text) as Record<string, unknown>;
}

async function retrieveOpeningExcerpt(): Promise<Record<string, unknown>> {
  const client = new Client({ name: 'praetor-demo-retrieval', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['tsx', 'src/index.ts'],
    cwd: process.cwd()
  });
  await client.connect(transport);
  try {
    const result = await client.callTool({
      name: 'retrieve_document_excerpt',
      arguments: { excerpt_id: 'EX-401-A' }
    });
    return readTextResult(result);
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  console.log('PRAETOR-MCP demo: Retrieve -> Challenge -> Bound');
  console.log('\n[1/3] RETRIEVE');
  console.log(JSON.stringify(await retrieveOpeningExcerpt(), null, 2));

  console.log('\n[2/3] CHALLENGE');
  console.log('Reviewing PRA-403, where synthetic evidence includes an elevated reading and a normal follow-up.');
  console.log('The agent is not allowed to treat a favorable caller-supplied verdict as authority.');

  const connected = await connectStdioReviewAgent({ sessionId: 'hackathon-demo' });
  try {
    console.log('\n[3/3] BOUND');
    try {
      const result = await connected.run({
        sessionId: connected.session.sessionId,
        equipmentId: 'PRA-403',
        anomalyCode: 'TEMP-09',
        question: 'Review this synthetic evidence and prepare an advisory packet for human review.'
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.log(JSON.stringify({
        status: 'blocked',
        reason: error instanceof Error ? error.message : String(error),
        human_review_required: true,
        advisory_only: true
      }, null, 2));
    }
    console.log('\nHuman review remains required; no maintenance action is authorized.');
  } finally {
    await connected.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});