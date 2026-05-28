const agents = {
  "research-agent": {
    balance: 9.57,
    spent: 0.43,
    dailyLimit: 10,
    txLimit: 0.25,
    address: "0x1A01...47b",
    fullAddress: "0x1A01621eB367e25B3584dD1e2dd0b5b7A2497b47",
    vaultContract: "0xC3C474a7917eCFDE5A25B64A58a190f901F9241A",
    lastTx: "0xd729...9a47",
    riskScore: 18,
    memo: "Research agent may buy data, never custody strategy.",
    state: "2 approved / 1 pending / 1 blocked",
    domains: ["api.tokensight.io", "risk.baseintel.net", "decode.calldata.run", "deepindex.baseops.ai"],
    contracts: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "0x4200000000000000000000000000000000000006", "0xC3C474a7917eCFDE5A25B64A58a190f901F9241A"],
    requests: [
      {
        service: "api.tokensight.io",
        cost: "0.18 USDC",
        amount: 0.18,
        contract: "0x8335...2913",
        detail: "Token price API for wallet analysis",
        status: "approved",
      },
      {
        service: "risk.baseintel.net",
        cost: "0.24 USDC",
        amount: 0.24,
        contract: "0x4200...0006",
        detail: "Wallet risk scan with receipt binding",
        status: "approved",
      },
      {
        service: "deepindex.baseops.ai",
        cost: "0.44 USDC",
        amount: 0.44,
        contract: "0x4200...0006",
        detail: "Deep wallet clustering above transaction limit",
        status: "pending",
      },
      {
        service: "unknown-indexer.ai",
        cost: "0.90 USDC",
        amount: 0.9,
        contract: "0x0bad...feed",
        detail: "Contract decode request exceeds trust threshold",
        status: "blocked",
      },
    ],
  },
  "market-sentinel": {
    balance: 76.12,
    spent: 1.08,
    dailyLimit: 25,
    txLimit: 0.75,
    address: "0x41f0...9C01",
    fullAddress: "0x41f0e96cBEe370F9E9A9D27348Aa3F6049BC9C01",
    lastTx: "0x91fd...4fb2",
    riskScore: 27,
    memo: "Market sentinel may observe liquidity, never execute trades.",
    state: "4 approved / 2 pending",
    domains: ["depth.signalbase.com", "makerflow.net"],
    contracts: ["0x8335...2913", "0x4200...0006"],
    requests: [
      {
        service: "depth.signalbase.com",
        cost: "0.34 USDC",
        amount: 0.34,
        contract: "0x8335...2913",
        detail: "DEX liquidity monitor update",
        status: "approved",
      },
      {
        service: "volatility.orbit.run",
        cost: "0.41 USDC",
        amount: 0.41,
        contract: "0x9f9f...7777",
        detail: "24h volatility expansion query",
        status: "pending",
      },
      {
        service: "makerflow.net",
        cost: "0.33 USDC",
        amount: 0.33,
        contract: "0x4200...0006",
        detail: "Market-maker label enrichment",
        status: "approved",
      },
    ],
  },
  "contract-decoder": {
    balance: 18.04,
    spent: 0.16,
    dailyLimit: 5,
    txLimit: 0.12,
    address: "0x8E22...D871",
    fullAddress: "0x8E22B6d92C14C863992B81Bd48F029E19230D871",
    lastTx: "0x2c88...aa19",
    riskScore: 12,
    memo: "Decoder is locked to calldata tools and verified contracts.",
    state: "1 approved / 1 denied",
    domains: ["decode.calldata.run", "bytecode.tracebase.org"],
    contracts: ["0x2f5a...bace", "0x4200...0006"],
    requests: [
      {
        service: "decode.calldata.run",
        cost: "0.08 USDC",
        amount: 0.08,
        contract: "0x2f5a...bace",
        detail: "ABI match for unverified interaction",
        status: "approved",
      },
      {
        service: "private-rpc.shadow",
        cost: "0.08 USDC",
        amount: 0.08,
        contract: "0xdead...beef",
        detail: "Endpoint metadata leak suspected",
        status: "blocked",
      },
      {
        service: "bytecode.tracebase.org",
        cost: "0.06 USDC",
        amount: 0.06,
        contract: "0x4200...0006",
        detail: "Source map fetch under per-transaction limit",
        status: "pending",
      },
    ],
  },
};

const logs = [
  "POLICY: daily limit set to 10.00 USDC",
  "REQUEST: research-agent wants to pay 0.18 USDC",
  "CHECK: domain allowlist matched",
  "DENY: endpoint risk score above threshold",
  "RECEIPT: payment recorded on Base",
];

const pageMeta = {
  activity: {
    title: "Activity",
    code: "REALTIME / BASE",
    summary: "Live autonomous spend operations, payment queue, policy decisions, and receipt generation.",
  },
  policies: {
    title: "Policies",
    code: "POLICY / JSON",
    summary: "Agent spend boundaries, allowlists, approval thresholds, and enforcement configuration.",
  },
  vault: {
    title: "Vault",
    code: "BASE / AUTH",
    summary: "Owner-signed spend authority, USDC vault metadata, policy digest, and onchain enforcement interface.",
  },
  x402: {
    title: "x402",
    code: "PAYMENT / PROXY",
    summary: "Payment proxy path for paid APIs, x402 headers, bounded signing, and denial responses.",
  },
  mcp: {
    title: "MCP",
    code: "AGENT / TOOLS",
    summary: "Developer integration layer for agent budgets, policy checks, x402 payments, receipts, and emergency pause.",
  },
  risk: {
    title: "Risk",
    code: "RISK / SCAN",
    summary: "Endpoint risk, metadata leakage, price anomalies, and contract trust inspection.",
  },
  receipts: {
    title: "Receipts",
    code: "AUDIT / LEDGER",
    summary: "Audit ledger for approved payments, blocked requests, tx hashes, and export bundles.",
  },
  simulation: {
    title: "Simulation",
    code: "DRY-RUN / COST",
    summary: "Dry-run autonomous tasks before giving the agent live spend authority.",
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const elements = {
  agentSelect: $("#agentSelect"),
  walletBalance: $("#walletBalance"),
  spentToday: $("#spentToday"),
  budgetRange: $("#budgetRange"),
  budgetValue: $("#budgetValue"),
  domainInput: $("#domainInput"),
  addDomain: $("#addDomain"),
  domainList: $("#domainList"),
  contractInput: $("#contractInput"),
  addContract: $("#addContract"),
  contractList: $("#contractList"),
  dailyLimit: $("#dailyLimit"),
  txLimit: $("#txLimit"),
  fileDailyLimit: $("#fileDailyLimit"),
  riskScore: $("#riskScore"),
  memoText: $("#memoText"),
  riskMode: $("#riskMode"),
  activeAgentName: $("#activeAgentName"),
  spendState: $("#spendState"),
  activityLog: $("#activityLog"),
  viewPage: $("#viewPage"),
  modeReadout: $("#modeReadout"),
  toast: $("#toast"),
  launchApp: $("#launchApp"),
  navLaunchApp: $("#navLaunchApp"),
  openRisk: $("#openRisk"),
  networkPill: $("#networkPill"),
  connectWallet: $("#connectWallet"),
  disconnectWallet: $("#disconnectWallet"),
  deployVault: $("#deployVault"),
  resetLocalState: $("#resetLocalState"),
  libraryPanel: $("#libraryPanel"),
  vaultStatus: $("#vaultStatus"),
  vaultAddressShort: $("#vaultAddressShort"),
  vaultAddressFull: $("#vaultAddressFull"),
  ownerAddress: $("#ownerAddress"),
  lastTxHash: $("#lastTxHash"),
};

let activeAgent = "research-agent";
let activeMode = "simulate";
let activeTab = pageMeta[window.location.hash.slice(1)] ? window.location.hash.slice(1) : "activity";
let isPaused = false;
let simulationRuns = 0;
let mcpTestRuns = 0;
let proxyOnline = false;
let proxyLastCheckedAt = "";
let proxyLastResponse = null;
let vaultLastStatus = null;
let settlementLastPreflight = null;
let launchLastReadiness = null;
let walletConnected = false;
let ownerAddress = "";
let chainId = "";
let walletProvider = null;
let operationKeys = {};
const pendingOperations = new Set();
const requestOverrides = {};
const policyAttestations = {};
let receiptFilter = "all";
let selectedReceiptId = "";
let proxyReceiptCache = {};
let proxySyncInterval = null;

const BASE_CHAIN_ID = "0x2105";
const BASE_NETWORK = {
  chainId: BASE_CHAIN_ID,
  chainName: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://mainnet.base.org"],
  blockExplorerUrls: ["https://basescan.org"],
};
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PROXY_BASE_URL = window.SPENDOS_PROXY_URL || "http://127.0.0.1:4191";

const STORAGE_KEY = "spendos-demo-state-v1";

function saveState() {
  try {
    const state = {
      agents,
      activeAgent,
      activeMode,
      activeTab,
      isPaused,
      simulationRuns,
      mcpTestRuns,
      proxyOnline,
      proxyLastCheckedAt,
      proxyLastResponse,
      vaultLastStatus,
      settlementLastPreflight,
      launchLastReadiness,
      operationKeys,
      receiptFilter,
      selectedReceiptId,
      requestOverrides,
      policyAttestations,
      proxyReceiptCache,
      logs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    showToast("STATE WARNING: local browser storage unavailable.");
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (state.agents) {
      Object.keys(agents).forEach((key) => {
        if (state.agents[key]) agents[key] = state.agents[key];
      });
    }
    if (state.requestOverrides) {
      Object.assign(requestOverrides, state.requestOverrides);
    }
    if (state.policyAttestations) {
      Object.assign(policyAttestations, state.policyAttestations);
    }
    if (Array.isArray(state.logs)) {
      logs.splice(0, logs.length, ...state.logs.slice(0, 8));
    }
    activeAgent = agents[state.activeAgent] ? state.activeAgent : activeAgent;
    activeMode = state.activeMode || activeMode;
    activeTab = pageMeta[state.activeTab] ? state.activeTab : activeTab;
    isPaused = Boolean(state.isPaused);
    simulationRuns = Number(state.simulationRuns || 0);
    mcpTestRuns = Number(state.mcpTestRuns || 0);
    proxyOnline = Boolean(state.proxyOnline);
    proxyLastCheckedAt = state.proxyLastCheckedAt || "";
    proxyLastResponse = state.proxyLastResponse || null;
    vaultLastStatus = state.vaultLastStatus || null;
    settlementLastPreflight = state.settlementLastPreflight || null;
    launchLastReadiness = state.launchLastReadiness || null;
    operationKeys = state.operationKeys || {};
    receiptFilter = state.receiptFilter || receiptFilter;
    selectedReceiptId = state.selectedReceiptId || "";
    if (state.proxyReceiptCache && typeof state.proxyReceiptCache === "object") {
      Object.assign(proxyReceiptCache, state.proxyReceiptCache);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  showToast("LOCAL STATE CLEARED: reload to restore factory demo.");
}

function openApp(tab = activeTab, updateHash = true) {
  activeTab = pageMeta[tab] ? tab : "activity";
  document.body.classList.add("app-open");
  syncActiveTab();
  renderAgent();
  if (updateHash) {
    window.history.replaceState(null, "", `#${activeTab}`);
  }
  saveState();
}

function openLaunch() {
  document.body.classList.remove("app-open");
  if (window.location.hash) {
    window.history.replaceState(null, "", window.location.pathname);
  }
}

function formatUSDC(value) {
  return `${Number(value).toFixed(2)} USDC`;
}

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getEthereumProvider() {
  if (window.ethereum?.providers?.length) {
    return window.ethereum.providers.find((provider) => provider.isMetaMask) || window.ethereum.providers[0];
  }
  return window.ethereum || null;
}

function isBaseNetwork() {
  return chainId?.toLowerCase() === BASE_CHAIN_ID;
}

function statusText(status) {
  if (status === "approved") return "Approved";
  if (status === "blocked") return "Blocked";
  return "Pending";
}

function evaluateRequest(agent, request) {
  const override = requestOverrides[activeAgent]?.[request.service];
  if (override === "approved") {
    return { status: "approved", reason: "owner override approved" };
  }
  if (override === "blocked") {
    return { status: "blocked", reason: "owner override denied" };
  }

  const domainAllowed = agent.domains.includes(request.service);
  const contractAllowed = agent.contracts.includes(request.contract);
  const txLimit = Number(elements.txLimit?.value || agent.txLimit);

  if (!domainAllowed) {
    return { status: "blocked", reason: "domain not allowlisted" };
  }
  if (!contractAllowed) {
    return { status: "blocked", reason: "contract not allowlisted" };
  }
  if (request.amount > txLimit) {
    return { status: "pending", reason: "above transaction limit" };
  }
  return { status: "approved", reason: "policy matched" };
}

function evaluatedRequests(agent) {
  return agent.requests.map((request) => ({ ...request, ...evaluateRequest(agent, request) }));
}

function riskScoreFor(agent, request) {
  let score = 12;
  const reasons = [];
  if (!agent.domains.includes(request.service)) {
    score += 42;
    reasons.push("unknown domain");
  }
  if (!agent.contracts.includes(request.contract)) {
    score += 26;
    reasons.push("untrusted contract");
  }
  if (request.amount > Number(elements.txLimit?.value || agent.txLimit)) {
    score += 18;
    reasons.push("above transaction cap");
  }
  if (request.service.includes("unknown") || request.service.includes("shadow")) {
    score += 10;
    reasons.push("weak endpoint reputation");
  }
  return { score: Math.min(score, 99), reasons: reasons.length ? reasons : ["policy matched"] };
}

function enforcementCounts(agent) {
  return evaluatedRequests(agent).reduce(
    (counts, request) => {
      counts[request.status] += 1;
      return counts;
    },
    { approved: 0, blocked: 0, pending: 0 },
  );
}

function enforcementSummary(agent) {
  const counts = enforcementCounts(agent);
  const parts = [];
  if (counts.approved) parts.push(`${counts.approved} approved`);
  if (counts.pending) parts.push(`${counts.pending} pending`);
  if (counts.blocked) parts.push(`${counts.blocked} blocked`);
  return parts.join(" / ") || "no requests";
}

function receiptHashFor(request, index) {
  if (request.status === "blocked") return "no tx / denied";
  const seeds = ["7aa4", "91fd", "2c88", "bc04", "a771", "19f0", "5d9e"];
  const tails = ["e201", "4fb2", "aa19", "8c30", "71ef", "d021", "51bb"];
  return `0x${seeds[index % seeds.length]}...${tails[index % tails.length]}`;
}

function receiptRecords(agent) {
  const cached = proxyReceiptCache[activeAgent];
  if (cached && cached.length > 0) {
    return cached.map((r) => ({
      id: r.id,
      service: r.domain || r.service || "",
      amount: `${Number(r.amount).toFixed(2)} USDC`,
      rawAmount: Number(r.amount),
      status: r.status,
      detail: r.task || "",
      reason: r.reason || "",
      contract: r.contract || "",
      txHash: r.txHash || (r.receiptHash ? `${r.receiptHash.slice(0, 6)}...${r.receiptHash.slice(-4)}` : "—"),
      timestamp: r.createdAt || new Date().toISOString(),
    }));
  }
  return evaluatedRequests(agent).map((request, index) => ({
    id: `spos-${activeAgent}-${index + 1}`,
    service: request.service,
    amount: request.cost,
    rawAmount: request.amount,
    status: request.status,
    detail: request.detail,
    reason: request.reason,
    contract: request.contract,
    txHash: receiptHashFor(request, index),
    timestamp: new Date(Date.now() - index * 420000).toISOString(),
  }));
}

function currentPolicyPayload() {
  const agent = agents[activeAgent];
  return {
    product: "SpendOS",
    agent: activeAgent,
    network: "Base",
    chainId: BASE_CHAIN_ID,
    asset: "USDC",
    usdcContract: BASE_USDC_ADDRESS,
    mode: activeMode,
    walletBalance: formatUSDC(agent.balance),
    vaultAddress: agent.fullAddress,
    dailyLimit: formatUSDC(elements.dailyLimit.value || agent.dailyLimit),
    perTransactionLimit: formatUSDC(elements.txLimit.value || agent.txLimit),
    domains: [...agent.domains],
    contracts: [...agent.contracts],
    riskScore: agent.riskScore,
    spendAuthority: isPaused ? "paused" : "policy-bound",
  };
}

function policyDigestFor(payload = currentPolicyPayload()) {
  const source = JSON.stringify(payload);
  const chunks = [
    pseudoHex(`spendos-a:${source}`),
    pseudoHex(`spendos-b:${source}`),
    pseudoHex(`spendos-c:${source}`),
    pseudoHex(`spendos-d:${source}`),
    pseudoHex(`spendos-e:${source}`),
    pseudoHex(`spendos-f:${source}`),
    pseudoHex(`spendos-g:${source}`),
    pseudoHex(`spendos-h:${source}`),
  ];
  return `0x${chunks.join("").slice(0, 64)}`;
}

function currentPolicySnapshot() {
  const payload = currentPolicyPayload();
  return {
    ...payload,
    chainId: chainId || BASE_CHAIN_ID,
    ownerAddress: ownerAddress || null,
    policyDigest: policyDigestFor(payload),
    attestation: policyAttestations[activeAgent] || null,
  };
}

function proxyPolicyPayload() {
  const agent = agents[activeAgent];
  return {
    agentId: activeAgent,
    dailyLimit: Number(elements.dailyLimit?.value || agent.dailyLimit),
    perTransactionLimit: Number(elements.txLimit?.value || agent.txLimit),
    domains: [...agent.domains],
    contracts: [...agent.contracts],
    riskMode: activeMode === "enforce" ? "enforce" : activeMode === "monitor" ? "monitor" : "adaptive",
    paused: isPaused,
  };
}

function syncAgentFromProxyPolicy(policy = {}) {
  const agent = agents[policy.agentId || activeAgent];
  if (!agent) return;

  if (Number.isFinite(Number(policy.balance))) agent.balance = Number(policy.balance);
  if (Number.isFinite(Number(policy.spentToday))) agent.spent = Number(policy.spentToday);
  if (Number.isFinite(Number(policy.dailyLimit))) agent.dailyLimit = Number(policy.dailyLimit);
  if (Number.isFinite(Number(policy.perTransactionLimit))) agent.txLimit = Number(policy.perTransactionLimit);
  if (Array.isArray(policy.domains)) agent.domains = [...policy.domains];
  if (Array.isArray(policy.contracts)) agent.contracts = [...policy.contracts];
  if (typeof policy.paused === "boolean") isPaused = policy.paused;
  if (policy.vaultAddress && policy.vaultAddress !== "0x0000000000000000000000000000000000000000") {
    agent.fullAddress = policy.vaultAddress;
    agent.address = policy.vaultAddress.slice(0, 6) + "..." + policy.vaultAddress.slice(-4);
  }
}

async function syncAgentStateFromProxy(agentId) {
  try {
    const data = await proxyRequest(`/v1/agents/${encodeURIComponent(agentId)}`, null, "GET");
    syncAgentFromProxyPolicy(data);
    return data;
  } catch {
    return null;
  }
}

async function syncReceiptsFromProxy(agentId) {
  try {
    const data = await proxyRequest(`/v1/receipts?agentId=${encodeURIComponent(agentId)}`, null, "GET");
    if (Array.isArray(data.receipts)) {
      proxyReceiptCache[agentId] = data.receipts;
    }
    return data.receipts || [];
  } catch {
    return null;
  }
}

async function fullProxySync(silent = false) {
  const agentId = activeAgent;
  const agentData = await syncAgentStateFromProxy(agentId);
  if (agentData) await syncReceiptsFromProxy(agentId);
  if (!silent) renderAgent();
}

function startProxyPolling() {
  if (proxySyncInterval) clearInterval(proxySyncInterval);
  proxySyncInterval = setInterval(async () => {
    if (!proxyOnline) return;
    await fullProxySync(true);
    renderAgent();
  }, 9000);
}

function currentReceiptBundle() {
  const agent = agents[activeAgent];
  return {
    product: "SpendOS",
    agent: activeAgent,
    network: "Base",
    asset: "USDC",
    task: "Analyze this wallet",
    generatedAt: new Date().toISOString(),
    summary: `${enforcementSummary(agent)}. Receipts attached.`,
    receipts: receiptRecords(agent),
  };
}

function proxyStatusLabel() {
  return proxyOnline ? '<span class="proxy-live">ONLINE</span>' : "LOCAL FALLBACK";
}

function newOperationKey(scope) {
  if (window.crypto?.randomUUID) {
    return `spendos-${scope}-${window.crypto.randomUUID()}`;
  }

  return `spendos-${scope}-${activeAgent}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function operationKey(scope) {
  operationKeys[scope] ||= newOperationKey(scope);
  return operationKeys[scope];
}

function rotateOperationKey(scope) {
  operationKeys[scope] = newOperationKey(scope);
  saveState();
  return operationKeys[scope];
}

function operationBusy(scope) {
  if (!pendingOperations.has(scope)) return false;
  showToast("REQUEST ACTIVE: awaiting existing SpendOS decision.");
  return true;
}

function startOperation(scope) {
  pendingOperations.add(scope);
}

function finishOperation(scope) {
  pendingOperations.delete(scope);
}

function proxyResponsePreview() {
  if (!proxyLastResponse) {
    return JSON.stringify(
      {
        proxy: PROXY_BASE_URL,
        status: "not_checked",
        next: "Run a proxy check or submit an x402 payment.",
      },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      ...proxyLastResponse,
      replayProtection: proxyLastResponse.idempotencyKey
        ? {
            idempotencyKey: proxyLastResponse.idempotencyKey,
            replayed: Boolean(proxyLastResponse.replayed),
          }
        : "not_attached",
    },
    null,
    2,
  );
}

function vaultStatusPreview() {
  if (!vaultLastStatus) {
    return JSON.stringify(
      {
        proxy: PROXY_BASE_URL,
        status: "not_checked",
        next: "Run Check Vault to read SpendOSVault status when RPC and vault address are configured.",
      },
      null,
      2,
    );
  }

  return JSON.stringify(vaultLastStatus, null, 2);
}

function settlementPreflightPreview() {
  if (!settlementLastPreflight) {
    return JSON.stringify(
      {
        proxy: PROXY_BASE_URL,
        status: "not_checked",
        next: "Run Preflight to execute a read-only onchain call before settlement submission.",
      },
      null,
      2,
    );
  }

  return JSON.stringify(settlementLastPreflight, null, 2);
}

function launchReadinessPreview() {
  if (!launchLastReadiness) {
    return JSON.stringify(
      {
        proxy: PROXY_BASE_URL,
        status: "not_checked",
        next: "Run Launch Check to aggregate vault, RPC, operator, policy, funding, and preflight readiness.",
      },
      null,
      2,
    );
  }

  return JSON.stringify(launchLastReadiness, null, 2);
}

function mcpToolDefinitions() {
  return [
    ["get_agent_file", "Return agent policy, vault metadata, daily limits, and current policy digest."],
    ["request_budget", "Reserve bounded USDC budget for a task before the agent calls paid tools."],
    ["check_policy", "Evaluate endpoint, contract, amount, task memo, and risk posture before payment."],
    ["update_policy", "Update live limits, allowlists, risk mode, and pause state for an agent."],
    ["pay_x402", "Authorize an x402 API payment when policy and owner authority permit execution."],
    ["preview_settlement", "Generate SpendOSVault calldata without mutating agent spend state."],
    ["preflight_settlement", "Run a read-only onchain preflight before settlement submission."],
    ["get_settlement_config", "Return vault address, operator readiness, and settlement function selector."],
    ["get_vault_status", "Read onchain vault policy, balance, pause state, and operator authorization."],
    ["get_launch_readiness", "Aggregate deployment, vault, operator, funding, and preflight launch checks."],
    ["submit_settlement", "Submit a vault settlement transaction through the configured operator signer."],
    ["get_receipts", "Return receipt-bound spend history for audit, accounting, and agent evals."],
    ["get_approvals", "Return pending and resolved owner approval requests for agent spend."],
    ["resolve_approval", "Approve or deny a pending payment approval with an auditable decision."],
    ["pause_agent", "Suspend spend authority when risk rises or owner intervention is required."],
    ["resume_agent", "Restore spend authority after owner or policy review."],
  ];
}

function currentMcpManifest() {
  const policy = currentPolicySnapshot();
  return {
    name: "spendos-mcp",
    product: "SpendOS",
    description: "Autonomous financial enforcement tools for AI agent spending on Base.",
    network: "base",
    asset: "USDC",
    activeAgent,
    vaultAddress: agents[activeAgent].fullAddress,
    transport: {
      command: "node",
      args: ["mcp/spendos-mcp-server.mjs"],
      local: "stdio",
      remote: "https://api.spendos.dev/mcp",
    },
    policy,
    tools: mcpToolDefinitions().map(([name, description]) => ({
      name,
      description,
      authorization: name === "pause_agent" ? "owner_or_policy_engine" : "policy_engine",
    })),
  };
}

function mcpSdkSnippet() {
  const agent = agents[activeAgent];
  return `import { SpendOS } from "@spendos/agent";

const spendos = new SpendOS({
  network: "base",
  agent: "${activeAgent}",
  vault: "${agent.fullAddress}",
  asset: "USDC"
});

await spendos.requestBudget({
  task: "Analyze this wallet",
  maxSpend: "${formatUSDC(agent.txLimit)}"
});

const decision = await spendos.checkPolicy({
  domain: "${agent.domains[0] || "api.service.com"}",
  contract: "${agent.contracts[0] || "0x..."}",
  amount: "${formatUSDC(Math.min(agent.txLimit, 0.12))}"
});

if (decision.status === "approved") {
  const receipt = await spendos.payX402(decision);
  console.log(receipt.txHash);
}`;
}

function vaultContractInterface() {
  return [
    "constructor(address usdcAddress)",
    "function registerAgent(address agentVault)",
    "function fundAgent(address agentVault, uint256 amount)",
    "function withdrawAgent(address agentVault, uint256 amount, address recipient)",
    "function setOperator(address operator, bool allowed)",
    "function authorizePolicy(address agentVault, uint256 dailyLimit, uint256 perTransactionLimit, bytes32 policyDigest, bytes ownerSignature)",
    "function setPaused(address agentVault, bool paused)",
    "function spendUSDC(address agentVault, address recipient, uint256 amount, string service, bytes32 receiptHash)",
    "function policyMessageHash(address agentVault, uint256 dailyLimit, uint256 perTransactionLimit, bytes32 policyDigest) view returns (bytes32)",
    "event AgentRegistered(address indexed owner, address indexed agentVault)",
    "event AgentFunded(address indexed owner, address indexed agentVault, uint256 amount)",
    "event PolicyAuthorized(address indexed owner, address indexed agentVault, bytes32 indexed policyDigest, uint256 dailyLimit, uint256 perTransactionLimit)",
    "event AgentPaused(address indexed owner, address indexed agentVault, bool paused)",
    "event ReceiptRecorded(address indexed agentVault, address indexed recipient, string service, uint256 amount, bytes32 indexed receiptHash, bytes32 policyDigest)",
  ];
}

function currentVaultAttestation() {
  const payload = currentPolicyPayload();
  const digest = policyDigestFor(payload);
  return {
    domain: {
      name: "SpendOS Vault Authority",
      version: "0.1",
      chainId: 8453,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    },
    message: {
      agent: activeAgent,
      vaultAddress: agents[activeAgent].fullAddress,
      asset: "USDC",
      usdcContract: BASE_USDC_ADDRESS,
      dailyLimit: payload.dailyLimit,
      perTransactionLimit: payload.perTransactionLimit,
      mode: activeMode,
      policyDigest: digest,
    },
    lastSignature: policyAttestations[activeAgent] || null,
  };
}

function downloadJSON(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderAgent() {
  const agent = agents[activeAgent];
  elements.agentSelect.value = activeAgent;
  elements.walletBalance.textContent = formatUSDC(agent.balance);
  elements.spentToday.textContent = formatUSDC(agent.spent);
  elements.dailyLimit.value = agent.dailyLimit;
  elements.txLimit.value = agent.txLimit;
  elements.fileDailyLimit.textContent = formatUSDC(agent.dailyLimit);
  elements.riskScore.textContent = `${agent.riskScore} / 100`;
  elements.memoText.textContent = agent.memo;
  elements.vaultAddressShort.textContent = agent.address;
  elements.vaultAddressFull.textContent = agent.fullAddress;
  elements.ownerAddress.textContent = ownerAddress || "Not connected";
  elements.lastTxHash.textContent = agent.lastTx;
  elements.networkPill.textContent = isBaseNetwork() ? "Base / USDC" : walletConnected ? "Wrong Network" : "Base / USDC";
  elements.vaultStatus.textContent = walletConnected && isBaseNetwork() ? "Live" : walletConnected ? "Wrong chain" : "Deployed";
  elements.deployVault.textContent = walletConnected ? "Rotate Vault Key" : "Connect To Rotate";
  elements.connectWallet.textContent = walletConnected ? shortAddress(ownerAddress) : "Connect Wallet";
  elements.disconnectWallet.hidden = !walletConnected;
  $("#pauseAgent").textContent = isPaused ? "Resume Agent" : "Pause Agent";
  $("#pauseAgentRight").textContent = isPaused ? "Resume Agent" : "Pause Agent";
  syncActiveMode();
  renderPolicyLists(agent);
  elements.activeAgentName.textContent = activeAgent;
  elements.spendState.textContent = isPaused ? "agent paused" : enforcementSummary(agent);
  elements.riskMode.textContent = activeMode === "enforce" ? "Enforced" : activeMode === "monitor" ? "Observe" : "Adaptive";
  renderView();
  renderLibrary(agent);
  renderLogs();
}

function renderPolicyLists(agent) {
  elements.domainList.innerHTML = agent.domains
    .map(
      (domain) => `
        <span>${domain}<button aria-label="Remove ${domain}" data-policy-type="domains" data-policy-value="${domain}">×</button></span>
      `,
    )
    .join("");
  elements.contractList.innerHTML = agent.contracts
    .map(
      (contract) => `
        <span>${contract}<button aria-label="Remove ${contract}" data-policy-type="contracts" data-policy-value="${contract}">×</button></span>
      `,
    )
    .join("");
}

function requestRows(requests) {
  return requests
    .map(
      (request) => `
        <article class="request-row">
          <div>
            <strong>${request.cost}</strong>
            <small>${request.service} / ${request.detail}</small>
            ${request.reason ? `<small>Decision: ${request.reason}</small>` : ""}
          </div>
          <div class="request-actions">
            <span class="status ${request.status}">${statusText(request.status)}</span>
            ${
              request.status === "pending"
                ? `<button data-request-action="approve" data-service="${request.service}" data-approval-id="${request.approvalId || ""}">Approve</button><button data-request-action="deny" data-service="${request.service}" data-approval-id="${request.approvalId || ""}">Deny</button>`
                : ""
            }
          </div>
        </article>
      `,
    )
    .join("");
}

function decisionRows(requests) {
  const decisions = requests.map((request) => {
    if (request.status === "approved") {
      return `ALLOW: ${request.service} matched domain policy and transaction cap.`;
    }
    if (request.status === "blocked") {
      return `DENY: ${request.service} ${request.reason}.`;
    }
    return `PENDING: ${request.service} ${request.reason}; owner approval required.`;
  });

  return decisions
    .map(
      (decision) => `
        <article class="decision">
          <strong>${decision.split(":")[0]}:</strong>${decision.slice(decision.indexOf(":") + 1)}
          <small>Policy engine / ${activeMode.toUpperCase()} / Base</small>
        </article>
      `,
    )
    .join("");
}

function metricCards(cards) {
  return cards
    .map(
      ([heading, body]) => `
        <article class="metric-row">
          <h3>${heading}</h3>
          <p>${body}</p>
        </article>
      `,
    )
    .join("");
}

function pageHeader(meta) {
  return `
    <section class="operation-panel page-intro">
      <div>
        <p class="eyebrow">Operational Page</p>
        <h3>${meta.title}</h3>
        <p>${meta.summary}</p>
      </div>
      <span class="page-code">${meta.code}</span>
    </section>
  `;
}

function renderActivityPage(agent) {
  const requests = evaluatedRequests(agent);
  return `
    ${pageHeader(pageMeta.activity)}
    <section class="operation-panel request-queue">
      <div class="section-head">
        <span class="meta-label">Live payment request queue</span>
        <span class="mono">QUEUE / ${String(requests.length).padStart(2, "0")}</span>
      </div>
      <div class="event-list">${requestRows(requests)}</div>
    </section>
    <section class="operation-panel policy-feed">
      <div class="section-head">
        <span class="meta-label">Policy decision feed</span>
        <span class="mono">ENFORCER / ONLINE</span>
      </div>
      <div class="decision-feed">${decisionRows(requests)}</div>
    </section>
    <section class="operation-panel tab-output">
      <div class="section-head">
        <span class="meta-label">Receipt generation feed</span>
        <span class="mono">AUDIT / LIVE</span>
      </div>
      <div class="tab-content">
        ${metricCards([
          ["Approved payments", `${enforcementCounts(agent).approved} requests can execute through x402 proxy with receipt hashes attached.`],
          ["Blocked requests", `${enforcementCounts(agent).blocked} endpoint paths are denied by active policy.`],
          ["Autonomous enforcement", "Policy engine active. Agent cannot bypass owner-defined spend boundaries."],
        ])}
      </div>
    </section>
  `;
}

function renderPoliciesPage(agent) {
  const counts = enforcementCounts(agent);
  return `
    ${pageHeader(pageMeta.policies)}
    <section class="operation-panel policy-map">
      <div class="section-head">
        <span class="meta-label">Enforcement matrix</span>
        <span class="mono">POLICY / ACTIVE</span>
      </div>
      <div class="policy-matrix">
        <div><span>Daily spend ceiling</span><strong>${formatUSDC(elements.dailyLimit.value || agent.dailyLimit)}</strong></div>
        <div><span>Transaction ceiling</span><strong>${formatUSDC(elements.txLimit.value || agent.txLimit)}</strong></div>
        <div><span>Approval threshold</span><strong>80% daily burn</strong></div>
        <div><span>Risk behavior</span><strong>${elements.riskMode.textContent}</strong></div>
        <div><span>Domain policy</span><strong>${agent.domains.length} domains</strong></div>
        <div><span>Contract policy</span><strong>${agent.contracts.length} contracts</strong></div>
      </div>
    </section>
    <section class="operation-panel code-panel">
      <div class="section-head">
        <span class="meta-label">Policy JSON</span>
        <span class="mono">EXPORTABLE</span>
      </div>
      <pre>{
  "agent": "${activeAgent}",
  "network": "base",
  "asset": "USDC",
  "dailyLimit": "${formatUSDC(elements.dailyLimit.value || agent.dailyLimit)}",
  "perTransaction": "${formatUSDC(elements.txLimit.value || agent.txLimit)}",
  "domains": ${JSON.stringify(agent.domains)},
  "contracts": ${JSON.stringify(agent.contracts)},
  "preview": {
    "approved": ${counts.approved},
    "pending": ${counts.pending},
    "blocked": ${counts.blocked}
  },
  "mode": "${activeMode}"
}</pre>
    </section>
    <section class="operation-panel tab-output">
      <div class="section-head">
        <span class="meta-label">Approval ladder</span>
        <span class="mono">OWNER / RULES</span>
      </div>
      <div class="tab-content">
        ${metricCards([
          ["Auto approve", "Requests below cap, matching allowlists, and low risk execute immediately."],
          ["Manual review", "Unknown contracts, high variance pricing, or large requests pause for owner approval."],
          ["Hard deny", "Metadata leakage, unsafe domains, and unbounded spend requests are blocked."],
        ])}
      </div>
    </section>
  `;
}

function renderVaultPage(agent) {
  const attestation = currentVaultAttestation();
  const lastSignature = policyAttestations[activeAgent];
  const digest = attestation.message.policyDigest;
  const signatureCurrent = Boolean(lastSignature && lastSignature.policyDigest === digest);
  const onchainStatus = vaultLastStatus?.status || "not checked";
  const launchStatus = launchLastReadiness?.status || "not checked";
  const launchScore = launchLastReadiness?.score
    ? `${launchLastReadiness.score.passed}/${launchLastReadiness.score.total}`
    : "--/--";
  const readiness = [
    ["Network", isBaseNetwork() ? "Base active" : walletConnected ? "Wrong chain" : "Base target"],
    ["Vault", agent.vaultContract ? shortAddress(agent.vaultContract) : "Not deployed"],
    ["Agent", shortAddress(agent.fullAddress)],
    ["Owner", ownerAddress ? shortAddress(ownerAddress) : "Not connected"],
    ["USDC", shortAddress(BASE_USDC_ADDRESS)],
    ["Digest", `${digest.slice(0, 10)}...${digest.slice(-8)}`],
    ["Signature", signatureCurrent ? "Signed" : lastSignature ? "Stale" : "Unsigned"],
    ["Onchain", onchainStatus],
    ["Launch", `${launchStatus} ${launchScore}`],
    ["Authority", isPaused ? "Paused" : "Policy-bound"],
  ];
  const launchChecks =
    launchLastReadiness?.checks
      ?.map(
        (check) => `
          <div>
            <span>${check.label}</span>
            <strong>${check.status.toUpperCase()}</strong>
          </div>
        `,
      )
      .join("") || "";

  return `
    ${pageHeader(pageMeta.vault)}
    <section class="operation-panel vault-status-panel">
      <div class="section-head">
        <span class="meta-label">Vault readiness</span>
        <span class="mono">BASE / USDC</span>
      </div>
      <div class="vault-readiness">
        ${readiness
          .map(
            ([label, value]) => `
              <div>
                <span>${label}</span>
                <strong>${value}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
    <section class="operation-panel code-panel">
      <div class="section-head">
        <span class="meta-label">Launch readiness</span>
        <span class="mono">OPS / ${launchLastReadiness?.status ? launchLastReadiness.status.toUpperCase() : "NOT CHECKED"}</span>
      </div>
      ${launchChecks ? `<div class="vault-readiness readiness-checks">${launchChecks}</div>` : ""}
      <pre>${launchReadinessPreview()}</pre>
      <div class="integration-actions">
        <button class="inline-action" data-action="check-launch-readiness">Run Launch Check</button>
      </div>
    </section>
    <section class="operation-panel code-panel">
      <div class="section-head">
        <span class="meta-label">Onchain vault status</span>
        <span class="mono">PROXY / ${vaultLastStatus?.status ? vaultLastStatus.status.toUpperCase() : "NOT CHECKED"}</span>
      </div>
      <pre>${vaultStatusPreview()}</pre>
      <div class="integration-actions">
        <button class="inline-action" data-action="check-vault-status">Check Vault</button>
      </div>
    </section>
    <section class="operation-panel code-panel">
      <div class="section-head">
        <span class="meta-label">Owner policy attestation</span>
        <span class="mono">${signatureCurrent ? "SIGNED" : lastSignature ? "STALE DIGEST" : "SIGNATURE REQUIRED"}</span>
      </div>
      <pre>${JSON.stringify(attestation, null, 2)}</pre>
      <div class="integration-actions">
        <button class="inline-action" data-action="sign-policy-attestation">Sign Policy</button>
        <button class="inline-action" data-action="copy-policy-attestation">Copy Attestation</button>
        <button class="inline-action" data-action="export-policy-attestation">Export Attestation</button>
      </div>
    </section>
    <section class="operation-panel code-panel">
      <div class="section-head">
        <span class="meta-label">Vault contract interface</span>
        <span class="mono">ABI / DRAFT</span>
      </div>
      <pre>${JSON.stringify(vaultContractInterface(), null, 2)}</pre>
      <div class="integration-actions">
        <button class="inline-action" data-action="copy-vault-abi">Copy Interface</button>
      </div>
    </section>
    <section class="operation-panel tab-output">
      <div class="section-head">
        <span class="meta-label">Onchain path</span>
        <span class="mono">OWNER / VAULT / RECEIPT</span>
      </div>
      <div class="tab-content">
        ${metricCards([
          ["Policy digest", "Spend rules are compressed into a deterministic digest before owner approval."],
          ["Owner signature", signatureCurrent ? `Signed by ${shortAddress(lastSignature.owner)} at ${new Date(lastSignature.signedAt).toLocaleTimeString()}.` : lastSignature ? "Existing signature is stale because the active policy digest changed." : "Connect wallet on Base to sign the active policy digest."],
          ["Vault enforcement", "The proxy can submit signed policy authority before allowing x402 spend execution."],
        ])}
      </div>
    </section>
  `;
}

function renderX402Page(agent) {
  const requests = evaluatedRequests(agent);
  return `
    ${pageHeader(pageMeta.x402)}
    <section class="operation-panel payment-composer">
      <div class="section-head">
        <span class="meta-label">New payment request</span>
        <span class="mono">AGENT / X402</span>
      </div>
      <div class="payment-form">
        <label>
          <span class="field-label">Endpoint domain</span>
          <input class="field" id="paymentDomain" type="text" value="api.tokensight.io" />
        </label>
        <label>
          <span class="field-label">Amount USDC</span>
          <input class="field" id="paymentAmount" type="number" min="0.01" step="0.01" value="0.12" />
        </label>
        <label>
          <span class="field-label">Contract</span>
          <input class="field" id="paymentContract" type="text" value="0x8335...2913" />
        </label>
        <label>
          <span class="field-label">Task memo</span>
          <input class="field" id="paymentMemo" type="text" value="On-demand agent market data call" />
        </label>
        <button class="inline-action payment-submit" data-action="submit-payment">Submit Request</button>
        <div class="request-key">
          <span class="field-label">Replay protection</span>
          <strong>${operationKey("payment")}</strong>
        </div>
      </div>
    </section>
    <section class="operation-panel code-panel">
      <div class="section-head">
        <span class="meta-label">Live proxy response</span>
        <span class="mono">PROXY / ${proxyStatusLabel()}</span>
      </div>
      <pre>${proxyResponsePreview()}</pre>
      <div class="integration-actions">
        <button class="inline-action" data-action="check-proxy-health">Check Proxy</button>
        <button class="inline-action" data-action="preflight-settlement">Preflight</button>
        <button class="inline-action" data-action="submit-settlement">Submit Settlement</button>
        <button class="inline-action" data-action="run-wallet-demo">Analyze Wallet Demo</button>
      </div>
    </section>
    <section class="operation-panel code-panel">
      <div class="section-head">
        <span class="meta-label">Onchain preflight</span>
        <span class="mono">ETH_CALL / ${settlementLastPreflight?.status ? settlementLastPreflight.status.toUpperCase() : "NOT CHECKED"}</span>
      </div>
      <pre>${settlementPreflightPreview()}</pre>
      <div class="integration-actions">
        <button class="inline-action" data-action="preflight-settlement">Run Preflight</button>
      </div>
    </section>
    <section class="operation-panel route-panel">
      <div class="section-head">
        <span class="meta-label">Payment proxy route</span>
        <span class="mono">REQUEST / SIGN / RECEIPT</span>
      </div>
      <div class="route-steps">
        <div><span>01</span><strong>Agent requests paid API</strong><small>Task context and endpoint metadata enter SpendOS.</small></div>
        <div><span>02</span><strong>Policy engine checks boundary</strong><small>Domain, price, category, contract, and risk rules are evaluated.</small></div>
        <div><span>03</span><strong>x402 payment is signed</strong><small>Approved requests receive a bounded payment authorization.</small></div>
        <div><span>04</span><strong>Receipt is sealed</strong><small>Spend event is linked to agent, task, endpoint, amount, and tx hash.</small></div>
      </div>
    </section>
    <section class="operation-panel request-queue">
      <div class="section-head">
        <span class="meta-label">Current x402 attempts</span>
        <span class="mono">PROXY / ${activeMode.toUpperCase()}</span>
      </div>
      <div class="event-list">${requestRows(requests)}</div>
    </section>
    <section class="operation-panel tab-output">
      <div class="section-head">
        <span class="meta-label">Endpoint permissions</span>
        <span class="mono">${proxyOnline ? "LIVE API" : "LOCAL ENGINE"}</span>
      </div>
      <div class="tab-content">
        ${metricCards([
          ["Market data", agent.domains.includes("api.tokensight.io") ? "Approved for bounded token price and liquidity lookups." : "Blocked until market data domain is added."],
          ["Wallet risk", agent.domains.includes("risk.baseintel.net") ? "Approved with receipt-bound response capture." : "Blocked until wallet risk domain is added."],
          ["Contract decode", agent.domains.includes("decode.calldata.run") ? "Approved only for allowlisted decode services." : "Blocked until decode service is added."],
        ])}
      </div>
    </section>
  `;
}

function renderMcpPage(agent) {
  const tools = mcpToolDefinitions()
    .map(
      ([name, description], index) => `
        <article class="tool-row">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>${name}</strong>
            <small>${description}</small>
          </div>
          <em>${name === "pause_agent" ? "Owner gate" : "Policy gate"}</em>
        </article>
      `,
    )
    .join("");

  return `
    ${pageHeader(pageMeta.mcp)}
    <section class="operation-panel mcp-console">
      <div class="section-head">
        <span class="meta-label">Agent tool gateway</span>
        <span class="mono">MCP / ${String(mcpToolDefinitions().length).padStart(2, "0")} TOOLS</span>
      </div>
      <div class="tool-list">${tools}</div>
    </section>
    <section class="operation-panel code-panel">
      <div class="section-head">
        <span class="meta-label">MCP manifest</span>
        <span class="mono">INSTALLABLE</span>
      </div>
      <pre>${JSON.stringify(currentMcpManifest(), null, 2)}</pre>
      <div class="integration-actions">
        <button class="inline-action" data-action="copy-mcp-manifest">Copy Manifest</button>
        <button class="inline-action" data-action="export-mcp-manifest">Export Manifest</button>
      </div>
    </section>
    <section class="operation-panel code-panel">
      <div class="section-head">
        <span class="meta-label">Agent SDK call path</span>
        <span class="mono">TYPESCRIPT</span>
      </div>
      <pre>${mcpSdkSnippet()}</pre>
      <div class="integration-actions">
        <button class="inline-action" data-action="copy-sdk-snippet">Copy SDK Snippet</button>
        <button class="inline-action" data-action="run-mcp-test">Run Test Call</button>
      </div>
    </section>
    <section class="operation-panel tab-output">
      <div class="section-head">
        <span class="meta-label">Integration status</span>
        <span class="mono">PROXY / ${proxyStatusLabel()}</span>
      </div>
      <div class="tab-content">
        ${metricCards([
          ["Budget gate", `${formatUSDC(agent.txLimit)} per-call ceiling exposed to agent tools.`],
          ["Receipt binding", proxyLastResponse?.receipt ? `${proxyLastResponse.receipt.status.toUpperCase()} receipt ${proxyLastResponse.receipt.receiptHash.slice(0, 12)}... attached.` : "pay_x402 returns tx hash, endpoint, task memo, and policy decision in one object."],
          ["Emergency pause", isPaused ? "pause_agent active. Spend authority is suspended." : "pause_agent available. Owner can stop the agent instantly."],
        ])}
      </div>
    </section>
  `;
}

function renderRiskPage(agent) {
  const requests = evaluatedRequests(agent);
  const riskRows = requests
    .map((request) => ({ ...request, risk: riskScoreFor(agent, request) }))
    .sort((a, b) => b.risk.score - a.risk.score)
    .map(
      (request) => `
        <article class="risk-row">
          <div class="risk-meter"><span style="height:${request.risk.score}%"></span></div>
          <div>
            <strong>${request.service}</strong>
            <small>${request.risk.reasons.join(" / ")} · ${request.cost}</small>
          </div>
          <div class="request-actions">
            <span class="status ${request.status}">${request.risk.score}</span>
            ${
              request.status !== "blocked"
                ? `<button data-risk-action="mitigate" data-service="${request.service}">Mitigate</button>`
                : ""
            }
          </div>
        </article>
      `,
    )
    .join("");
  return `
    ${pageHeader(pageMeta.risk)}
    <section class="operation-panel risk-score-panel">
      <div class="risk-dial">
        <span>${agent.riskScore}</span>
        <small>risk score</small>
      </div>
      <div>
        <p class="eyebrow">Threat posture</p>
        <h3>Low exposure, policy-bound</h3>
        <p>Unknown endpoint attempts are blocked before authorization. Repeated payment paths remain visible for review.</p>
      </div>
    </section>
    <section class="operation-panel policy-feed">
      <div class="section-head">
        <span class="meta-label">Endpoint scoring</span>
        <span class="mono">SCAN / ACTIVE</span>
      </div>
      <div class="risk-list">${riskRows}</div>
    </section>
    <section class="operation-panel tab-output">
      <div class="section-head">
        <span class="meta-label">Risk surfaces</span>
        <span class="mono">SECURITY / MAP</span>
      </div>
      <div class="tab-content">
        ${metricCards([
          ["Endpoint behavior", "Response drift, pricing jumps, and repeat attempts are scored."],
          ["Metadata leak", "Suspicious payload expansion is blocked before payment authorization."],
          ["Unknown contract", "Non-allowlisted contracts move the request to manual review."],
        ])}
      </div>
    </section>
  `;
}

function renderReceiptsPage(agent) {
  const records = receiptRecords(agent);
  const filteredRecords = receiptFilter === "all" ? records : records.filter((record) => record.status === receiptFilter);
  const selected = records.find((record) => record.id === selectedReceiptId) || filteredRecords[0] || records[0];
  selectedReceiptId = selected?.id || "";
  const receipts = filteredRecords
    .map((record) => {
      return `
        <article class="receipt-row ${record.id === selectedReceiptId ? "is-selected" : ""}" data-receipt-id="${record.id}">
          <div>
            <strong>${record.amount}</strong>
            <small>${record.service} / ${record.txHash}</small>
          </div>
          <span class="status ${record.status}">${statusText(record.status)}</span>
        </article>
      `;
    })
    .join("");

  return `
    ${pageHeader(pageMeta.receipts)}
    <section class="operation-panel ledger-panel">
      <div class="section-head">
        <span class="meta-label">Audit ledger</span>
        <span class="mono">RECEIPTS / ${filteredRecords.length}</span>
      </div>
      <div class="receipt-filters">
        ${["all", "approved", "pending", "blocked"]
          .map((filter) => `<button class="${receiptFilter === filter ? "is-active" : ""}" data-receipt-filter="${filter}">${filter}</button>`)
          .join("")}
      </div>
      <div class="receipt-list">${receipts}</div>
    </section>
    <section class="operation-panel code-panel">
      <div class="section-head">
        <span class="meta-label">Receipt detail</span>
        <span class="mono">${selected?.id || "NONE"}</span>
      </div>
      <pre>{
  "agent": "${activeAgent}",
  "network": "base",
  "asset": "USDC",
  "service": "${selected?.service || ""}",
  "amount": "${selected?.amount || ""}",
  "status": "${selected?.status || ""}",
  "contract": "${selected?.contract || ""}",
  "txHash": "${selected?.txHash || ""}",
  "decision": "${selected?.reason || ""}",
  "timestamp": "${selected?.timestamp || ""}"
}</pre>
    </section>
    <section class="operation-panel tab-output">
      <div class="section-head">
        <span class="meta-label">Audit controls</span>
        <span class="mono">EXPORT / READY</span>
      </div>
      <div class="tab-content">
        ${metricCards([
          ["Accounting export", "Approved payments can be exported as a compact USDC spend ledger."],
          ["Security review", "Denied requests stay attached to the same task context."],
          ["Agent evals", "Receipts measure whether an agent spends efficiently or leaks intent."],
        ])}
      </div>
    </section>
  `;
}

function renderSimulationPage(agent) {
  const requests = evaluatedRequests(agent);
  return `
    ${pageHeader(pageMeta.simulation)}
    <section class="operation-panel scenario-panel">
      <div class="section-head">
        <span class="meta-label">Scenario</span>
        <span class="mono">DRY-RUN</span>
      </div>
      <div class="scenario-command">Analyze this wallet.</div>
      <p class="scenario-copy">SpendOS simulates the agent's paid API path before live authorization is granted.</p>
      <div class="scenario-actions">
        <button class="inline-action" data-action="run-simulation">Run Simulation</button>
        <button class="inline-action" data-action="move-enforce">Move To Enforce</button>
      </div>
    </section>
    <section class="operation-panel request-queue">
      <div class="section-head">
        <span class="meta-label">Projected spend path</span>
        <span class="mono">ESTIMATE / 0.42 USDC</span>
      </div>
      <div class="event-list">${requestRows(requests)}</div>
    </section>
    <section class="operation-panel tab-output">
      <div class="section-head">
        <span class="meta-label">Simulation outcome</span>
        <span class="mono">RECOMMENDATION</span>
      </div>
      <div class="tab-content">
        ${metricCards([
          ["Run cost", `Approved path currently totals ${formatUSDC(requests.filter((request) => request.status === "approved").reduce((sum, request) => sum + request.amount, 0))}. Simulations run: ${simulationRuns}.`],
          ["Blocked path", `${requests.filter((request) => request.status === "blocked").length} request path(s) remain blocked by active policy.`],
          ["Next action", "Move to Enforce after owner reviews domain allowlist changes."],
        ])}
      </div>
    </section>
  `;
}

function renderLogs() {
  const modeLine = `MODE: ${activeMode.toUpperCase()} autonomous spend enforcement`;
  const pauseLine = isPaused ? "PAUSE: agent spend authority suspended" : "AUTHORITY: policy-bound spend active";
  const proxyLine = proxyOnline
    ? `PROXY: live backend ${PROXY_BASE_URL} — synced ${proxyLastCheckedAt ? new Date(proxyLastCheckedAt).toLocaleTimeString() : "—"}`
    : "PROXY: offline — local policy engine active";
  elements.activityLog.innerHTML = [modeLine, pauseLine, proxyLine, ...logs]
    .map((line) => {
      const colonIdx = line.indexOf(":");
      const head = colonIdx >= 0 ? line.slice(0, colonIdx) : line;
      const rest = colonIdx >= 0 ? line.slice(colonIdx + 1) : "";
      return `<div class="terminal-line"><strong>${head}:</strong>${rest}</div>`;
    })
    .join("");
}

function paintView() {
  const agent = agents[activeAgent];
  const renderers = {
    activity: renderActivityPage,
    policies: renderPoliciesPage,
    vault: renderVaultPage,
    x402: renderX402Page,
    mcp: renderMcpPage,
    risk: renderRiskPage,
    receipts: renderReceiptsPage,
    simulation: renderSimulationPage,
  };
  elements.viewPage.innerHTML = renderers[activeTab](agent);
}

function renderView(animate = false) {
  if (!animate) {
    paintView();
    return;
  }

  elements.viewPage.classList.add("is-swapping");
  window.setTimeout(() => {
    paintView();
    window.requestAnimationFrame(() => {
      elements.viewPage.classList.remove("is-swapping");
    });
  }, 130);
}

function renderLibrary(agent) {
  const records = receiptRecords(agent);
  const recent = records.slice(0, 2);
  const blocked = records.filter((record) => record.status === "blocked").slice(0, 2);
  const localCount = Object.keys(agents).length + records.length + 2;

  elements.libraryPanel.innerHTML = `
    <div class="section-head">
      <span class="meta-label">Library</span>
      <span class="mono">LOCAL / ${String(localCount).padStart(2, "0")}</span>
    </div>
    <div class="library-group">
      <h3>Saved agents</h3>
      ${Object.entries(agents)
        .map(
          ([agentId, savedAgent]) => `
            <button class="library-row ${agentId === activeAgent ? "is-selected" : ""}" data-library-action="select-agent" data-agent="${agentId}">
              <span>${agentId}</span>
              <small>Base / USDC / ${savedAgent.requests.length} spend paths</small>
            </button>
          `,
        )
        .join("")}
    </div>
    <div class="library-group">
      <h3>Recent receipts</h3>
      ${recent
        .map(
          (record) => `
            <button class="library-row" data-library-action="open-receipt" data-receipt-id="${record.id}">
              <span>${record.amount}</span>
              <small>${record.service} / ${record.status}</small>
            </button>
          `,
        )
        .join("")}
    </div>
    <div class="library-group">
      <h3>Blocked payments</h3>
      ${
        blocked.length
          ? blocked
              .map(
                (record) => `
                  <button class="library-row" data-library-action="open-receipt" data-receipt-id="${record.id}">
                    <span>${record.amount}</span>
                    <small>${record.reason} / denied</small>
                  </button>
                `,
              )
              .join("")
          : `<button class="library-row" data-library-action="open-risk"><span>No blocked requests</span><small>risk layer clear</small></button>`
      }
    </div>
    <div class="library-group">
      <h3>Policy templates</h3>
      <button class="library-row" data-library-action="apply-template" data-template="research">
        <span>Research Only</span>
        <small>no trading / no custody</small>
      </button>
      <button class="library-row" data-library-action="apply-template" data-template="strict">
        <span>Strict x402</span>
        <small>allowlisted APIs only</small>
      </button>
    </div>
  `;
}

function setMode(mode) {
  activeMode = mode;
  syncActiveMode();
  saveState();
  renderAgent();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function copyState() {
  const state = currentPolicySnapshot();

  writeClipboard(JSON.stringify(state, null, 2), "STATE COPIED: policy snapshot ready.");
}

function writeClipboard(text, successMessage) {
  if (!navigator.clipboard?.writeText) {
    showToast("COPY FAILED: clipboard unavailable.");
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => showToast(successMessage))
    .catch(() => showToast("COPY FAILED: clipboard unavailable."));
}

async function proxyRequest(path, payload = null, method = "POST") {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);
  const apiKey = window.SPENDOS_CONFIG?.apiKey || "";
  const options = {
    method,
    signal: controller.signal,
    headers: apiKey ? { "X-SpendOS-Key": apiKey } : {},
  };

  if (payload) {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  try {
    const response = await fetch(`${PROXY_BASE_URL}${path}`, options);
    const data = await response.json();
    proxyOnline = true;
    proxyLastCheckedAt = new Date().toISOString();
    proxyLastResponse = data;
    saveState();
    if (!response.ok) {
      const error = new Error(data.reason || data.error || "proxy_error");
      error.proxyData = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.proxyData) {
      throw error;
    }
    proxyOnline = false;
    proxyLastCheckedAt = new Date().toISOString();
    proxyLastResponse = {
      proxy: PROXY_BASE_URL,
      status: "offline",
      error: error.name === "AbortError" ? "timeout" : error.message,
      fallback: "local_policy_engine",
    };
    saveState();
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function paymentPayloadFromForm() {
  return {
    agentId: activeAgent,
    domain: $("#paymentDomain")?.value.trim(),
    amount: Number($("#paymentAmount")?.value || 0),
    contract: $("#paymentContract")?.value.trim(),
    task: $("#paymentMemo")?.value.trim() || "Autonomous x402 payment request",
    idempotencyKey: operationKey("payment"),
  };
}

function ingestPaymentResult(payload, result) {
  const agent = agents[activeAgent];
  const amount = Number(payload.amount);
  const request = {
    service: payload.domain,
    cost: formatUSDC(amount),
    amount,
    contract: payload.contract,
    detail: payload.task,
    status: result.status === "approved" ? "approved" : result.status === "pending" ? "pending" : "blocked",
    reason: result.reason,
    approvalId: result.approval?.id || null,
    receiptHash: result.receipt?.receiptHash || null,
  };

  agent.requests.unshift(request);

  if (result.status === "approved") {
    agent.spent = Number((agent.spent + amount).toFixed(6));
    agent.balance = Number((agent.balance - amount).toFixed(6));
    agent.lastTx = result.receipt?.receiptHash ? `${result.receipt.receiptHash.slice(0, 6)}...${result.receipt.receiptHash.slice(-4)}` : agent.lastTx;
  }

  logs.unshift(`PROXY: pay_x402 ${result.status} for ${payload.domain}`);
  logs.unshift(`RECEIPT: ${result.receipt?.receiptHash ? result.receipt.receiptHash.slice(0, 14) : result.reason}`);
  logs.splice(8);
  saveState();
  renderAgent();
}

function addPolicyItem(type, inputElement) {
  const value = inputElement.value.trim();
  if (!value) return;
  const agent = agents[activeAgent];
  if (agent[type].includes(value)) {
    showToast("POLICY EXISTS: rule already active.");
    return;
  }
  agent[type].push(value);
  inputElement.value = "";
  logs.unshift(`POLICY: ${type === "domains" ? "domain" : "contract"} ${value} allowlisted`);
  logs.splice(8);
  saveState();
  renderAgent();
  showToast("POLICY UPDATED: enforcement preview recalculated.");
}

function removePolicyItem(type, value) {
  const agent = agents[activeAgent];
  agent[type] = agent[type].filter((item) => item !== value);
  logs.unshift(`POLICY: ${type === "domains" ? "domain" : "contract"} ${value} removed`);
  logs.splice(8);
  saveState();
  renderAgent();
  showToast("POLICY UPDATED: enforcement preview recalculated.");
}

function mitigateRisk(service) {
  requestOverrides[activeAgent] ||= {};
  requestOverrides[activeAgent][service] = "blocked";
  logs.unshift(`MITIGATE: ${service} forced into blocked audit state`);
  logs.splice(8);
  saveState();
  renderAgent();
  showToast("RISK MITIGATED: request blocked and audit trail updated.");
}

async function resolvePendingRequest(service, decision, approvalId = "") {
  const agent = agents[activeAgent];
  const request = evaluatedRequests(agent).find((item) => item.service === service);
  if (!request || request.status !== "pending") {
    showToast("REQUEST NOT PENDING: no owner action required.");
    return;
  }

  if (decision === "approve" && walletConnected && isBaseNetwork() && walletProvider) {
    const message = [
      "SpendOS Pending Payment Approval",
      `Agent: ${activeAgent}`,
      `Service: ${request.service}`,
      `Amount: ${request.cost}`,
      `Reason: ${request.reason}`,
      `Network: Base`,
    ].join("\n");

    try {
      const signature = await walletProvider.request({
        method: "personal_sign",
        params: [message, ownerAddress],
      });
      logs.unshift(`AUTH: pending payment signed ${signature.slice(0, 10)}...${signature.slice(-6)}`);
    } catch (error) {
      showToast(error?.code === 4001 ? "APPROVAL REJECTED: request remains pending." : "APPROVAL ERROR: request remains pending.");
      return;
    }
  }

  if (approvalId) {
    try {
      const result = await proxyRequest("/v1/approvals/resolve", {
        approvalId,
        decision: decision === "approve" ? "approved" : "denied",
        resolver: ownerAddress || "local-owner",
        reason: decision === "approve" ? "owner_approved" : "owner_denied",
      });
      const sourceRequest = agent.requests.find((item) => item.service === service && item.approvalId === approvalId);
      if (sourceRequest) {
        sourceRequest.status = result.status === "approved" ? "approved" : "blocked";
        sourceRequest.reason = result.reason;
        sourceRequest.receiptHash = result.receipt?.receiptHash || sourceRequest.receiptHash;
      }
      if (result.status === "approved") {
        agent.spent = Number((agent.spent + Number(request.amount)).toFixed(6));
        agent.balance = Number((agent.balance - Number(request.amount)).toFixed(6));
        agent.lastTx = result.receipt?.receiptHash ? `${result.receipt.receiptHash.slice(0, 6)}...${result.receipt.receiptHash.slice(-4)}` : agent.lastTx;
      }
      logs.unshift(`${decision === "approve" ? "APPROVE" : "DENY"}: proxy resolved approval ${approvalId.slice(0, 18)}...`);
      logs.splice(8);
      saveState();
      renderAgent();
      showToast(result.status === "approved" ? "APPROVAL SETTLED: x402 receipt authorized." : "APPROVAL DENIED: request blocked.");
      return;
    } catch {
      showToast("APPROVAL PROXY OFFLINE: using local owner decision.");
    }
  }

  requestOverrides[activeAgent] ||= {};
  requestOverrides[activeAgent][service] = decision === "approve" ? "approved" : "blocked";
  logs.unshift(`${decision === "approve" ? "APPROVE" : "DENY"}: owner ${decision}d ${service}`);
  logs.splice(8);
  saveState();
  renderAgent();
  showToast(decision === "approve" ? "REQUEST APPROVED: receipt path opened." : "REQUEST DENIED: audit trail sealed.");
}

async function submitPaymentRequest() {
  if (operationBusy("payment")) return;

  const payload = paymentPayloadFromForm();
  const { domain, amount, contract, task } = payload;

  if (!domain || !contract || !amount || amount <= 0) {
    showToast("REQUEST INVALID: endpoint, contract, and amount required.");
    return;
  }

  startOperation("payment");
  const agent = agents[activeAgent];
  try {
    const result = await proxyRequest("/v1/pay_x402", payload);
    if (!result.replayed && result.reason !== "idempotency_key_conflict") {
      ingestPaymentResult(payload, result);
    }
    rotateOperationKey("payment");
    renderAgent();
    showToast(
      result.replayed
        ? "PROXY REPLAYED: original receipt returned, no duplicate spend."
        : result.status === "approved"
          ? "PROXY APPROVED: x402 receipt and settlement ready."
          : `PROXY ${result.status.toUpperCase()}: ${result.reason}.`,
    );
    return;
  } catch {
    showToast("PROXY OFFLINE: using local policy engine fallback.");
  } finally {
    finishOperation("payment");
  }

  const request = {
    service: domain,
    cost: formatUSDC(amount),
    amount,
    contract,
    detail: task,
    status: "pending",
  };
  agent.requests.unshift(request);
  logs.unshift(`REQUEST: ${activeAgent} wants to pay ${formatUSDC(amount)} to ${domain}`);
  logs.splice(8);
  rotateOperationKey("payment");
  saveState();
  renderAgent();
  showToast(`REQUEST QUEUED: ${evaluateRequest(agent, request).status.toUpperCase()} by active policy.`);
}

async function runSimulation() {
  if (proxyOnline) {
    try {
      const demo = await proxyRequest("/v1/demo/analyze_wallet", { agentId: activeAgent });
      demo.results.forEach((result) => {
        const r = result.receipt;
        ingestPaymentResult(
          { agentId: activeAgent, domain: r.domain, amount: r.amount, contract: r.contract, task: r.task },
          result,
        );
      });
      simulationRuns += 1;
      await syncReceiptsFromProxy(activeAgent);
      logs.unshift(`SIMULATION: proxy dry-run ${simulationRuns} — ${demo.summary}`);
      logs.splice(8);
      saveState();
      renderAgent();
      showToast(`SIMULATION COMPLETE: ${demo.summary}`);
      return;
    } catch {
      // proxy failed — fall through to local
    }
  }

  simulationRuns += 1;
  logs.unshift(`SIMULATION: wallet analysis dry-run ${simulationRuns} completed`);
  logs.unshift("BLOCK: unknown-indexer.ai denied before payment");
  logs.unshift("APPROVE: 0.42 USDC projected across trusted x402 tools");
  logs.splice(8);
  saveState();
  renderLogs();
  renderView(true);
  showToast("SIMULATION COMPLETE: 2 approved paths, 1 blocked endpoint.");
}

function moveToEnforce() {
  setMode("enforce");
  showToast("ENFORCE MODE: autonomous spend boundaries are live.");
}

async function checkProxyHealth() {
  try {
    const result = await proxyRequest("/health", null, "GET");
    logs.unshift(`PROXY: health ${result.status} at ${new Date().toLocaleTimeString()}`);
    logs.splice(8);
    await fullProxySync(true);
    saveState();
    renderAgent();
    showToast("PROXY ONLINE: live state synced from SpendOS backend.");
  } catch {
    renderAgent();
    showToast("PROXY OFFLINE: start npm run proxy for live API mode.");
  }
}

async function checkVaultStatus() {
  try {
    const result = await proxyRequest(`/v1/vault/status?agentId=${encodeURIComponent(activeAgent)}`, null, "GET");
    vaultLastStatus = result;
    logs.unshift(`VAULT: onchain status ${result.status}`);
    logs.splice(8);
    saveState();
    renderAgent();
    showToast(result.status === "ready" ? "VAULT READY: onchain policy loaded." : `VAULT ${result.status.toUpperCase()}: ${result.reason || "status loaded"}.`);
  } catch {
    renderAgent();
    showToast("VAULT STATUS OFFLINE: proxy unreachable.");
  }
}

async function checkLaunchReadiness() {
  if (operationBusy("launch-readiness")) return;

  startOperation("launch-readiness");
  try {
    const result = await proxyRequest(`/v1/launch/readiness?agentId=${encodeURIComponent(activeAgent)}`, null, "GET");
    launchLastReadiness = result;
    vaultLastStatus = result.vault || vaultLastStatus;
    settlementLastPreflight = result.preflight || settlementLastPreflight;
    logs.unshift(`LAUNCH: readiness ${result.status} ${result.score.passed}/${result.score.total}`);
    logs.splice(8);
    saveState();
    renderAgent();
    showToast(
      result.status === "ready"
        ? "LAUNCH READY: vault, operator, funding, and preflight passed."
        : `LAUNCH NOT READY: ${result.nextActions[0] || "review failed checks"}`,
    );
  } catch {
    renderAgent();
    showToast("LAUNCH CHECK OFFLINE: proxy unreachable.");
  } finally {
    finishOperation("launch-readiness");
  }
}

async function preflightSettlementFromForm() {
  if (operationBusy("preflight")) return;

  const payload = {
    ...paymentPayloadFromForm(),
    operatorAddress: ownerAddress || undefined,
  };
  if (!payload.domain || !payload.contract || !payload.amount || payload.amount <= 0) {
    showToast("PREFLIGHT INVALID: endpoint, contract, and amount required.");
    return;
  }

  startOperation("preflight");
  try {
    const result = await proxyRequest("/v1/settlement/preflight", payload);
    settlementLastPreflight = result;
    logs.unshift(`PREFLIGHT: ${result.status} for ${payload.domain}`);
    logs.splice(8);
    saveState();
    renderAgent();
    showToast(
      result.status === "ready"
        ? "PREFLIGHT PASSED: settlement calldata can execute."
        : `PREFLIGHT ${result.status.toUpperCase()}: ${result.reason}.`,
    );
  } catch {
    renderAgent();
    showToast("PREFLIGHT OFFLINE: proxy unreachable.");
  } finally {
    finishOperation("preflight");
  }
}

async function runWalletDemo() {
  try {
    const demo = await proxyRequest("/v1/demo/analyze_wallet", { agentId: activeAgent });
    demo.results.forEach((result) => {
      const receipt = result.receipt;
      ingestPaymentResult(
        {
          agentId: activeAgent,
          domain: receipt.domain,
          amount: receipt.amount,
          contract: receipt.contract,
          task: receipt.task,
        },
        result,
      );
    });
    await syncReceiptsFromProxy(activeAgent);
    logs.unshift(`DEMO: ${demo.summary}`);
    logs.splice(8);
    saveState();
    renderAgent();
    showToast("WALLET DEMO COMPLETE: live proxy receipts attached.");
  } catch {
    runSimulation();
    showToast("PROXY OFFLINE: local wallet demo simulation completed.");
  }
}

async function submitSettlementFromForm() {
  if (operationBusy("settlement")) return;

  const payload = {
    ...paymentPayloadFromForm(),
    idempotencyKey: operationKey("settlement"),
  };
  if (!payload.domain || !payload.contract || !payload.amount || payload.amount <= 0) {
    showToast("SETTLEMENT INVALID: endpoint, contract, and amount required.");
    return;
  }

  startOperation("settlement");
  try {
    const result = await proxyRequest("/v1/settlement/submit", payload);
    rotateOperationKey("settlement");
    showToast(
      result.replayed
        ? "SETTLEMENT REPLAYED: original transaction response returned."
        : result.status === "submitted"
          ? "SETTLEMENT SUBMITTED: tx hash attached."
          : `SETTLEMENT ${result.status.toUpperCase()}: ${result.reason}.`,
    );
    renderAgent();
  } catch {
    rotateOperationKey("settlement");
    renderAgent();
    showToast("SETTLEMENT NOT READY: configure vault address, RPC, and operator signer.");
  } finally {
    finishOperation("settlement");
  }
}

async function runMcpTestCall() {
  if (operationBusy("mcp")) return;

  const agent = agents[activeAgent];
  const payload = {
    agentId: activeAgent,
    domain: agent.domains[0] || "api.service.com",
    amount: Math.min(agent.txLimit, 0.12),
    contract: agent.contracts[0] || "0x8335...2913",
    task: "MCP test call: check_policy -> pay_x402",
    idempotencyKey: operationKey("mcp"),
  };
  mcpTestRuns += 1;

  startOperation("mcp");
  try {
    const result = await proxyRequest("/v1/pay_x402", payload);
    if (!result.replayed && result.reason !== "idempotency_key_conflict") {
      ingestPaymentResult(payload, result);
    }
    logs.unshift(`MCP: live test call ${mcpTestRuns} returned ${result.status}`);
    logs.splice(8);
    rotateOperationKey("mcp");
    saveState();
    renderAgent();
    showToast(result.replayed ? "MCP REPLAYED: original receipt returned." : "MCP LIVE: proxy returned receipt and settlement payload.");
    return;
  } catch {
    const request = {
      service: payload.domain,
      cost: formatUSDC(payload.amount),
      amount: payload.amount,
      contract: payload.contract,
      detail: payload.task,
      status: "pending",
    };
    agent.requests.unshift(request);
    logs.unshift(`MCP: fallback test call ${mcpTestRuns} evaluated ${request.service}`);
    logs.unshift(`TOOL: check_policy returned ${evaluateRequest(agent, request).status}`);
  } finally {
    finishOperation("mcp");
  }

  logs.splice(8);
  rotateOperationKey("mcp");
  saveState();
  renderAgent();
  showToast("MCP FALLBACK: local policy engine evaluated request.");
}

function applyPolicyTemplate(template) {
  const agent = agents[activeAgent];
  if (template === "research") {
    agent.domains = ["api.tokensight.io", "risk.baseintel.net", "decode.calldata.run"];
    agent.contracts = ["0x8335...2913", "0x4200...0006", "0x2f5a...bace"];
    agent.txLimit = Math.min(agent.txLimit, 0.25);
    logs.unshift(`TEMPLATE: Research Only applied to ${activeAgent}`);
  }
  if (template === "strict") {
    agent.domains = agent.domains.filter((domain) => ["api.tokensight.io", "risk.baseintel.net", "decode.calldata.run"].includes(domain));
    agent.contracts = agent.contracts.filter((contract) => ["0x8335...2913", "0x4200...0006", "0x2f5a...bace"].includes(contract));
    agent.txLimit = Math.min(agent.txLimit, 0.12);
    activeMode = "enforce";
    logs.unshift(`TEMPLATE: Strict x402 enforced for ${activeAgent}`);
  }
  logs.splice(8);
  saveState();
  renderAgent();
  showToast(template === "strict" ? "STRICT X402: policy tightened." : "RESEARCH ONLY: policy template applied.");
}

async function savePolicyToProxy() {
  const payload = proxyPolicyPayload();
  saveState();

  try {
    const result = await proxyRequest("/v1/policies/update", payload);
    syncAgentFromProxyPolicy(result.policy);
    logs.unshift(`POLICY: proxy saved digest ${result.policyDigest.slice(0, 10)}...`);
    logs.splice(8);
    saveState();
    renderAgent();
    showToast("POLICY SAVED: live proxy enforcement updated.");
  } catch {
    renderAgent();
    showToast("POLICY SAVED LOCALLY: proxy unreachable, live enforcement unchanged.");
  }
}

async function setAgentPaused(nextPaused) {
  isPaused = nextPaused;
  saveState();
  renderAgent();

  try {
    const result = await proxyRequest("/v1/pause_agent", { agentId: activeAgent, paused: nextPaused });
    logs.unshift(`PAUSE: proxy spend authority ${result.status}`);
    logs.splice(8);
    saveState();
    renderAgent();
    showToast(nextPaused ? "AGENT PAUSED: live proxy enforcement suspended." : "AGENT RESUMED: live proxy enforcement active.");
  } catch {
    showToast(nextPaused ? "AGENT PAUSED LOCALLY: proxy unreachable." : "AGENT RESUMED LOCALLY: proxy unreachable.");
  }
}

async function switchToBase() {
  if (!walletProvider) return false;
  chainId = await walletProvider.request({ method: "eth_chainId" });
  if (isBaseNetwork()) return true;

  try {
    await walletProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_ID }],
    });
  } catch (error) {
    if (error?.code === 4902) {
      await walletProvider.request({
        method: "wallet_addEthereumChain",
        params: [BASE_NETWORK],
      });
    } else {
      throw error;
    }
  }

  chainId = await walletProvider.request({ method: "eth_chainId" });
  return isBaseNetwork();
}

async function connectWallet() {
  walletProvider = getEthereumProvider();
  if (!walletProvider) {
    showToast("NO WALLET FOUND: install MetaMask or Coinbase Wallet.");
    return;
  }

  try {
    const accounts = await walletProvider.request({ method: "eth_requestAccounts" });
    ownerAddress = accounts?.[0] || "";
    walletConnected = Boolean(ownerAddress);
    chainId = await walletProvider.request({ method: "eth_chainId" });
    try {
      await switchToBase();
    } catch (error) {
      showToast("WALLET CONNECTED: switch to Base to enforce vault actions.");
    }

    logs.unshift(isBaseNetwork() ? "WALLET: owner connected on Base" : `WALLET: owner connected on chain ${chainId}`);
    logs.splice(8);
    bindWalletEvents();
    renderAgent();
    showToast(isBaseNetwork() ? "WALLET CONNECTED: Base owner authority detected." : "WALLET CONNECTED: wrong network.");
  } catch (error) {
    showToast(error?.code === 4001 ? "CONNECTION REJECTED: wallet request denied." : "WALLET ERROR: connection failed.");
  }
}

async function disconnectWallet() {
  if (walletProvider?.request) {
    try {
      await walletProvider.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Most injected wallets do not support permission revocation from the dapp.
    }
  }

  walletConnected = false;
  ownerAddress = "";
  chainId = "";
  logs.unshift("WALLET: SpendOS session disconnected");
  logs.splice(8);
  renderAgent();
  showToast("WALLET DISCONNECTED: local SpendOS session cleared.");
}

function bindWalletEvents() {
  if (!walletProvider || walletProvider.__spendosBound) return;

  walletProvider.on?.("accountsChanged", (accounts) => {
    ownerAddress = accounts?.[0] || "";
    walletConnected = Boolean(ownerAddress);
    logs.unshift(walletConnected ? `WALLET: account changed to ${shortAddress(ownerAddress)}` : "WALLET: account access removed");
    logs.splice(8);
    renderAgent();
  });

  walletProvider.on?.("chainChanged", (nextChainId) => {
    chainId = nextChainId;
    logs.unshift(isBaseNetwork() ? "CHAIN: Base network active" : `CHAIN: unsupported network ${chainId}`);
    logs.splice(8);
    renderAgent();
  });

  walletProvider.__spendosBound = true;
}

function pseudoHex(seed) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function rotateVaultKey() {
  if (!walletConnected) {
    showToast("CONNECT WALLET: owner signature required for vault rotation.");
    return;
  }
  if (!isBaseNetwork()) {
    showToast("WRONG NETWORK: switch wallet to Base before vault rotation.");
    return;
  }
  signVaultRotation();
}

async function signVaultRotation() {
  if (!walletProvider) return;

  const agent = agents[activeAgent];
  const stamp = pseudoHex(`${activeAgent}-${Date.now()}`);
  const message = [
    "SpendOS Vault Rotation",
    `Agent: ${activeAgent}`,
    `Vault: ${agent.fullAddress}`,
    `Network: Base (${BASE_CHAIN_ID})`,
    `Nonce: ${stamp}`,
  ].join("\n");

  try {
    const signature = await walletProvider.request({
      method: "personal_sign",
      params: [message, ownerAddress],
    });
    const authHash = signature ? `${signature.slice(0, 10)}...${signature.slice(-6)}` : `0x${stamp}...sig`;
    agent.lastTx = authHash;
    agent.address = `0x${stamp.slice(0, 4)}...${stamp.slice(4)}`;
    agent.fullAddress = `0x${stamp}${"A11CE5AFE0000000000000000000000".slice(0, 32)}`;
    logs.unshift(`AUTH: owner signed vault rotation ${authHash}`);
    logs.unshift(`VAULT: ${activeAgent} spend authority re-sealed`);
    logs.splice(8);
    saveState();
    renderAgent();
    showToast("VAULT UPDATED: owner signature verified.");
  } catch (error) {
    showToast(error?.code === 4001 ? "SIGNATURE REJECTED: vault unchanged." : "SIGNATURE ERROR: vault unchanged.");
  }
}

async function signPolicyAttestation() {
  if (!walletConnected || !walletProvider) {
    showToast("CONNECT WALLET: owner signature required for policy attestation.");
    return;
  }
  if (!isBaseNetwork()) {
    showToast("WRONG NETWORK: switch wallet to Base before signing policy.");
    return;
  }

  const attestation = currentVaultAttestation();
  const message = [
    "SpendOS Policy Attestation",
    `Agent: ${activeAgent}`,
    `Vault: ${attestation.message.vaultAddress}`,
    `USDC: ${BASE_USDC_ADDRESS}`,
    `Daily Limit: ${attestation.message.dailyLimit}`,
    `Per Transaction: ${attestation.message.perTransactionLimit}`,
    `Digest: ${attestation.message.policyDigest}`,
  ].join("\n");

  try {
    const signature = await walletProvider.request({
      method: "personal_sign",
      params: [message, ownerAddress],
    });
    policyAttestations[activeAgent] = {
      policyDigest: attestation.message.policyDigest,
      owner: ownerAddress,
      signature,
      signedAt: new Date().toISOString(),
      chainId: BASE_CHAIN_ID,
    };
    logs.unshift(`SIGN: policy digest ${attestation.message.policyDigest.slice(0, 10)} attested`);
    logs.unshift(`OWNER: ${shortAddress(ownerAddress)} authorized ${activeAgent}`);
    logs.splice(8);
    saveState();
    renderAgent();
    showToast("POLICY SIGNED: owner attestation stored locally.");
  } catch (error) {
    showToast(error?.code === 4001 ? "SIGNATURE REJECTED: policy remains unsigned." : "SIGNATURE ERROR: policy remains unsigned.");
  }
}

function wireControls() {
  elements.agentSelect.addEventListener("change", (event) => {
    activeAgent = event.target.value;
    isPaused = false;
    saveState();
    renderAgent();
    showToast(`AGENT SWITCHED: ${activeAgent}`);
  });

  elements.budgetRange.addEventListener("input", (event) => {
    elements.budgetValue.textContent = Number(event.target.value).toFixed(2);
  });

  elements.dailyLimit.addEventListener("input", (event) => {
    const value = Number(event.target.value || 0);
    agents[activeAgent].dailyLimit = value;
    elements.fileDailyLimit.textContent = formatUSDC(value);
    logs[0] = `POLICY: daily limit set to ${formatUSDC(value)}`;
    saveState();
    renderLogs();
    renderView(true);
  });

  elements.txLimit.addEventListener("input", (event) => {
    const value = Number(event.target.value || 0);
    agents[activeAgent].txLimit = value;
    logs.unshift(`POLICY: transaction limit set to ${formatUSDC(value)}`);
    logs.splice(8);
    saveState();
    renderAgent();
  });

  elements.addDomain.addEventListener("click", () => addPolicyItem("domains", elements.domainInput));
  elements.addContract.addEventListener("click", () => addPolicyItem("contracts", elements.contractInput));
  [elements.domainInput, elements.contractInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (input === elements.domainInput) addPolicyItem("domains", input);
      if (input === elements.contractInput) addPolicyItem("contracts", input);
    });
  });
  [elements.domainList, elements.contractList].forEach((list) => {
    list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-policy-type]");
      if (!button) return;
      removePolicyItem(button.dataset.policyType, button.dataset.policyValue);
    });
  });

  $$(".mode-option").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab;
      $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab === button));
      window.history.replaceState(null, "", `#${activeTab}`);
      saveState();
      renderView(true);
    });
  });

  $("#copyState").addEventListener("click", copyState);
  elements.connectWallet.addEventListener("click", connectWallet);
  elements.disconnectWallet.addEventListener("click", disconnectWallet);
  elements.deployVault.addEventListener("click", rotateVaultKey);
  $("#savePolicy").addEventListener("click", savePolicyToProxy);
  elements.resetLocalState.addEventListener("click", () => {
    resetState();
    window.setTimeout(() => window.location.reload(), 650);
  });
  $("#exportReceipts").addEventListener("click", () => {
    downloadJSON(`spendos-${activeAgent}-receipts.json`, currentReceiptBundle());
    showToast("RECEIPTS EXPORT: audit bundle downloaded.");
  });
  $("#exportPolicy").addEventListener("click", () => {
    downloadJSON(`spendos-${activeAgent}-policy.json`, currentPolicySnapshot());
    showToast("POLICY JSON EXPORT: file downloaded.");
  });

  [$("#pauseAgent"), $("#pauseAgentRight")].forEach((button) => {
    button.addEventListener("click", () => {
      setAgentPaused(!isPaused);
    });
  });

  elements.launchApp.addEventListener("click", () => openApp("activity"));
  elements.navLaunchApp.addEventListener("click", () => openApp("activity"));
  elements.openRisk.addEventListener("click", (event) => {
    event.preventDefault();
    openApp("risk");
  });

  $$(".brand").forEach((brand) => {
    brand.addEventListener("click", (event) => {
      event.preventDefault();
      openLaunch();
    });
  });

  elements.viewPage.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
      if (action) {
        if (action === "run-simulation") runSimulation();
        if (action === "move-enforce") moveToEnforce();
        if (action === "submit-payment") submitPaymentRequest();
        if (action === "check-proxy-health") checkProxyHealth();
        if (action === "check-vault-status") checkVaultStatus();
        if (action === "check-launch-readiness") checkLaunchReadiness();
        if (action === "preflight-settlement") preflightSettlementFromForm();
        if (action === "submit-settlement") submitSettlementFromForm();
        if (action === "run-wallet-demo") runWalletDemo();
        if (action === "copy-mcp-manifest") writeClipboard(JSON.stringify(currentMcpManifest(), null, 2), "MCP MANIFEST COPIED: agent install payload ready.");
      if (action === "export-mcp-manifest") {
        downloadJSON(`spendos-${activeAgent}-mcp.json`, currentMcpManifest());
        showToast("MCP MANIFEST EXPORT: file downloaded.");
      }
      if (action === "copy-sdk-snippet") writeClipboard(mcpSdkSnippet(), "SDK SNIPPET COPIED: agent call path ready.");
      if (action === "run-mcp-test") runMcpTestCall();
      if (action === "sign-policy-attestation") signPolicyAttestation();
      if (action === "copy-policy-attestation") writeClipboard(JSON.stringify(currentVaultAttestation(), null, 2), "ATTESTATION COPIED: policy digest ready.");
      if (action === "export-policy-attestation") {
        downloadJSON(`spendos-${activeAgent}-attestation.json`, currentVaultAttestation());
        showToast("ATTESTATION EXPORT: policy authority bundle downloaded.");
      }
      if (action === "copy-vault-abi") writeClipboard(JSON.stringify(vaultContractInterface(), null, 2), "VAULT INTERFACE COPIED: contract surface ready.");
      return;
    }

    const requestButton = event.target.closest("[data-request-action]");
    if (requestButton) {
      resolvePendingRequest(requestButton.dataset.service, requestButton.dataset.requestAction, requestButton.dataset.approvalId || "");
      return;
    }

    const riskButton = event.target.closest("[data-risk-action]");
    if (riskButton) {
      mitigateRisk(riskButton.dataset.service);
      return;
    }

    const filterButton = event.target.closest("[data-receipt-filter]");
    if (filterButton) {
      receiptFilter = filterButton.dataset.receiptFilter;
      selectedReceiptId = "";
      saveState();
      renderView(true);
      return;
    }

    const receiptRow = event.target.closest("[data-receipt-id]");
    if (!receiptRow) return;
    selectedReceiptId = receiptRow.dataset.receiptId;
    saveState();
    renderView(true);
  });

  elements.libraryPanel.addEventListener("click", (event) => {
    const row = event.target.closest("[data-library-action]");
    if (!row) return;

    if (row.dataset.libraryAction === "select-agent") {
      activeAgent = row.dataset.agent;
      isPaused = false;
      activeTab = "activity";
      window.history.replaceState(null, "", `#${activeTab}`);
      saveState();
      syncActiveTab();
      renderAgent();
      showToast(`AGENT LOADED: ${activeAgent}`);
      return;
    }

    if (row.dataset.libraryAction === "open-receipt") {
      receiptFilter = "all";
      selectedReceiptId = row.dataset.receiptId;
      activeTab = "receipts";
      window.history.replaceState(null, "", `#${activeTab}`);
      saveState();
      syncActiveTab();
      renderAgent();
      return;
    }

    if (row.dataset.libraryAction === "open-risk") {
      activeTab = "risk";
      window.history.replaceState(null, "", `#${activeTab}`);
      saveState();
      syncActiveTab();
      renderAgent();
      return;
    }

    if (row.dataset.libraryAction === "apply-template") {
      applyPolicyTemplate(row.dataset.template);
    }
  });
}

function syncActiveTab() {
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === activeTab));
}

function syncActiveMode() {
  $$(".mode-option").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === activeMode);
  });
  elements.modeReadout.textContent = activeMode.toUpperCase();
}

function startRadar() {
  const canvas = $("#radarCanvas");
  const context = canvas.getContext("2d");
  let sweep = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * scale));
    canvas.height = Math.max(1, Math.floor(rect.height * scale));
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);

    const centerX = width * 0.52;
    const centerY = height * 0.38;
    const radius = Math.min(width, height) * 0.38;

    context.strokeStyle = "rgba(169, 199, 169, 0.18)";
    context.lineWidth = 1;

    for (let ring = 0.25; ring <= 1; ring += 0.25) {
      context.beginPath();
      context.arc(centerX, centerY, radius * ring, 0, Math.PI * 2);
      context.stroke();
    }

    for (let i = 0; i < 16; i += 1) {
      const angle = (Math.PI * 2 * i) / 16;
      context.beginPath();
      context.moveTo(centerX, centerY);
      context.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
      context.stroke();
    }

    context.strokeStyle = "rgba(242, 239, 231, 0.24)";
    context.beginPath();
    context.moveTo(0, centerY);
    context.lineTo(width, centerY);
    context.moveTo(centerX, 0);
    context.lineTo(centerX, height);
    context.stroke();

    const sweepAngle = sweep;
    context.strokeStyle = "rgba(169, 199, 169, 0.62)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + Math.cos(sweepAngle) * radius, centerY + Math.sin(sweepAngle) * radius);
    context.stroke();

    context.fillStyle = "rgba(169, 199, 169, 0.5)";
    const points = [
      [0.24, 0.38],
      [0.62, 0.22],
      [0.76, 0.46],
      [0.44, 0.62],
      [0.58, 0.76],
    ];
    points.forEach(([x, y], index) => {
      const pulse = 1 + Math.sin(sweep * 2 + index) * 0.35;
      context.beginPath();
      context.arc(width * x, height * y, 2.2 * pulse, 0, Math.PI * 2);
      context.fill();
    });

    sweep += 0.012;
    window.requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
}

loadState();
const initialHashTab = window.location.hash.slice(1);
if (pageMeta[initialHashTab]) {
  activeTab = initialHashTab;
}
wireControls();
syncActiveTab();
syncActiveMode();
renderAgent();
startRadar();
startProxyPolling();

checkProxyHealth().catch(() => {});

window.addEventListener("hashchange", () => {
  const hashTab = window.location.hash.slice(1);
  if (!pageMeta[hashTab]) return;
  openApp(hashTab, false);
  renderView(true);
});

if (window.location.hash && pageMeta[window.location.hash.slice(1)]) {
  openApp(window.location.hash.slice(1), false);
}
