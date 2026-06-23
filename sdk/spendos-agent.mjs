export class SpendOSError extends Error {
  constructor(message, { status = 0, payload = null } = {}) {
    super(message);
    this.name = "SpendOSError";
    this.status = status;
    this.payload = payload;
  }
}

export class SpendOS {
  constructor({ baseUrl = "http://127.0.0.1:4191", agent = "research-agent", apiKey = "", fetchImpl = globalThis.fetch } = {}) {
    if (!fetchImpl) {
      throw new SpendOSError("fetch_unavailable");
    }

    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.agent = agent;
    this.apiKey = apiKey || process.env?.SPENDOS_API_KEYS?.split(",")[0] || "";
    this.fetch = fetchImpl;
  }

  async health() {
    return this.#request("/health", { method: "GET" });
  }

  async getAgent(agent = this.agent) {
    return this.#request(`/v1/agents/${encodeURIComponent(agent)}`, { method: "GET" });
  }

  async requestBudget(payload = {}) {
    return this.#request("/v1/request_budget", {
      method: "POST",
      body: this.#withAgent(payload),
    });
  }

  async checkPolicy(payload = {}) {
    return this.#request("/v1/check_policy", {
      method: "POST",
      body: this.#withAgent(payload),
    });
  }

  async updatePolicy(payload = {}) {
    return this.#request("/v1/policies/update", {
      method: "POST",
      body: this.#withAgent(payload),
    });
  }

  async payX402(payload = {}) {
    return this.#request("/v1/pay_x402", {
      method: "POST",
      body: this.#withAgent(payload),
    });
  }

  async previewSettlement(payload = {}) {
    return this.#request("/v1/settlement/preview", {
      method: "POST",
      body: this.#withAgent(payload),
    });
  }

  async preflightSettlement(payload = {}) {
    return this.#request("/v1/settlement/preflight", {
      method: "POST",
      body: this.#withAgent(payload),
    });
  }

  async getSettlementConfig() {
    return this.#request("/v1/settlement/config", { method: "GET" });
  }

  async getVaultStatus({ agent = this.agent } = {}) {
    return this.#request(`/v1/vault/status?agentId=${encodeURIComponent(agent)}`, { method: "GET" });
  }

  async getLaunchReadiness({ agent = this.agent } = {}) {
    return this.#request(`/v1/launch/readiness?agentId=${encodeURIComponent(agent)}`, { method: "GET" });
  }

  async submitSettlement(payload = {}) {
    return this.#request("/v1/settlement/submit", {
      method: "POST",
      body: this.#withAgent(payload),
    });
  }

  async getReceipts({ agent = this.agent } = {}) {
    return this.#request(`/v1/receipts?agentId=${encodeURIComponent(agent)}`, { method: "GET" });
  }

  async getApprovals({ agent = this.agent, status = "" } = {}) {
    const query = new URLSearchParams();
    if (agent) query.set("agentId", agent);
    if (status) query.set("status", status);
    return this.#request(`/v1/approvals?${query.toString()}`, { method: "GET" });
  }

  async resolveApproval(payload = {}) {
    return this.#request("/v1/approvals/resolve", {
      method: "POST",
      body: payload,
    });
  }

  async pauseAgent({ agent = this.agent, paused = true } = {}) {
    return this.#request("/v1/pause_agent", {
      method: "POST",
      body: { agentId: agent, paused },
    });
  }

  async resumeAgent({ agent = this.agent } = {}) {
    return this.pauseAgent({ agent, paused: false });
  }

  async linkAcpWallet(payload = {}) {
    return this.#request("/v1/acp/link_wallet", {
      method: "POST",
      body: this.#withAgent(payload),
    });
  }

  async checkAcpJob(payload = {}) {
    return this.#request("/v1/acp/check_job", {
      method: "POST",
      body: this.#withAgent(payload),
    });
  }

  async acpTopup(payload = {}) {
    return this.#request("/v1/acp/topup", {
      method: "POST",
      body: this.#withAgent(payload),
    });
  }

  async analyzeWalletDemo({ agent = this.agent } = {}) {
    return this.#request("/v1/demo/analyze_wallet", {
      method: "POST",
      body: { agentId: agent },
    });
  }

  /**
   * Automatic x402 payment cycle:
   * 1. Request url
   * 2. If 402, get payment from SpendOS + settle
   * 3. Retry with X-Payment header
   */
  async fetch402(url, { method = "GET", body = null, task = "", recipient = "" } = {}) {
    const headers = body ? { "Content-Type": "application/json" } : {};

    // Initial request
    const first = await this.fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (first.status !== 402) {
      return first.json().catch(() => null);
    }

    // 402 — payment requirements
    const req402 = await first.json();
    const x402 = req402.x402;
    if (!x402) throw new SpendOSError("invalid_402_response", { status: 402, payload: req402 });

    const domain = x402.domain || new URL(url).hostname;
    const contract = x402.contract || "";

    // Create payment via proxy
    const paid = await this.payX402({
      domain,
      contract,
      amount: x402.amount,
      asset: x402.asset || "USDC",
      task: task || x402.description || domain,
      recipient: recipient || "",
    });

    if (paid.status !== "approved") {
      throw new SpendOSError("payment_rejected", { status: 402, payload: paid });
    }

    // On-chain settle
    const settled = await this.submitSettlement({
      domain,
      contract,
      amount: x402.amount,
      asset: x402.asset || "USDC",
      task: task || x402.description || domain,
      recipient: recipient || "",
      receiptHash: paid.receipt?.receiptHash,
    });

    const receiptId = settled.receipt?.id || paid.receipt?.id;
    if (!receiptId) throw new SpendOSError("settlement_failed", { payload: settled });

    // Payment confirmed — retry with X-Payment header
    const retryHeaders = { ...headers, "X-Payment": `spendos:${receiptId}` };
    const retryRes = await this.fetch(url, {
      method,
      headers: retryHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = await retryRes.json().catch(() => null);
    return { ...result, _payment: { receiptId, txHash: settled.txHash, amount: x402.amount } };
  }

  #withAgent(payload) {
    return {
      agentId: payload.agentId || this.agent,
      ...payload,
    };
  }

  async #request(path, { method, body } = {}) {
    const headers = {};
    if (this.apiKey) headers["X-SpendOS-Key"] = this.apiKey;
    if (body) headers["content-type"] = "application/json";
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new SpendOSError(payload?.error || payload?.reason || "spendos_request_failed", {
        status: response.status,
        payload,
      });
    }

    return payload;
  }
}

export default SpendOS;
