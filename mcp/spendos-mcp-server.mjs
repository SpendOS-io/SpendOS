#!/usr/bin/env node

import { createInterface } from "node:readline";
import { SpendOS, SpendOSError } from "../sdk/spendos-agent.mjs";

const PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_PROXY_URL = process.env.SPENDOS_PROXY_URL || "http://127.0.0.1:4191";
const DEFAULT_AGENT = process.env.SPENDOS_AGENT || "research-agent";
const DEFAULT_API_KEY = process.env.SPENDOS_API_KEYS?.split(",")[0] || process.env.SPENDOS_API_KEY || "";

const paymentInputSchema = {
  type: "object",
  properties: {
    agentId: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
    domain: { type: "string", description: "Paid API domain requesting payment." },
    contract: { type: "string", description: "Allowlisted payment or service contract identifier." },
    amount: { type: "number", description: "USDC amount requested by the agent." },
    task: { type: "string", description: "Task or prompt memo that caused the spend." },
    recipient: { type: "string", description: "Optional recipient address for settlement calldata." },
    idempotencyKey: { type: "string", description: "Stable retry key to prevent duplicate spend." },
  },
  required: ["domain", "contract", "amount"],
  additionalProperties: false,
};

const TOOL_DEFINITIONS = [
  {
    name: "get_agent_file",
    title: "Get Agent File",
    description: "Return SpendOS agent policy, Base vault metadata, daily limits, and current policy digest.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "request_budget",
    title: "Request Budget",
    description: "Reserve bounded USDC budget for an autonomous task before an agent calls paid tools.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
        task: { type: "string", description: "Task or prompt memo that needs budget." },
        maxSpend: { type: "number", description: "Maximum USDC the agent wants to spend." },
        idempotencyKey: { type: "string", description: "Stable retry key to prevent duplicate budget reservations." },
      },
      required: ["task", "maxSpend"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "check_policy",
    title: "Check Policy",
    description: "Evaluate endpoint, contract, amount, task memo, and risk posture before authorizing payment.",
    inputSchema: paymentInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "update_policy",
    title: "Update Policy",
    description: "Update live SpendOS agent limits, allowlists, risk mode, and pause state.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
        dailyLimit: { type: "number", description: "Daily USDC spend limit." },
        perTransactionLimit: { type: "number", description: "Per-payment USDC limit." },
        domains: { type: "array", items: { type: "string" }, description: "Allowed payment endpoint domains." },
        contracts: { type: "array", items: { type: "string" }, description: "Allowed contract identifiers or addresses." },
        riskMode: { type: "string", enum: ["monitor", "adaptive", "strict", "enforce"] },
        paused: { type: "boolean", description: "Whether spend authority should be suspended." },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "pay_x402",
    title: "Pay x402",
    description: "Authorize an x402 API payment when SpendOS policy and owner authority permit execution.",
    inputSchema: paymentInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "preview_settlement",
    title: "Preview Settlement",
    description: "Generate SpendOSVault calldata for a payment without mutating agent spend state.",
    inputSchema: paymentInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "preflight_settlement",
    title: "Preflight Settlement",
    description: "Run a read-only onchain preflight for SpendOSVault calldata before submitting a payment transaction.",
    inputSchema: paymentInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_settlement_config",
    title: "Get Settlement Config",
    description: "Return SpendOSVault settlement readiness, vault address, operator signer status, and function selector.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_vault_status",
    title: "Get Vault Status",
    description: "Read onchain SpendOSVault policy, balance, paused state, and operator authorization for an agent.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_launch_readiness",
    title: "Get Launch Readiness",
    description: "Return aggregated launch readiness across deployment config, vault status, operator permission, funding, and preflight.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "submit_settlement",
    title: "Submit Settlement",
    description: "Submit a SpendOSVault settlement transaction through the configured operator signer.",
    inputSchema: paymentInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "link_acp_wallet",
    title: "Link ACP Wallet",
    description: "Link the agent's Virtuals ACP (EconomyOS) wallet address and optional provider allowlist to the SpendOS policy.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
        acpWallet: { type: "string", description: "EVM address of the agent's ACP/EconomyOS wallet on Base." },
        acpProviders: {
          type: "array",
          items: { type: "string" },
          description: "Allowlisted ACP provider wallet addresses the agent may hire.",
        },
      },
      required: ["acpWallet"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "check_acp_job",
    title: "Check ACP Job",
    description: "Evaluate a Virtuals ACP job or subscription against SpendOS policy before funding escrow with acp client create-job.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
        provider: { type: "string", description: "ACP provider agent wallet address offering the job." },
        amount: { type: "number", description: "USDC price of the ACP job or subscription." },
        memo: { type: "string", description: "Job requirement memo or offering description." },
        jobType: { type: "string", enum: ["job", "subscription"], description: "ACP engagement type." },
        durationDays: { type: "number", description: "Subscription window in days (7/15/30/90)." },
      },
      required: ["provider", "amount"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "acp_topup",
    title: "ACP Wallet Top-up",
    description: "Authorize a policy-bound USDC top-up from the SpendOS vault to the agent's linked ACP wallet for funding ACP escrow jobs.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
        amount: { type: "number", description: "USDC amount to transfer to the linked ACP wallet." },
        task: { type: "string", description: "Task memo describing why the ACP wallet needs funds." },
        submit: { type: "boolean", description: "Submit the settlement transaction through the operator signer." },
        idempotencyKey: { type: "string", description: "Stable retry key to prevent duplicate top-ups." },
      },
      required: ["amount"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "get_receipts",
    title: "Get Receipts",
    description: "Return receipt-bound spend history for audit, accounting, and agent evals.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_approvals",
    title: "Get Approvals",
    description: "Return pending or resolved owner approval requests for agent spend.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
        status: { type: "string", enum: ["pending", "approved", "denied", "blocked"] },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "resolve_approval",
    title: "Resolve Approval",
    description: "Approve or deny a pending SpendOS payment approval request.",
    inputSchema: {
      type: "object",
      properties: {
        approvalId: { type: "string", description: "Approval id returned by pay_x402 or get_approvals." },
        decision: { type: "string", enum: ["approved", "denied"] },
        resolver: { type: "string", description: "Owner, operator, or policy resolver identifier." },
        signature: { type: "string", description: "Optional wallet signature for the approval decision." },
        reason: { type: "string", description: "Optional approval or denial memo." },
      },
      required: ["approvalId", "decision"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "pause_agent",
    title: "Pause Agent",
    description: "Suspend spend authority for an agent when risk rises or owner intervention is required.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "resume_agent",
    title: "Resume Agent",
    description: "Restore spend authority for an agent after owner or policy review.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string", description: "SpendOS agent id. Defaults to the configured server agent." },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];

function jsonText(payload) {
  return JSON.stringify(payload, null, 2);
}

function toolResult(payload) {
  return {
    content: [{ type: "text", text: jsonText(payload) }],
    structuredContent: payload,
  };
}

function toolErrorResult(error) {
  const payload =
    error instanceof SpendOSError
      ? {
          error: error.message,
          status: error.status,
          payload: error.payload,
        }
      : {
          error: error.message || "spendos_tool_error",
        };

  return {
    isError: true,
    content: [{ type: "text", text: jsonText(payload) }],
    structuredContent: payload,
  };
}

async function callSpendOsTool(name, args = {}, { spendos = new SpendOS({ baseUrl: DEFAULT_PROXY_URL, agent: DEFAULT_AGENT, apiKey: DEFAULT_API_KEY }) } = {}) {
  try {
    if (name === "get_agent_file") {
      return toolResult(await spendos.getAgent(args.agent));
    }
    if (name === "request_budget") {
      return toolResult(await spendos.requestBudget(args));
    }
    if (name === "check_policy") {
      return toolResult(await spendos.checkPolicy(args));
    }
    if (name === "update_policy") {
      return toolResult(await spendos.updatePolicy(args));
    }
    if (name === "pay_x402") {
      return toolResult(await spendos.payX402(args));
    }
    if (name === "preview_settlement") {
      return toolResult(await spendos.previewSettlement(args));
    }
    if (name === "preflight_settlement") {
      return toolResult(await spendos.preflightSettlement(args));
    }
    if (name === "get_settlement_config") {
      return toolResult(await spendos.getSettlementConfig());
    }
    if (name === "get_vault_status") {
      return toolResult(await spendos.getVaultStatus({ agent: args.agent }));
    }
    if (name === "get_launch_readiness") {
      return toolResult(await spendos.getLaunchReadiness({ agent: args.agent }));
    }
    if (name === "submit_settlement") {
      return toolResult(await spendos.submitSettlement(args));
    }
    if (name === "link_acp_wallet") {
      return toolResult(await spendos.linkAcpWallet(args));
    }
    if (name === "check_acp_job") {
      return toolResult(await spendos.checkAcpJob(args));
    }
    if (name === "acp_topup") {
      return toolResult(await spendos.acpTopup(args));
    }
    if (name === "get_receipts") {
      return toolResult(await spendos.getReceipts({ agent: args.agent }));
    }
    if (name === "get_approvals") {
      return toolResult(await spendos.getApprovals({ agent: args.agent, status: args.status }));
    }
    if (name === "resolve_approval") {
      return toolResult(await spendos.resolveApproval(args));
    }
    if (name === "pause_agent") {
      return toolResult(await spendos.pauseAgent({ agent: args.agent, paused: true }));
    }
    if (name === "resume_agent") {
      return toolResult(await spendos.resumeAgent({ agent: args.agent }));
    }

    throw jsonRpcError(-32602, `Unknown SpendOS tool: ${name}`);
  } catch (error) {
    if (error.code) throw error;
    return toolErrorResult(error);
  }
}

function jsonRpcError(code, message, data = undefined) {
  return { code, message, data };
}

function errorResponse(id, code, message, data = undefined) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: jsonRpcError(code, message, data),
  };
}

async function handleJsonRpcMessage(message, context = {}) {
  if (Array.isArray(message)) {
    return Promise.all(message.map((item) => handleJsonRpcMessage(item, context)));
  }

  if (!message || message.jsonrpc !== "2.0" || !message.method) {
    return errorResponse(message?.id, -32600, "Invalid JSON-RPC request");
  }

  const id = Object.hasOwn(message, "id") ? message.id : undefined;
  const isNotification = id === undefined;

  try {
    if (message.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: "spendos-mcp",
            title: "SpendOS MCP",
            version: "0.1.0",
          },
          instructions:
            "SpendOS provides policy-bound tools for AI agent spending on Base USDC. Use pay_x402 only after check_policy or request_budget when possible.",
        },
      };
    }

    if (message.method === "notifications/initialized") {
      return null;
    }

    if (message.method === "ping") {
      return isNotification ? null : { jsonrpc: "2.0", id, result: {} };
    }

    if (message.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOL_DEFINITIONS,
        },
      };
    }

    if (message.method === "tools/call") {
      const { name, arguments: args = {} } = message.params || {};
      if (!name || !TOOL_DEFINITIONS.some((tool) => tool.name === name)) {
        return errorResponse(id, -32602, `Unknown SpendOS tool: ${name || "missing_tool_name"}`);
      }

      return {
        jsonrpc: "2.0",
        id,
        result: await callSpendOsTool(name, args, context),
      };
    }

    return isNotification ? null : errorResponse(id, -32601, `Method not found: ${message.method}`);
  } catch (error) {
    return errorResponse(id, error.code || -32603, error.message || "Internal error", error.data);
  }
}

function writeJsonRpcMessage(stream, message) {
  if (!message) return;
  stream.write(`${JSON.stringify(message)}\n`);
}

function startStdioServer({
  input = process.stdin,
  output = process.stdout,
  spendos = new SpendOS({ baseUrl: DEFAULT_PROXY_URL, agent: DEFAULT_AGENT, apiKey: DEFAULT_API_KEY }),
} = {}) {
  const lines = createInterface({ input });

  lines.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      writeJsonRpcMessage(output, errorResponse(null, -32700, "Parse error"));
      return;
    }

    const response = await handleJsonRpcMessage(message, { spendos });
    if (Array.isArray(response)) {
      response.filter(Boolean).forEach((item) => writeJsonRpcMessage(output, item));
      return;
    }

    writeJsonRpcMessage(output, response);
  });

  return lines;
}

export {
  DEFAULT_AGENT,
  DEFAULT_PROXY_URL,
  PROTOCOL_VERSION,
  TOOL_DEFINITIONS,
  callSpendOsTool,
  handleJsonRpcMessage,
  startStdioServer,
  writeJsonRpcMessage,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  startStdioServer();
  console.error(`SpendOS MCP server connected to ${DEFAULT_PROXY_URL} as ${DEFAULT_AGENT}`);
}
