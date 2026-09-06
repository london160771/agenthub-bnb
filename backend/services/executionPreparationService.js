/** Generic, read-only execution preparation for local and indexed agents. */
import {
  AGENT_CAPABILITIES,
  getAgentCapability,
  isLocalExecutableAgent,
} from './agentCapabilities.js';
import { getExecutionAdapterForAgent } from './adapters/registry.js';
import { preparePayment } from './payments/paymentService.js';
import { normalizeAgentCapability } from './agentCapabilityModel.js';

function failure(agent, details, code = 'AGENT_NOT_EXECUTABLE') {
  return {
    ok: false,
    mode: 'unavailable',
    state: 'FAILED',
    error: { code, message: `This agent is not ready for execution. ${details.blockers.join(' ')}` },
    capability: details.capability,
    agent: { agentId: agent?.agentId, name: agent?.name },
    executionProtocol: details.execution.protocol,
    execution: details.execution,
    blockers: details.blockers,
  };
}

/**
 * Prepare the next safe step without opening a wallet or contacting the agent.
 * The task input is intentionally only validated/staged by the hire endpoint;
 * payment facts always come from the backend Agent record.
 */
export function prepareExecution({ agent, task = '', input = {}, walletAddress = null } = {}) {
  const details = normalizeAgentCapability(agent);
  const capability = getAgentCapability(agent);
  if (!agent) return failure(agent, { ...details, blockers: ['agent record was not found'] }, 'AGENT_NOT_FOUND');

  if (isLocalExecutableAgent(agent)) {
    return {
      ok: true,
      mode: 'free',
      state: 'READY_TO_EXECUTE',
      agent: { agentId: agent.agentId, name: agent.name },
      capability,
      executionProtocol: details.execution.protocol,
      execution: details.execution,
      paymentProtocol: 'none',
      walletAddress: walletAddress || null,
      task,
      inputAccepted: input && typeof input === 'object' && !Array.isArray(input),
      provenance: 'local AgentHub executor on BNB Smart Chain Testnet (chain 97)',
    };
  }

  const adapter = getExecutionAdapterForAgent(agent);
  if (!adapter) return failure(agent, details, 'EXECUTION_ADAPTER_UNAVAILABLE');

  if (capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE) {
    return {
      ok: true,
      mode: 'free',
      state: 'READY_TO_EXECUTE',
      agent: { agentId: agent.agentId, name: agent.name },
      capability,
      executionProtocol: details.execution.protocol,
      execution: details.execution,
      paymentProtocol: 'none',
      walletAddress: walletAddress || null,
      task,
      inputAccepted: input && typeof input === 'object' && !Array.isArray(input),
      provenance: 'external HTTP/A2A/MCP task execution on a BSC Mainnet-indexed agent; no blockchain transaction',
    };
  }

  if (
    capability !== AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY &&
    capability !== AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID
  ) {
    return failure(agent, details);
  }

  const plan = preparePayment({ agent, task });
  if (!plan.ok) {
    return {
      ...plan,
      mode: 'unavailable',
      execution: details.execution,
      blockers: details.blockers,
    };
  }
  return {
    ...plan,
    mode: 'paid',
    executionProtocol: details.execution.protocol,
    execution: details.execution,
    paymentProtocol: plan.protocol,
    walletAddress: walletAddress || null,
    task,
    inputAccepted: input && typeof input === 'object' && !Array.isArray(input),
  };
}
