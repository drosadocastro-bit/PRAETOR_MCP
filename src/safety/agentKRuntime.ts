import { OutputGate, type OutputGateResult } from '../runtime/outputGate.js';
import { ToolGateway, type ToolRequest } from '../runtime/toolGateway.js';
import { RuntimeSession } from '../runtime/runtimeState.js';
import { AgentKPreActionInspector } from './agentKPreAction.js';
import type { DeliberationContract } from './deliberationContract.js';

export class AgentKRuntime {
  private readonly inspector = new AgentKPreActionInspector();
  private readonly gateway = new ToolGateway();
  private readonly outputGate = new OutputGate();

  constructor(readonly session: RuntimeSession) {}

  async executeTool<T>(contract: DeliberationContract | undefined, request: ToolRequest, action: () => Promise<T>, previousDenials = 0): Promise<T | object> {
    await this.inspector.inspect(this.session, contract, request, previousDenials);
    return this.gateway.execute(this.session, request, action);
  }

  async emitOutput(traceId: string, text: string): Promise<OutputGateResult> {
    return this.outputGate.evaluate(this.session, { traceId, text });
  }
}
