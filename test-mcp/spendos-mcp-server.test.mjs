import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import { SpendOSError } from "../sdk/spendos-agent.mjs";
import {
  PROTOCOL_VERSION,
  TOOL_DEFINITIONS,
  callSpendOsTool,
  handleJsonRpcMessage,
  startStdioServer,
} from "../mcp/spendos-mcp-server.mjs";

function fakeSpendos() {
  return {
    async getAgent(agent) {
      return {
        agentId: agent || "research-agent",
        network: "base",
        asset: "USDC",
        availableDaily: 9.58,
      };
    },
    async requestBudget(payload) {
      return { status: "approved", reservation: { task: payload.task, maxSpend: payload.maxSpend } };
    },
    async checkPolicy(payload) {
      return { status: "approved", reason: "policy_matched", domain: payload.domain };
    },
    async updatePolicy(payload) {
      return {
        status: "updated",
        agentId: payload.agentId || "research-agent",
        policyDigest: "0x" + "c".repeat(64),
        policy: payload,
      };
    },
    async payX402(payload) {
      return {
        status: "approved",
        reason: "x402_payment_authorized",
        receipt: {
          receiptHash: "0x" + "a".repeat(64),
          domain: payload.domain,
          amount: payload.amount,
        },
      };
    },
    async previewSettlement(payload) {
      return { status: "approved", settlement: { function: "spendUSDC", amount: payload.amount } };
    },
    async preflightSettlement(payload) {
      return { status: "ready", call: { ok: true }, settlement: { function: "spendUSDC", amount: payload.amount } };
    },
    async getSettlementConfig() {
      return { status: "not_configured", functionSelector: "0xe79d5d2a" };
    },
    async getVaultStatus({ agent } = {}) {
      return { status: "not_configured", agentId: agent || "research-agent" };
    },
    async getLaunchReadiness({ agent } = {}) {
      return { status: "not_ready", agentId: agent || "research-agent", score: { passed: 1, total: 7 } };
    },
    async submitSettlement() {
      throw new SpendOSError("vault_address_not_configured", {
        status: 503,
        payload: { status: "not_configured" },
      });
    },
    async getReceipts({ agent } = {}) {
      return { receipts: [{ agentId: agent || "research-agent", receiptHash: "0x" + "b".repeat(64) }] };
    },
    async getApprovals({ agent, status } = {}) {
      return {
        approvals: [
          {
            id: "approval_test",
            agentId: agent || "research-agent",
            status: status || "pending",
          },
        ],
      };
    },
    async resolveApproval(payload) {
      return {
        status: payload.decision,
        approval: { id: payload.approvalId, status: payload.decision },
      };
    },
    async pauseAgent({ agent }) {
      return { status: "paused", agentId: agent || "research-agent" };
    },
    async resumeAgent({ agent }) {
      return { status: "active", agentId: agent || "research-agent" };
    },
    async linkAcpWallet(payload) {
      return {
        status: "linked",
        agentId: payload.agentId || "research-agent",
        acpWallet: payload.acpWallet,
        acpProviders: payload.acpProviders || [],
      };
    },
    async checkAcpJob(payload) {
      return {
        status: "approved",
        reason: "acp_job_within_policy",
        provider: payload.provider,
        guidance: { fundVia: "acp_topup" },
      };
    },
    async acpTopup(payload) {
      return {
        status: "approved",
        reason: "acp_topup_authorized",
        acp: { action: "topup", wallet: "0x52908400098527886E0F7030069857D2E4169EE7" },
        receipt: { domain: "acp-topup", amount: payload.amount },
        settlement: { function: "spendUSDC" },
      };
    },
  };
}

test("MCP initialize advertises SpendOS tool capability", async () => {
  const response = await handleJsonRpcMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {},
  });

  assert.equal(response.result.protocolVersion, PROTOCOL_VERSION);
  assert.equal(response.result.serverInfo.name, "spendos-mcp");
  assert.equal(response.result.capabilities.tools.listChanged, false);
});

test("MCP tools/list exposes autonomous spend controls", async () => {
  const response = await handleJsonRpcMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  const names = response.result.tools.map((tool) => tool.name);

  assert.ok(names.includes("request_budget"));
  assert.ok(names.includes("check_policy"));
  assert.ok(names.includes("update_policy"));
  assert.ok(names.includes("pay_x402"));
  assert.ok(names.includes("preview_settlement"));
  assert.ok(names.includes("preflight_settlement"));
  assert.ok(names.includes("get_settlement_config"));
  assert.ok(names.includes("get_vault_status"));
  assert.ok(names.includes("get_launch_readiness"));
  assert.ok(names.includes("submit_settlement"));
  assert.ok(names.includes("get_receipts"));
  assert.ok(names.includes("get_approvals"));
  assert.ok(names.includes("resolve_approval"));
  assert.ok(names.includes("pause_agent"));
  assert.ok(names.includes("link_acp_wallet"));
  assert.ok(names.includes("check_acp_job"));
  assert.ok(names.includes("acp_topup"));
  assert.equal(TOOL_DEFINITIONS.find((tool) => tool.name === "pay_x402").annotations.destructiveHint, true);
  assert.equal(TOOL_DEFINITIONS.find((tool) => tool.name === "acp_topup").annotations.destructiveHint, true);
  assert.equal(TOOL_DEFINITIONS.find((tool) => tool.name === "check_acp_job").annotations.readOnlyHint, true);
});

test("MCP tools/call routes ACP tools through SpendOS SDK", async () => {
  const linked = await handleJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 40,
      method: "tools/call",
      params: {
        name: "link_acp_wallet",
        arguments: { acpWallet: "0x52908400098527886E0F7030069857D2E4169EE7" },
      },
    },
    { spendos: fakeSpendos() },
  );
  const jobCheck = await handleJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 41,
      method: "tools/call",
      params: {
        name: "check_acp_job",
        arguments: { provider: "0x8617E340B3D01FA5F11F306F4090FD50E238070D", amount: 0.2 },
      },
    },
    { spendos: fakeSpendos() },
  );
  const topup = await handleJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 42,
      method: "tools/call",
      params: {
        name: "acp_topup",
        arguments: { amount: 0.2, task: "fund acp escrow" },
      },
    },
    { spendos: fakeSpendos() },
  );

  assert.equal(linked.result.structuredContent.status, "linked");
  assert.equal(linked.result.structuredContent.acpWallet, "0x52908400098527886E0F7030069857D2E4169EE7");
  assert.equal(jobCheck.result.structuredContent.status, "approved");
  assert.equal(jobCheck.result.structuredContent.guidance.fundVia, "acp_topup");
  assert.equal(topup.result.structuredContent.status, "approved");
  assert.equal(topup.result.structuredContent.receipt.domain, "acp-topup");
  assert.equal(topup.result.structuredContent.settlement.function, "spendUSDC");
});

test("MCP tools/call routes pay_x402 through SpendOS SDK", async () => {
  const response = await handleJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "pay_x402",
        arguments: {
          domain: "api.tokensight.io",
          contract: "0x8335...2913",
          amount: 0.05,
          task: "MCP unit spend",
          idempotencyKey: "mcp-unit-1",
        },
      },
    },
    { spendos: fakeSpendos() },
  );

  assert.equal(response.result.structuredContent.status, "approved");
  assert.equal(response.result.structuredContent.receipt.amount, 0.05);
  assert.match(response.result.content[0].text, /x402_payment_authorized/);
});

test("MCP tools/call routes update_policy through SpendOS SDK", async () => {
  const response = await handleJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 30,
      method: "tools/call",
      params: {
        name: "update_policy",
        arguments: {
          agentId: "research-agent",
          dailyLimit: 12,
          perTransactionLimit: 0.2,
          domains: ["api.tokensight.io"],
          contracts: ["0x8335...2913"],
          riskMode: "strict",
        },
      },
    },
    { spendos: fakeSpendos() },
  );

  assert.equal(response.result.structuredContent.status, "updated");
  assert.equal(response.result.structuredContent.policy.riskMode, "strict");
});

test("MCP tools/call routes approval queue tools through SpendOS SDK", async () => {
  const list = await handleJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 31,
      method: "tools/call",
      params: {
        name: "get_approvals",
        arguments: { agent: "research-agent", status: "pending" },
      },
    },
    { spendos: fakeSpendos() },
  );
  const resolved = await handleJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 32,
      method: "tools/call",
      params: {
        name: "resolve_approval",
        arguments: { approvalId: "approval_test", decision: "approved" },
      },
    },
    { spendos: fakeSpendos() },
  );

  assert.equal(list.result.structuredContent.approvals[0].status, "pending");
  assert.equal(resolved.result.structuredContent.status, "approved");
});

test("MCP tools/call routes preflight_settlement through SpendOS SDK", async () => {
  const response = await handleJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 33,
      method: "tools/call",
      params: {
        name: "preflight_settlement",
        arguments: {
          domain: "api.tokensight.io",
          contract: "0x8335...2913",
          amount: 0.05,
          task: "MCP preflight",
        },
      },
    },
    { spendos: fakeSpendos() },
  );

  assert.equal(response.result.structuredContent.status, "ready");
  assert.equal(response.result.structuredContent.call.ok, true);
});

test("MCP tools/call routes get_launch_readiness through SpendOS SDK", async () => {
  const response = await handleJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 34,
      method: "tools/call",
      params: {
        name: "get_launch_readiness",
        arguments: { agent: "research-agent" },
      },
    },
    { spendos: fakeSpendos() },
  );

  assert.equal(response.result.structuredContent.status, "not_ready");
  assert.equal(response.result.structuredContent.score.total, 7);
});

test("MCP tool execution errors are returned as tool results", async () => {
  const result = await callSpendOsTool(
    "submit_settlement",
    {
      domain: "api.tokensight.io",
      contract: "0x8335...2913",
      amount: 0.05,
    },
    { spendos: fakeSpendos() },
  );

  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.status, 503);
  assert.equal(result.structuredContent.error, "vault_address_not_configured");
});

test("MCP unknown tool returns JSON-RPC invalid params", async () => {
  const response = await handleJsonRpcMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "unknown_tool",
      arguments: {},
    },
  });

  assert.equal(response.error.code, -32602);
  assert.match(response.error.message, /Unknown SpendOS tool/);
});

test("stdio server reads newline JSON-RPC and writes newline JSON-RPC", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let rawOutput = "";
  output.on("data", (chunk) => {
    rawOutput += chunk.toString("utf8");
  });

  const server = startStdioServer({ input, output, spendos: fakeSpendos() });
  input.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "get_agent_file",
        arguments: { agent: "research-agent" },
      },
    })}\n`,
  );

  await new Promise((resolve) => setTimeout(resolve, 25));
  server.close();

  const response = JSON.parse(rawOutput.trim());
  assert.equal(response.id, 5);
  assert.equal(response.result.structuredContent.agentId, "research-agent");
  assert.equal(response.result.structuredContent.asset, "USDC");
});
