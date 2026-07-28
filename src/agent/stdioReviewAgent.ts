import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { ReviewAgent, type ReviewRequest, type ReviewResult } from './reviewAgent.js';
import { RuntimeSession } from '../runtime/runtimeState.js';

interface TextContent {
  type: 'text';
  text: string;
}

function isTextContent(value: unknown): value is TextContent {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && value.type === 'text'
    && 'text' in value
    && typeof value.text === 'string';
}

export class StdioPraetorToolClient {
  constructor(readonly client: Client) {}

  async callTool(request: { name: string; arguments: Record<string, unknown> }): Promise<unknown> {
    const result = await this.client.callTool(request);
    const text = result.content.find(isTextContent)?.text;
    if (!text) {
      throw new Error(`PRAETOR MCP tool returned no JSON text: ${request.name}.`);
    }
    if (result.isError) {
      throw new Error(`PRAETOR MCP tool failed: ${request.name} (${text.slice(0, 500)}).`);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`PRAETOR MCP tool returned invalid JSON: ${request.name}.`);
    }
    return payload;
  }
}

export interface ConnectedReviewAgent {
  agent: ReviewAgent;
  client: Client;
  transport: StdioClientTransport;
  run(request: ReviewRequest): Promise<ReviewResult>;
  close(): Promise<void>;
}

export async function connectStdioReviewAgent(options: {
  cwd?: string;
  sessionId?: string;
  command?: string;
} = {}): Promise<ConnectedReviewAgent> {
  const client = new Client({ name: 'praetor-review-agent', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: options.command ?? (process.platform === 'win32' ? 'npx.cmd' : 'npx'),
    args: ['tsx', 'src/index.ts'],
    cwd: options.cwd ?? process.cwd()
  });
  await client.connect(transport);

  const toolClient = new StdioPraetorToolClient(client);
  const agent = new ReviewAgent(toolClient, new RuntimeSession(options.sessionId ?? 'review-agent-stdio'));
  return {
    agent,
    client,
    transport,
    run: request => agent.buildAndSubmit(request),
    close: () => client.close()
  };
}
