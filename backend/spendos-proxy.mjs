import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, isAbsolute, join } from "node:path";
import { Contract, Interface, JsonRpcProvider, Wallet, ZeroAddress, formatUnits, getAddress, isAddress } from "ethers";

const PORT = Number(process.env.SPENDOS_PROXY_PORT || 4191);
const DEFAULT_BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SPENDOS_DEPLOYMENT_FILE = process.env.SPENDOS_DEPLOYMENT_FILE || "";
const SPENDOS_DEPLOYMENT = loadDeploymentConfig(SPENDOS_DEPLOYMENT_FILE);
const SPENDOS_NETWORK = process.env.SPENDOS_NETWORK || SPENDOS_DEPLOYMENT.network || "base";
const BASE_USDC = process.env.USDC_ADDRESS || SPENDOS_DEPLOYMENT.usdcAddress || DEFAULT_BASE_USDC;
const BASE_CHAIN_ID = Number(process.env.SPENDOS_CHAIN_ID || process.env.CHAIN_ID || SPENDOS_DEPLOYMENT.chainId || (SPENDOS_NETWORK === "base-sepolia" ? 84532 : 8453));
const BASE_RPC_URL = settlementRpcUrl(SPENDOS_NETWORK);
const OPERATOR_PRIVATE_KEY = process.env.SPENDOS_OPERATOR_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
const SPENDOS_VAULT_ADDRESS = process.env.SPENDOS_VAULT_ADDRESS || SPENDOS_DEPLOYMENT.vaultAddress || ZeroAddress;
const SPENDOS_STATE_FILE = process.env.SPENDOS_STATE_FILE || "data/spendos-state.json";
const PERSISTENCE_ENABLED = SPENDOS_STATE_FILE !== "memory";
const SPENDOS_REQUIRE_AUTH = booleanEnv("SPENDOS_REQUIRE_AUTH");
const SPENDOS_API_KEYS = envList(process.env.SPENDOS_API_KEYS || process.env.SPENDOS_API_KEY || "");
const SPENDOS_PUBLIC_PATHS = envList(process.env.SPENDOS_PUBLIC_PATHS || "/health,/v1/ops/readiness,/v1/settlement/config");
const SPENDOS_ALLOWED_ORIGINS = envList(process.env.SPENDOS_ALLOWED_ORIGINS || "*");
const SPENDOS_RATE_LIMIT_WINDOW_MS = positiveInteger(process.env.SPENDOS_RATE_LIMIT_WINDOW_MS, 60_000);
const SPENDOS_RATE_LIMIT_MAX = positiveInteger(process.env.SPENDOS_RATE_LIMIT_MAX, 120);
const RATE_LIMIT_ENABLED = SPENDOS_RATE_LIMIT_WINDOW_MS > 0 && SPENDOS_RATE_LIMIT_MAX > 0;
const SPENDOS_AUDIT_LOG_FILE = process.env.SPENDOS_AUDIT_LOG_FILE || "data/spendos-audit.ndjson";
const AUDIT_ENABLED = PERSISTENCE_ENABLED && !["", "memory", "off", "false"].includes(SPENDOS_AUDIT_LOG_FILE);
const SPENDOS_VAULT_ABI = [
  "function policies(address agentVault) view returns (address owner, uint256 availableBalance, uint256 dailyLimit, uint256 perTransactionLimit, uint256 spentInWindow, uint64 windowStart, bool paused, bytes32 policyDigest)",
  "function usdc() view returns (address)",
  "function operators(address owner, address operator) view returns (bool)",
  "function spendUSDC(address agentVault, address recipient, uint256 amount, string service, bytes32 receiptHash)",
];
const USDC_VIEW_ABI = ["function balanceOf(address account) view returns (uint256)"];
const spendOSVaultInterface = new Interface(SPENDOS_VAULT_ABI);
let cachedSettlementSigner = null;
let cachedSettlementProvider = null;

function loadDeploymentConfig(file) {
  if (!file) return {};

  try {
    const path = isAbsolute(file) ? file : join(process.cwd(), file);
    return {
      ...JSON.parse(readFileSync(path, "utf8")),
      deploymentFile: path,
    };
  } catch (error) {
    console.warn(`SpendOS deployment load failed: ${error.message}`);
    return {
      deploymentFile: file,
      deploymentError: error.message,
    };
  }
}

function settlementRpcUrl(network) {
  if (process.env.RPC_URL) return process.env.RPC_URL;
  if (network === "base-sepolia") return process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL || "";
  return process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || "";
}

const DEFAULT_AGENTS = {
  "research-agent": {
    vaultAddress: "0x7c91d0675cB1C0B2C4e78D88E2E35F83b9104A2e",
    owner: "0x0000000000000000000000000000000000000001",
    asset: "USDC",
    network: "base",
    balance: 42.8,
    spentToday: 0.42,
    dailyLimit: 10,
    perTransactionLimit: 0.25,
    riskMode: "adaptive",
    paused: false,
    domains: ["api.tokensight.io", "risk.baseintel.net", "decode.calldata.run", "deepindex.baseops.ai"],
    contracts: ["0x8335...2913", "0x4200...0006", "0x2f5a...bace"],
  },
  "market-sentinel": {
    vaultAddress: "0x41f0e96cBEe370F9E9A9D27348Aa3F6049BC9C01",
    owner: "0x0000000000000000000000000000000000000002",
    asset: "USDC",
    network: "base",
    balance: 76.12,
    spentToday: 1.08,
    dailyLimit: 25,
    perTransactionLimit: 0.75,
    riskMode: "monitor",
    paused: false,
    domains: ["depth.signalbase.com", "makerflow.net"],
    contracts: ["0x8335...2913", "0x4200...0006"],
  },
  "contract-decoder": {
    vaultAddress: "0x8E22B6d92C14C863992B81Bd48F029E19230D871",
    owner: "0x0000000000000000000000000000000000000003",
    asset: "USDC",
    network: "base",
    balance: 18.04,
    spentToday: 0.16,
    dailyLimit: 5,
    perTransactionLimit: 0.12,
    riskMode: "strict",
    paused: false,
    domains: ["decode.calldata.run", "bytecode.tracebase.org"],
    contracts: ["0x2f5a...bace", "0x4200...0006"],
  },
};

const agents = clonePayload(DEFAULT_AGENTS);
const receipts = [];
const approvals = [];
const budgetReservations = new Map();
const idempotencyRecords = new Map();
const rateLimitBuckets = new Map();

function booleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function positiveInteger(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

function envList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stateFilePath(file = SPENDOS_STATE_FILE) {
  if (!PERSISTENCE_ENABLED) return "";
  return isAbsolute(file) ? file : join(process.cwd(), file);
}

function serializedState() {
  return {
    schemaVersion: 1,
    product: "SpendOS",
    updatedAt: new Date().toISOString(),
    agents,
    receipts,
    approvals,
    budgetReservations: Array.from(budgetReservations.entries()),
    idempotencyRecords: Array.from(idempotencyRecords.entries()),
  };
}

function applyStateSnapshot(snapshot = {}) {
  const nextAgents = {
    ...clonePayload(DEFAULT_AGENTS),
    ...(snapshot.agents || {}),
  };

  Object.keys(agents).forEach((agentId) => {
    delete agents[agentId];
  });
  Object.entries(nextAgents).forEach(([agentId, agent]) => {
    agents[agentId] = agent;
  });

  receipts.splice(0, receipts.length, ...(Array.isArray(snapshot.receipts) ? snapshot.receipts : []));
  approvals.splice(0, approvals.length, ...(Array.isArray(snapshot.approvals) ? snapshot.approvals : []));

  budgetReservations.clear();
  for (const [key, reservation] of snapshot.budgetReservations || []) {
    budgetReservations.set(key, reservation);
  }

  idempotencyRecords.clear();
  for (const [key, record] of snapshot.idempotencyRecords || []) {
    idempotencyRecords.set(key, record);
  }
}

function loadPersistentState({ file = SPENDOS_STATE_FILE } = {}) {
  if (!PERSISTENCE_ENABLED) return { status: "disabled" };

  const target = stateFilePath(file);
  if (!existsSync(target)) return { status: "empty", path: target };

  try {
    const snapshot = JSON.parse(readFileSync(target, "utf8"));
    applyStateSnapshot(snapshot);
    return { status: "loaded", path: target, updatedAt: snapshot.updatedAt || null };
  } catch (error) {
    console.warn(`SpendOS state load failed: ${error.message}`);
    return { status: "failed", path: target, error: error.message };
  }
}

function persistState({ file = SPENDOS_STATE_FILE } = {}) {
  if (!PERSISTENCE_ENABLED) return { status: "disabled" };

  const target = stateFilePath(file);
  mkdirSync(dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(serializedState(), null, 2)}\n`);
  renameSync(temp, target);
  return { status: "saved", path: target };
}

function resetProxyState({ persist = false } = {}) {
  applyStateSnapshot({});
  if (persist) persistState();
}

loadPersistentState();

function corsOrigin(req = null) {
  if (SPENDOS_ALLOWED_ORIGINS.includes("*")) return "*";
  const origin = req?.headers?.origin || "";
  if (origin && SPENDOS_ALLOWED_ORIGINS.includes(origin)) return origin;
  return SPENDOS_ALLOWED_ORIGINS[0] || "*";
}

function jsonResponse(res, status, payload, { req = null, headers = {} } = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": corsOrigin(req),
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,idempotency-key,x-spendos-key",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    ...headers,
  });
  res.end(body);
}

function apiKeyFromRequest(req) {
  const authorization = String(req.headers.authorization || "");
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return String(req.headers["x-spendos-key"] || "").trim();
}

function tokenMatches(candidate, expected) {
  const left = createHash("sha256").update(String(candidate)).digest();
  const right = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(left, right);
}

function isPublicPath(pathname) {
  return SPENDOS_PUBLIC_PATHS.includes(pathname);
}

function authorizeRequest(req, { pathname = "" } = {}) {
  if (!SPENDOS_REQUIRE_AUTH || isPublicPath(pathname)) {
    return { allowed: true, mode: SPENDOS_REQUIRE_AUTH ? "public" : "disabled", keyId: null };
  }

  if (!SPENDOS_API_KEYS.length) {
    return { allowed: false, status: 503, reason: "auth_not_configured", keyId: null };
  }

  const candidate = apiKeyFromRequest(req);
  const index = SPENDOS_API_KEYS.findIndex((key) => candidate && tokenMatches(candidate, key));
  if (index === -1) {
    return { allowed: false, status: 401, reason: "unauthorized", keyId: null };
  }

  return {
    allowed: true,
    mode: "api_key",
    keyId: `key_${createHash("sha256").update(candidate).digest("hex").slice(0, 12)}`,
  };
}

function clientIdentity(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function rateLimitRequest(req) {
  if (!RATE_LIMIT_ENABLED) return { allowed: true, remaining: null, resetAt: null };

  const key = clientIdentity(req);
  const now = Date.now();
  const current = rateLimitBuckets.get(key);
  const resetAt = current && current.resetAt > now ? current.resetAt : now + SPENDOS_RATE_LIMIT_WINDOW_MS;
  const count = current && current.resetAt > now ? current.count + 1 : 1;
  rateLimitBuckets.set(key, { count, resetAt });

  return {
    allowed: count <= SPENDOS_RATE_LIMIT_MAX,
    remaining: Math.max(SPENDOS_RATE_LIMIT_MAX - count, 0),
    resetAt: new Date(resetAt).toISOString(),
    retryAfter: Math.max(Math.ceil((resetAt - now) / 1000), 1),
  };
}

function auditFilePath() {
  return isAbsolute(SPENDOS_AUDIT_LOG_FILE) ? SPENDOS_AUDIT_LOG_FILE : join(process.cwd(), SPENDOS_AUDIT_LOG_FILE);
}

function auditEvent(payload) {
  if (!AUDIT_ENABLED) return { status: "disabled" };

  const target = auditFilePath();
  mkdirSync(dirname(target), { recursive: true });
  appendFileSync(
    target,
    `${JSON.stringify({
      time: new Date().toISOString(),
      product: "SpendOS",
      ...payload,
    })}\n`,
  );
  return { status: "written", path: target };
}

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("payload_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
  });
}

function hashHex(payload) {
  return `0x${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function requestFingerprint(agentId, payload) {
  return hashHex({
    agentId,
    domain: payload.domain,
    contract: payload.contract,
    amount: Number(payload.amount),
    task: payload.task || "unspecified_task",
    recipient: payload.recipient || null,
  });
}

function idempotencyRecord(operation, agentId, payload) {
  const key = payload.idempotencyKey || payload.requestId;
  if (!key) return { key: "", replay: null, conflict: null };

  const recordKey = `${operation}:${agentId}:${key}`;
  const fingerprint = requestFingerprint(agentId, payload);
  const existing = idempotencyRecords.get(recordKey);

  if (existing?.fingerprint === fingerprint) {
    return {
      key,
      replay: {
        ...clonePayload(existing.response),
        idempotencyKey: key,
        replayed: true,
      },
      conflict: null,
    };
  }

  if (existing) {
    return {
      key,
      replay: null,
      conflict: {
        status: "blocked",
        reason: "idempotency_key_conflict",
        idempotencyKey: key,
        replayed: false,
      },
    };
  }

  return { key, recordKey, fingerprint, replay: null, conflict: null };
}

function storeIdempotency(record, response) {
  let stamped = response;
  if (record?.key && record.recordKey) {
    stamped = {
      ...response,
      idempotencyKey: record.key,
      replayed: false,
    };
    idempotencyRecords.set(record.recordKey, {
      fingerprint: record.fingerprint,
      response: clonePayload(stamped),
    });
  }
  persistState();
  return stamped;
}

function amountToUnits(amount) {
  return Math.round(Number(amount) * 1_000_000);
}

function safeAddress(value, fallback = "0x000000000000000000000000000000000000dEaD") {
  if (isAddress(value)) return getAddress(value);
  if (/^0x[0-9a-fA-F]{40}$/.test(String(value))) return getAddress(String(value).toLowerCase());
  return fallback;
}

function getAgent(agentId) {
  const agent = agents[agentId];
  if (!agent) {
    const error = new Error("unknown_agent");
    error.status = 404;
    throw error;
  }
  return agent;
}

function riskScoreFor(agent, request) {
  let score = 10;
  const reasons = [];

  if (!agent.domains.includes(request.domain)) {
    score += 42;
    reasons.push("domain_not_allowlisted");
  }
  if (!agent.contracts.includes(request.contract)) {
    score += 28;
    reasons.push("contract_not_allowlisted");
  }
  if (Number(request.amount) > agent.perTransactionLimit) {
    score += 18;
    reasons.push("above_per_transaction_limit");
  }
  if (agent.spentToday + Number(request.amount) > agent.dailyLimit) {
    score += 22;
    reasons.push("above_daily_limit");
  }
  if (String(request.domain).includes("unknown") || String(request.domain).includes("shadow")) {
    score += 10;
    reasons.push("weak_endpoint_reputation");
  }
  if (String(request.task || "").toLowerCase().includes("private key")) {
    score += 60;
    reasons.push("metadata_leak_risk");
  }

  return {
    score: Math.min(score, 99),
    reasons: reasons.length ? reasons : ["policy_matched"],
  };
}

function policyDigest(agentId, agent) {
  return hashHex({
    product: "SpendOS",
    agentId,
    network: agent.network,
    asset: agent.asset,
    dailyLimit: agent.dailyLimit,
    perTransactionLimit: agent.perTransactionLimit,
    domains: agent.domains,
    contracts: agent.contracts,
    paused: agent.paused,
  });
}

function settlementConfigStatus(vaultAddress = SPENDOS_VAULT_ADDRESS) {
  return {
    vaultAddress,
    vaultReady: vaultAddress !== ZeroAddress,
    rpcReady: Boolean(BASE_RPC_URL),
    signerReady: Boolean(OPERATOR_PRIVATE_KEY),
  };
}

function settlementOperatorAddress() {
  if (!OPERATOR_PRIVATE_KEY) return null;

  try {
    return new Wallet(OPERATOR_PRIVATE_KEY).address;
  } catch {
    return "invalid_private_key";
  }
}

function settlementConfigSnapshot(vaultAddress = SPENDOS_VAULT_ADDRESS) {
  const operatorAddress = settlementOperatorAddress();
  const config = settlementConfigStatus(vaultAddress);
  return {
    status: config.vaultReady && config.rpcReady && config.signerReady ? "ready" : "not_configured",
    chain: SPENDOS_NETWORK,
    chainId: BASE_CHAIN_ID,
    asset: "USDC",
    usdc: BASE_USDC,
    vault: config.vaultAddress,
    operatorAddress,
    function: "spendUSDC",
    functionSelector: spendOSVaultInterface.getFunction("spendUSDC").selector,
    deployment: {
      file: SPENDOS_DEPLOYMENT.deploymentFile || null,
      loaded: Boolean(SPENDOS_DEPLOYMENT.vaultAddress),
      error: SPENDOS_DEPLOYMENT.deploymentError || null,
      deployer: SPENDOS_DEPLOYMENT.deployer || null,
      vaultTxHash: SPENDOS_DEPLOYMENT.vaultTxHash || null,
    },
    config,
  };
}

function securityConfigSnapshot() {
  return {
    auth: {
      required: SPENDOS_REQUIRE_AUTH,
      keysConfigured: SPENDOS_API_KEYS.length,
      publicPaths: SPENDOS_PUBLIC_PATHS,
    },
    rateLimit: {
      enabled: RATE_LIMIT_ENABLED,
      max: SPENDOS_RATE_LIMIT_MAX,
      windowMs: SPENDOS_RATE_LIMIT_WINDOW_MS,
    },
    audit: {
      enabled: AUDIT_ENABLED,
      path: AUDIT_ENABLED ? auditFilePath() : null,
    },
    cors: {
      allowedOrigins: SPENDOS_ALLOWED_ORIGINS,
      restricted: !SPENDOS_ALLOWED_ORIGINS.includes("*"),
    },
    persistence: {
      enabled: PERSISTENCE_ENABLED,
      path: PERSISTENCE_ENABLED ? stateFilePath() : null,
    },
    runtime: {
      nodeEnv: process.env.NODE_ENV || "development",
      deploymentFile: SPENDOS_DEPLOYMENT.deploymentFile || null,
      deploymentLoaded: Boolean(SPENDOS_DEPLOYMENT.vaultAddress),
    },
  };
}

function opsReadiness() {
  const security = securityConfigSnapshot();
  const checks = [
    readinessCheck("api_auth", "API authentication", security.auth.required && security.auth.keysConfigured > 0, "API key auth required and configured"),
    readinessCheck("rate_limit", "Rate limiting", security.rateLimit.enabled, "request rate limit enabled"),
    readinessCheck("audit_log", "Audit logging", security.audit.enabled, "audit log writes enabled"),
    readinessCheck("persistence", "State persistence", security.persistence.enabled, "persistent state file configured"),
    readinessCheck("cors", "CORS allowlist", security.cors.restricted, "allowed origins restricted"),
    readinessCheck("runtime_env", "Production runtime", security.runtime.nodeEnv === "production", "NODE_ENV=production"),
    readinessCheck(
      "deployment_file",
      "Deployment record",
      security.runtime.deploymentLoaded || SPENDOS_VAULT_ADDRESS !== ZeroAddress,
      "deployment file or vault address configured",
    ),
  ];
  const passed = checks.filter((check) => check.status === "pass").length;
  const nextActions = [];

  if (checks.find((check) => check.id === "api_auth")?.status !== "pass") nextActions.push("Set SPENDOS_REQUIRE_AUTH=true and SPENDOS_API_KEYS before public traffic.");
  if (checks.find((check) => check.id === "rate_limit")?.status !== "pass") nextActions.push("Set SPENDOS_RATE_LIMIT_MAX and SPENDOS_RATE_LIMIT_WINDOW_MS.");
  if (checks.find((check) => check.id === "audit_log")?.status !== "pass") nextActions.push("Enable SPENDOS_AUDIT_LOG_FILE with persistent storage.");
  if (checks.find((check) => check.id === "persistence")?.status !== "pass") nextActions.push("Use a persistent SPENDOS_STATE_FILE or migrate to a database.");
  if (checks.find((check) => check.id === "cors")?.status !== "pass") nextActions.push("Set SPENDOS_ALLOWED_ORIGINS to the production app origin.");
  if (checks.find((check) => check.id === "runtime_env")?.status !== "pass") nextActions.push("Run production services with NODE_ENV=production.");
  if (checks.find((check) => check.id === "deployment_file")?.status !== "pass") nextActions.push("Set SPENDOS_DEPLOYMENT_FILE or SPENDOS_VAULT_ADDRESS.");

  return {
    status: passed === checks.length ? "ready" : "not_ready",
    checkedAt: new Date().toISOString(),
    score: {
      passed,
      total: checks.length,
      percent: Math.round((passed / checks.length) * 100),
    },
    security,
    checks,
    nextActions,
  };
}

function getSettlementSigner() {
  if (!BASE_RPC_URL || !OPERATOR_PRIVATE_KEY) {
    const error = new Error("operator_signer_not_configured");
    error.status = 503;
    throw error;
  }

  cachedSettlementSigner ||= new Wallet(OPERATOR_PRIVATE_KEY, new JsonRpcProvider(BASE_RPC_URL));
  return cachedSettlementSigner;
}

function getSettlementProvider() {
  if (!BASE_RPC_URL) {
    const error = new Error("rpc_not_configured");
    error.status = 503;
    throw error;
  }

  cachedSettlementProvider ||= new JsonRpcProvider(BASE_RPC_URL);
  return cachedSettlementProvider;
}

async function vaultStatus(
  agentId,
  { vaultAddress = SPENDOS_VAULT_ADDRESS, provider = null, vaultContract = null, usdcContract = null, operatorAddress = "" } = {},
) {
  const agent = getAgent(agentId);
  const agentVault = safeAddress(agent.vaultAddress, ZeroAddress);
  const config = settlementConfigStatus(vaultAddress);

  if (!config.vaultReady || (!config.rpcReady && !provider && !vaultContract)) {
    return {
      status: "not_configured",
      reason: !config.vaultReady ? "vault_address_not_configured" : "rpc_not_configured",
      agentId,
      agentVault,
      config,
    };
  }

  const readProvider = provider || (vaultContract && usdcContract ? null : getSettlementProvider());
  const vault = vaultContract || new Contract(safeAddress(vaultAddress, ZeroAddress), SPENDOS_VAULT_ABI, readProvider);
  const policy = await vault.policies(agentVault);
  const vaultUsdc = await vault.usdc().catch(() => BASE_USDC);
  const usdc = usdcContract || new Contract(vaultUsdc, USDC_VIEW_ABI, readProvider);
  const walletUSDCBalance = await usdc.balanceOf(agentVault).catch(() => null);
  const activeOperatorAddress = operatorAddress || settlementConfigSnapshot(vaultAddress).operatorAddress;
  const owner = policy.owner;
  const operatorAllowed =
    owner && owner !== ZeroAddress && activeOperatorAddress && activeOperatorAddress !== "invalid_private_key"
      ? await vault.operators(owner, activeOperatorAddress).catch(() => false)
      : false;

  return {
    status: owner === ZeroAddress ? "unregistered" : "ready",
    agentId,
    agentVault,
    vault: safeAddress(vaultAddress, ZeroAddress),
    usdc: vaultUsdc,
    owner,
    operatorAddress: activeOperatorAddress,
    operatorAllowed,
    policy: {
      availableBalance: formatUnits(policy.availableBalance, 6),
      dailyLimit: formatUnits(policy.dailyLimit, 6),
      perTransactionLimit: formatUnits(policy.perTransactionLimit, 6),
      spentInWindow: formatUnits(policy.spentInWindow, 6),
      windowStart: Number(policy.windowStart),
      paused: policy.paused,
      policyDigest: policy.policyDigest,
    },
    walletUSDCBalance: walletUSDCBalance === null ? null : formatUnits(walletUSDCBalance, 6),
    config,
  };
}

function settlementPayload(agentId, agent, request, receiptHash, { vaultAddress = SPENDOS_VAULT_ADDRESS } = {}) {
  const agentVault = safeAddress(agent.vaultAddress, ZeroAddress);
  const recipient = safeAddress(request.recipient);
  const amount = amountToUnits(request.amount);
  const service = request.domain;
  const calldata = spendOSVaultInterface.encodeFunctionData("spendUSDC", [agentVault, recipient, amount, service, receiptHash]);
  const target = safeAddress(vaultAddress, ZeroAddress);

  return {
    contract: "SpendOSVault",
    function: "spendUSDC",
    chain: "base",
    chainId: BASE_CHAIN_ID,
    asset: "USDC",
    usdc: BASE_USDC,
    args: {
      agentVault,
      recipient,
      amount,
      service,
      receiptHash,
    },
    transaction: {
      to: target,
      data: calldata,
      value: "0",
      functionSelector: calldata.slice(0, 10),
      ready: target !== ZeroAddress,
    },
    policyDigest: policyDigest(agentId, agent),
  };
}

function checkPolicy(agentId, request) {
  const agent = getAgent(agentId);
  const amount = Number(request.amount);

  if (!request.domain || !request.contract || !amount || amount <= 0) {
    return {
      status: "blocked",
      reason: "invalid_payment_request",
      risk: { score: 99, reasons: ["missing_domain_contract_or_amount"] },
    };
  }

  if (agent.paused) {
    return {
      status: "blocked",
      reason: "agent_paused",
      risk: { score: 99, reasons: ["agent_spend_authority_suspended"] },
    };
  }

  const risk = riskScoreFor(agent, { ...request, amount });

  if (!agent.domains.includes(request.domain)) {
    return { status: "blocked", reason: "domain_not_allowlisted", risk };
  }
  if (!agent.contracts.includes(request.contract)) {
    return { status: "blocked", reason: "contract_not_allowlisted", risk };
  }
  if (amount > agent.perTransactionLimit) {
    return { status: "pending", reason: "owner_approval_required", risk };
  }
  if (agent.spentToday + amount > agent.dailyLimit) {
    return { status: "blocked", reason: "daily_limit_exceeded", risk };
  }
  if (risk.score >= 75) {
    return { status: "blocked", reason: "risk_threshold_exceeded", risk };
  }

  return { status: "approved", reason: "policy_matched", risk };
}

function createReceipt(agentId, request, decision) {
  const receipt = {
    id: `spos_${randomUUID()}`,
    agentId,
    domain: request.domain,
    contract: request.contract,
    amount: Number(request.amount),
    asset: "USDC",
    task: request.task || "unspecified_task",
    status: decision.status,
    reason: decision.reason,
    risk: decision.risk,
    idempotencyKey: request.idempotencyKey || request.requestId || null,
    createdAt: new Date().toISOString(),
  };
  receipt.receiptHash = hashHex(receipt);
  receipts.unshift(receipt);
  return receipt;
}

function createApproval(agentId, request, decision, receipt) {
  const approval = {
    id: `approval_${randomUUID()}`,
    agentId,
    receiptId: receipt.id,
    receiptHash: receipt.receiptHash,
    domain: request.domain,
    contract: request.contract,
    amount: Number(request.amount),
    asset: "USDC",
    task: request.task || "unspecified_task",
    status: "pending",
    reason: decision.reason,
    risk: decision.risk,
    request: clonePayload({
      domain: request.domain,
      contract: request.contract,
      amount: Number(request.amount),
      task: request.task || "unspecified_task",
      recipient: request.recipient || null,
    }),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    resolvedAt: null,
    resolver: null,
    signature: null,
  };

  approvals.unshift(approval);
  return approval;
}

function getApproval(approvalId) {
  const approval = approvals.find((item) => item.id === approvalId);
  if (!approval) {
    const error = new Error("unknown_approval");
    error.status = 404;
    throw error;
  }
  return approval;
}

function receiptForApproval(approval) {
  return receipts.find((receipt) => receipt.id === approval.receiptId || receipt.receiptHash === approval.receiptHash);
}

function approvalResultPayload(approval, receipt, extra = {}) {
  return {
    status: approval.status,
    reason: approval.reason,
    approval,
    receipt,
    ...extra,
  };
}

function resolveApproval(approvalId, payload = {}) {
  const approval = getApproval(approvalId);
  const receipt = receiptForApproval(approval);
  const agent = getAgent(approval.agentId);
  const decision = payload.decision || payload.status;

  if (!["approved", "denied"].includes(decision)) {
    return {
      status: "blocked",
      reason: "invalid_approval_decision",
      approval,
      receipt,
    };
  }

  if (approval.status !== "pending") {
    return approvalResultPayload(approval, receipt, { replayed: true });
  }

  if (!receipt) {
    approval.status = "blocked";
    approval.reason = "receipt_missing";
    approval.resolvedAt = new Date().toISOString();
    persistState();
    return approvalResultPayload(approval, null);
  }

  if (decision === "denied") {
    approval.status = "denied";
    approval.reason = payload.reason || "owner_denied";
    approval.resolvedAt = new Date().toISOString();
    approval.resolver = payload.resolver || payload.owner || null;
    approval.signature = payload.signature || null;
    receipt.status = "blocked";
    receipt.reason = approval.reason;
    receipt.resolvedAt = approval.resolvedAt;
    persistState();
    return approvalResultPayload(approval, receipt);
  }

  if (agent.paused) {
    approval.status = "blocked";
    approval.reason = "agent_paused";
  } else if (!agent.domains.includes(approval.domain)) {
    approval.status = "blocked";
    approval.reason = "domain_not_allowlisted";
  } else if (!agent.contracts.includes(approval.contract)) {
    approval.status = "blocked";
    approval.reason = "contract_not_allowlisted";
  } else if (agent.spentToday + approval.amount > agent.dailyLimit) {
    approval.status = "blocked";
    approval.reason = "daily_limit_exceeded";
  } else {
    approval.status = "approved";
    approval.reason = payload.reason || "owner_approved";
    agent.spentToday = Number((agent.spentToday + approval.amount).toFixed(6));
    agent.balance = Number((agent.balance - approval.amount).toFixed(6));
  }

  approval.resolvedAt = new Date().toISOString();
  approval.resolver = payload.resolver || payload.owner || null;
  approval.signature = payload.signature || null;
  receipt.status = approval.status === "approved" ? "approved" : "blocked";
  receipt.reason = approval.reason;
  receipt.resolvedAt = approval.resolvedAt;

  const settlement =
    approval.status === "approved"
      ? settlementPayload(approval.agentId, agent, approval.request, receipt.receiptHash)
      : null;
  persistState();

  return approvalResultPayload(approval, receipt, {
    x402:
      approval.status === "approved"
        ? {
            header: `X-PAYMENT: spendos:${receipt.receiptHash}`,
            amount: `${approval.amount} USDC`,
            service: approval.domain,
          }
        : null,
    settlement,
  });
}

function requestBudget(agentId, payload) {
  const idempotency = idempotencyRecord("request_budget", agentId, {
    ...payload,
    domain: "budget",
    contract: "budget",
    amount: payload.maxSpend,
  });
  if (idempotency.replay) return idempotency.replay;
  if (idempotency.conflict) return idempotency.conflict;

  const agent = getAgent(agentId);
  const requested = Number(payload.maxSpend);
  if (!requested || requested <= 0) {
    return { status: "blocked", reason: "invalid_budget_request" };
  }
  if (agent.paused) {
    return { status: "blocked", reason: "agent_paused" };
  }
  if (agent.spentToday + requested > agent.dailyLimit) {
    return { status: "blocked", reason: "daily_limit_exceeded" };
  }

  const reservation = {
    id: `budget_${randomUUID()}`,
    agentId,
    task: payload.task || "unspecified_task",
    maxSpend: requested,
    availableBeforeRequest: Math.max(agent.dailyLimit - agent.spentToday, 0),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
  budgetReservations.set(reservation.id, reservation);
  return storeIdempotency(idempotency, { status: "approved", reservation });
}

function settlementPreview(agentId, payload) {
  const agent = getAgent(agentId);
  const decision = checkPolicy(agentId, payload);
  const previewReceiptHash = hashHex({
    kind: "settlement_preview",
    agentId,
    domain: payload.domain,
    contract: payload.contract,
    amount: Number(payload.amount),
    task: payload.task || "unspecified_task",
    decision,
  });

  return {
    status: decision.status,
    reason: decision.reason,
    risk: decision.risk,
    settlement:
      decision.status === "approved" ? settlementPayload(agentId, agent, payload, previewReceiptHash) : null,
  };
}

async function settlementPreflight(
  agentId,
  payload,
  { provider = null, vaultAddress = SPENDOS_VAULT_ADDRESS, operatorAddress = "" } = {},
) {
  const agent = getAgent(agentId);
  const decision = checkPolicy(agentId, payload);
  const previewReceiptHash = hashHex({
    kind: "settlement_preflight",
    agentId,
    domain: payload.domain,
    contract: payload.contract,
    amount: Number(payload.amount),
    task: payload.task || "unspecified_task",
    decision,
  });
  const settlement =
    decision.status === "approved" ? settlementPayload(agentId, agent, payload, previewReceiptHash, { vaultAddress }) : null;
  const config = settlementConfigStatus(vaultAddress);

  if (decision.status !== "approved") {
    return {
      status: decision.status,
      reason: decision.reason,
      risk: decision.risk,
      config,
      settlement,
      call: null,
    };
  }

  if (!config.vaultReady) {
    return {
      status: "not_configured",
      reason: "vault_address_not_configured",
      risk: decision.risk,
      config,
      settlement,
      call: null,
    };
  }

  if (!provider && !config.rpcReady) {
    return {
      status: "not_configured",
      reason: "rpc_not_configured",
      risk: decision.risk,
      config,
      settlement,
      call: null,
    };
  }

  const callFrom = payload.operatorAddress || operatorAddress || settlementOperatorAddress();
  if (!callFrom || callFrom === "invalid_private_key") {
    return {
      status: "not_configured",
      reason: "operator_address_not_configured",
      risk: decision.risk,
      config,
      settlement,
      call: null,
    };
  }

  const readProvider = provider || getSettlementProvider();
  const transaction = {
    from: safeAddress(callFrom),
    to: settlement.transaction.to,
    data: settlement.transaction.data,
    value: 0,
  };

  try {
    const returnData = await readProvider.call(transaction);
    const gasEstimate = await readProvider.estimateGas(transaction).catch(() => null);
    return {
      status: "ready",
      reason: "preflight_passed",
      risk: decision.risk,
      config,
      operatorAddress: transaction.from,
      settlement,
      call: {
        ok: true,
        returnData,
        gasEstimate: gasEstimate === null ? null : gasEstimate.toString(),
      },
    };
  } catch (error) {
    return {
      status: "would_revert",
      reason: error.reason || error.shortMessage || error.message || "preflight_reverted",
      risk: decision.risk,
      config,
      operatorAddress: transaction.from,
      settlement,
      call: {
        ok: false,
        error: error.message || "preflight_reverted",
        code: error.code || null,
      },
    };
  }
}

function launchReadinessAttempt(agent) {
  const maxAmount = Math.max(Math.min(Number(agent.perTransactionLimit || 0.04), 0.04), 0.01);
  return {
    domain: agent.domains[0] || "api.tokensight.io",
    contract: agent.contracts[0] || "0x8335...2913",
    amount: Number(maxAmount.toFixed(6)),
    task: "SpendOS launch readiness preflight",
  };
}

function readinessCheck(id, label, passed, reason, { severity = "critical", detail = null } = {}) {
  return {
    id,
    label,
    status: passed ? "pass" : "fail",
    severity,
    reason,
    detail,
  };
}

function readinessNextActions(checks) {
  const actions = [];
  const failed = new Set(checks.filter((check) => check.status !== "pass").map((check) => check.id));

  if (failed.has("vault_address")) actions.push("Deploy SpendOSVault or set SPENDOS_VAULT_ADDRESS/SPENDOS_DEPLOYMENT_FILE.");
  if (failed.has("rpc")) actions.push("Set BASE_RPC_URL or BASE_SEPOLIA_RPC_URL for the selected network.");
  if (failed.has("operator_signer")) actions.push("Set SPENDOS_OPERATOR_PRIVATE_KEY for the proxy signer.");
  if (failed.has("vault_policy")) actions.push("Authorize/register the agent vault policy on SpendOSVault.");
  if (failed.has("operator_allowed")) actions.push("Run vault:set-operator with the proxy operator address.");
  if (failed.has("funding")) actions.push("Fund the agent vault with USDC before live settlement.");
  if (failed.has("preflight")) actions.push("Run settlement preflight again after vault, operator, policy, and funding are configured.");

  return actions;
}

async function launchReadiness(
  agentId,
  {
    provider = null,
    vaultAddress = SPENDOS_VAULT_ADDRESS,
    vaultContract = null,
    usdcContract = null,
    operatorAddress = "",
    preflightPayload = null,
  } = {},
) {
  const agent = getAgent(agentId);
  const settlement = settlementConfigSnapshot(vaultAddress);
  const attempt = preflightPayload || launchReadinessAttempt(agent);
  const vault = await vaultStatus(agentId, { provider, vaultAddress, vaultContract, usdcContract, operatorAddress }).catch((error) => ({
    status: "error",
    reason: error.message || "vault_status_failed",
  }));
  const preflight = await settlementPreflight(agentId, attempt, { provider, vaultAddress, operatorAddress }).catch((error) => ({
    status: "error",
    reason: error.message || "preflight_failed",
    call: null,
  }));
  const availableBalance = vault?.policy ? Number(vault.policy.availableBalance) : 0;
  const activeOperatorAddress = operatorAddress || settlement.operatorAddress;
  const checks = [
    readinessCheck("vault_address", "Vault address", settlement.config.vaultReady, "vault address configured", {
      detail: settlement.vault,
    }),
    readinessCheck("rpc", "RPC", settlement.config.rpcReady || Boolean(provider), "RPC configured for read and submit paths", {
      detail: settlement.chain,
    }),
    readinessCheck(
      "operator_signer",
      "Operator signer",
      activeOperatorAddress && activeOperatorAddress !== "invalid_private_key",
      "operator signer can be derived",
      { detail: activeOperatorAddress },
    ),
    readinessCheck("vault_policy", "Vault policy", vault.status === "ready", vault.reason || "agent policy registered", {
      detail: vault.status,
    }),
    readinessCheck("operator_allowed", "Operator permission", vault.operatorAllowed === true, "proxy operator allowed by owner", {
      detail: vault.operatorAllowed ?? null,
    }),
    readinessCheck("funding", "Vault funding", availableBalance > 0, "agent vault has spendable USDC", {
      detail: vault?.policy?.availableBalance ?? null,
    }),
    readinessCheck("preflight", "Settlement preflight", preflight.status === "ready", preflight.reason || "preflight not ready", {
      detail: preflight.status,
    }),
  ];
  const passed = checks.filter((check) => check.status === "pass").length;
  const criticalFailed = checks.some((check) => check.severity === "critical" && check.status !== "pass");

  return {
    status: criticalFailed ? "not_ready" : "ready",
    agentId,
    checkedAt: new Date().toISOString(),
    score: {
      passed,
      total: checks.length,
      percent: Math.round((passed / checks.length) * 100),
    },
    settlement,
    vault,
    preflight,
    attempt,
    checks,
    nextActions: readinessNextActions(checks),
  };
}

async function submitSettlement(agentId, payload, { signer = null, vaultAddress = SPENDOS_VAULT_ADDRESS } = {}) {
  const idempotency = idempotencyRecord("submit_settlement", agentId, payload);
  if (idempotency.replay) return idempotency.replay;
  if (idempotency.conflict) return idempotency.conflict;

  const agent = getAgent(agentId);
  const decision = checkPolicy(agentId, payload);
  const previewReceiptHash = hashHex({
    kind: "settlement_submit_preview",
    agentId,
    domain: payload.domain,
    contract: payload.contract,
    amount: Number(payload.amount),
    task: payload.task || "unspecified_task",
    decision,
  });
  const previewSettlementPayload =
    decision.status === "approved" ? settlementPayload(agentId, agent, payload, previewReceiptHash, { vaultAddress }) : null;

  if (decision.status !== "approved") {
    return storeIdempotency(idempotency, {
      status: decision.status,
      reason: decision.reason,
      risk: decision.risk,
      settlement: previewSettlementPayload,
    });
  }

  const config = settlementConfigStatus(vaultAddress);
  if (!config.vaultReady) {
    return storeIdempotency(idempotency, {
      status: "not_configured",
      reason: "vault_address_not_configured",
      risk: decision.risk,
      config,
      settlement: previewSettlementPayload,
    });
  }
  if (!signer && (!config.rpcReady || !config.signerReady)) {
    return storeIdempotency(idempotency, {
      status: "not_configured",
      reason: "operator_signer_not_configured",
      risk: decision.risk,
      config,
      settlement: previewSettlementPayload,
    });
  }

  const receipt = createReceipt(agentId, payload, { ...decision, status: "submitted" });
  const settlement = settlementPayload(agentId, agent, payload, receipt.receiptHash, { vaultAddress });
  const settlementSigner = signer || getSettlementSigner();
  let tx;

  try {
    tx = await settlementSigner.sendTransaction({
      to: settlement.transaction.to,
      data: settlement.transaction.data,
      value: 0,
    });
  } catch (error) {
    const receiptIndex = receipts.findIndex((item) => item.id === receipt.id);
    if (receiptIndex >= 0) receipts.splice(receiptIndex, 1);
    throw error;
  }

  receipt.txHash = tx.hash;
  receipt.status = "submitted";
  receipt.reason = "settlement_submitted";
  agent.spentToday = Number((agent.spentToday + Number(payload.amount)).toFixed(6));
  agent.balance = Number((agent.balance - Number(payload.amount)).toFixed(6));

  return storeIdempotency(idempotency, {
    status: "submitted",
    reason: "settlement_submitted",
    txHash: tx.hash,
    receipt,
    settlement,
  });
}

function payX402(agentId, payload) {
  const idempotency = idempotencyRecord("pay_x402", agentId, payload);
  if (idempotency.replay) return idempotency.replay;
  if (idempotency.conflict) return idempotency.conflict;

  const agent = getAgent(agentId);
  const decision = checkPolicy(agentId, payload);
  const receipt = createReceipt(agentId, payload, decision);

  if (decision.status !== "approved") {
    const approval = decision.status === "pending" ? createApproval(agentId, payload, decision, receipt) : null;
    return storeIdempotency(idempotency, {
      status: decision.status,
      reason: decision.reason,
      risk: decision.risk,
      receipt,
      approval,
    });
  }

  agent.spentToday = Number((agent.spentToday + Number(payload.amount)).toFixed(6));
  agent.balance = Number((agent.balance - Number(payload.amount)).toFixed(6));

  return storeIdempotency(idempotency, {
    status: "approved",
    reason: "x402_payment_authorized",
    x402: {
      header: `X-PAYMENT: spendos:${receipt.receiptHash}`,
      amount: `${payload.amount} USDC`,
      service: payload.domain,
    },
    receipt,
    settlement: settlementPayload(agentId, agent, payload, receipt.receiptHash),
  });
}

function agentSnapshot(agentId) {
  const agent = getAgent(agentId);
  return {
    agentId,
    ...agent,
    policyDigest: policyDigest(agentId, agent),
    availableDaily: Number((agent.dailyLimit - agent.spentToday).toFixed(6)),
  };
}

function normalizedStringArray(value, field) {
  if (!Array.isArray(value)) {
    const error = new Error(`invalid_${field}`);
    error.status = 400;
    throw error;
  }

  const normalized = value.map((item) => String(item).trim()).filter(Boolean);
  return [...new Set(normalized)];
}

function positiveNumber(value, field) {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) {
    const error = new Error(`invalid_${field}`);
    error.status = 400;
    throw error;
  }
  return next;
}

function updateAgentPolicy(agentId, payload) {
  const agent = getAgent(agentId);
  const patch = {};

  if (Object.hasOwn(payload, "dailyLimit")) {
    patch.dailyLimit = positiveNumber(payload.dailyLimit, "daily_limit");
  }
  if (Object.hasOwn(payload, "perTransactionLimit")) {
    patch.perTransactionLimit = positiveNumber(payload.perTransactionLimit, "per_transaction_limit");
  }
  if (Object.hasOwn(payload, "domains")) {
    patch.domains = normalizedStringArray(payload.domains, "domains");
  }
  if (Object.hasOwn(payload, "contracts")) {
    patch.contracts = normalizedStringArray(payload.contracts, "contracts");
  }
  if (Object.hasOwn(payload, "riskMode")) {
    const riskMode = String(payload.riskMode || "").trim();
    if (!["monitor", "adaptive", "strict", "enforce"].includes(riskMode)) {
      const error = new Error("invalid_risk_mode");
      error.status = 400;
      throw error;
    }
    patch.riskMode = riskMode;
  }
  if (Object.hasOwn(payload, "paused")) {
    patch.paused = Boolean(payload.paused);
  }

  Object.assign(agent, patch);
  persistState();

  return {
    status: "updated",
    agentId,
    policyDigest: policyDigest(agentId, agent),
    policy: agentSnapshot(agentId),
  };
}

function approvalList({ agentId = "", status = "" } = {}) {
  return approvals.filter((approval) => {
    if (agentId && approval.agentId !== agentId) return false;
    if (status && approval.status !== status) return false;
    return true;
  });
}

async function handlePost(pathname, req, res) {
  const body = await parseJson(req);
  body.idempotencyKey ||= req.headers["idempotency-key"];
  const agentId = body.agentId || "research-agent";

  if (pathname === "/v1/request_budget") {
    const result = requestBudget(agentId, body);
    auditEvent({ event: "request_budget", agentId, status: result.status, task: body.task || null, maxSpend: body.maxSpend || null });
    jsonResponse(res, 200, result);
    return;
  }

  if (pathname === "/v1/check_policy") {
    jsonResponse(res, 200, {
      agentId,
      ...checkPolicy(agentId, body),
    });
    return;
  }

  if (pathname === "/v1/policies/update") {
    const result = updateAgentPolicy(agentId, body);
    auditEvent({ event: "policy_update", agentId, status: result.status, policyDigest: result.policyDigest });
    jsonResponse(res, 200, result);
    return;
  }

  if (pathname === "/v1/approvals/resolve") {
    const result = resolveApproval(body.approvalId, body);
    auditEvent({
      event: "approval_resolve",
      agentId: result.approval?.agentId || agentId,
      approvalId: body.approvalId,
      status: result.status,
      reason: result.reason,
    });
    jsonResponse(res, 200, result);
    return;
  }

  if (pathname === "/v1/pay_x402") {
    const result = payX402(agentId, body);
    auditEvent({
      event: "pay_x402",
      agentId,
      status: result.status,
      reason: result.reason,
      domain: body.domain,
      amount: body.amount,
      receiptHash: result.receipt?.receiptHash || null,
    });
    jsonResponse(res, 200, result);
    return;
  }

  if (pathname === "/v1/settlement/preview") {
    jsonResponse(res, 200, settlementPreview(agentId, body));
    return;
  }

  if (pathname === "/v1/settlement/preflight") {
    jsonResponse(res, 200, await settlementPreflight(agentId, body));
    return;
  }

  if (pathname === "/v1/settlement/submit") {
    const result = await submitSettlement(agentId, body);
    auditEvent({
      event: "settlement_submit",
      agentId,
      status: result.status,
      reason: result.reason,
      domain: body.domain,
      amount: body.amount,
      txHash: result.txHash || null,
      receiptHash: result.receipt?.receiptHash || null,
    });
    jsonResponse(res, result.status === "not_configured" ? 503 : 200, result);
    return;
  }

  if (pathname === "/v1/pause_agent") {
    const agent = getAgent(agentId);
    agent.paused = body.paused !== false;
    persistState();
    const result = {
      status: agent.paused ? "paused" : "active",
      agentId,
      policyDigest: policyDigest(agentId, agent),
    };
    auditEvent({ event: "pause_agent", agentId, status: result.status, policyDigest: result.policyDigest });
    jsonResponse(res, 200, result);
    return;
  }

  if (pathname === "/v1/demo/analyze_wallet") {
    const agentObj = agents[agentId] || {};
    const usdc = agentObj.contracts?.[0] || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const weth = agentObj.contracts?.[1] || "0x4200000000000000000000000000000000000006";
    const attempts = [
      { domain: "api.tokensight.io",  contract: usdc,           amount: 0.18, task: "Token price API for wallet analysis" },
      { domain: "risk.baseintel.net", contract: weth,           amount: 0.24, task: "Wallet risk scan with receipt binding" },
      { domain: "unknown-indexer.ai", contract: "0x0000000000000000000000000000000000000bad", amount: 0.9, task: "Contract decode request exceeds trust threshold" },
    ];
    const results = attempts.map((attempt) => payX402(agentId, attempt));
    const result = {
      agentId,
      summary: `Agent spent ${results
        .filter((result) => result.status === "approved")
        .reduce((sum, result) => sum + result.receipt.amount, 0)
        .toFixed(2)} USDC across ${results.filter((result) => result.status === "approved").length} approved tools. ${
        results.filter((result) => result.status !== "approved").length
      } payment blocked. Receipts attached.`,
      results,
    };
    auditEvent({ event: "demo_analyze_wallet", agentId, status: "completed", approved: results.filter((item) => item.status === "approved").length });
    jsonResponse(res, 200, result);
    return;
  }

  jsonResponse(res, 404, { error: "not_found" });
}

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "OPTIONS") {
      jsonResponse(res, 204, {}, { req });
      return;
    }

    const rateLimit = rateLimitRequest(req);
    if (!rateLimit.allowed) {
      auditEvent({ event: "rate_limit_block", path: url.pathname, client: clientIdentity(req), resetAt: rateLimit.resetAt });
      jsonResponse(
        res,
        429,
        {
          error: "rate_limited",
          retryAfter: rateLimit.retryAfter,
          resetAt: rateLimit.resetAt,
        },
        {
          req,
          headers: {
            "retry-after": String(rateLimit.retryAfter),
            "x-ratelimit-limit": String(SPENDOS_RATE_LIMIT_MAX),
            "x-ratelimit-remaining": String(rateLimit.remaining),
            "x-ratelimit-reset": rateLimit.resetAt,
          },
        },
      );
      return;
    }

    const auth = authorizeRequest(req, { pathname: url.pathname });
    if (!auth.allowed) {
      auditEvent({ event: "auth_block", path: url.pathname, client: clientIdentity(req), reason: auth.reason });
      jsonResponse(res, auth.status || 401, { error: auth.reason || "unauthorized" }, { req });
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      jsonResponse(res, 200, { status: "ok", product: "SpendOS x402 proxy", time: new Date().toISOString() }, { req });
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/settlement/config") {
      jsonResponse(res, 200, settlementConfigSnapshot(), { req });
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/vault/status") {
      const agentId = url.searchParams.get("agentId") || "research-agent";
      jsonResponse(res, 200, await vaultStatus(agentId), { req });
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/launch/readiness") {
      const agentId = url.searchParams.get("agentId") || "research-agent";
      jsonResponse(res, 200, await launchReadiness(agentId), { req });
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/ops/readiness") {
      jsonResponse(res, 200, opsReadiness(), { req });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/agents/")) {
      const agentId = decodeURIComponent(url.pathname.split("/")[3] || "");
      jsonResponse(res, 200, agentSnapshot(agentId), { req });
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/receipts") {
      const agentId = url.searchParams.get("agentId");
      jsonResponse(
        res,
        200,
        {
          receipts: agentId ? receipts.filter((receipt) => receipt.agentId === agentId) : receipts,
        },
        { req },
      );
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/receipts/")) {
      const receiptId = url.pathname.slice("/v1/receipts/".length);
      const receipt = receipts.find((r) => r.id === receiptId || r.receiptHash === receiptId);
      if (!receipt) { jsonResponse(res, 404, { error: "not_found" }, { req }); return; }
      jsonResponse(res, 200, receipt, { req });
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/approvals") {
      jsonResponse(
        res,
        200,
        {
          approvals: approvalList({
            agentId: url.searchParams.get("agentId") || "",
            status: url.searchParams.get("status") || "",
          }),
        },
        { req },
      );
      return;
    }

    if (req.method === "POST") {
      await handlePost(url.pathname, req, res);
      return;
    }

    jsonResponse(res, 404, { error: "not_found" }, { req });
  } catch (error) {
    jsonResponse(res, error.status || 400, {
      error: error.message || "bad_request",
    }, { req });
  }
}

export {
  agents,
  approvals,
  receipts,
  approvalList,
  checkPolicy,
  payX402,
  requestBudget,
  resolveApproval,
  updateAgentPolicy,
  launchReadiness,
  vaultStatus,
  settlementPayload,
  settlementPreview,
  settlementPreflight,
  submitSettlement,
  settlementConfigStatus,
  settlementConfigSnapshot,
  loadPersistentState,
  persistState,
  resetProxyState,
  stateFilePath,
  policyDigest,
  createServer,
  handleRequest,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer(handleRequest).listen(PORT, () => {
    console.log(`SpendOS x402 proxy listening on http://127.0.0.1:${PORT}`);
  });
}
