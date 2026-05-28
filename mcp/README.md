# SpendOS MCP Server

Dependency-free MCP stdio server for SpendOS agent spend controls.

It exposes SpendOS proxy actions as agent tools:

- `get_agent_file`
- `request_budget`
- `check_policy`
- `update_policy`
- `pay_x402`
- `preview_settlement`
- `preflight_settlement`
- `get_settlement_config`
- `get_vault_status`
- `get_launch_readiness`
- `submit_settlement`
- `get_receipts`
- `get_approvals`
- `resolve_approval`
- `pause_agent`
- `resume_agent`

## Run

Start the SpendOS proxy first:

```txt
npm run proxy
```

Start the MCP server:

```txt
npm run mcp
```

By default the MCP server connects to:

```txt
http://127.0.0.1:4191
```

Override the proxy URL or default agent:

```txt
SPENDOS_PROXY_URL=http://127.0.0.1:4191 SPENDOS_AGENT=research-agent npm run mcp
```

## Client Config Example

```json
{
  "mcpServers": {
    "spendos": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/spendos-mcp-server.mjs"],
      "env": {
        "SPENDOS_PROXY_URL": "http://127.0.0.1:4191",
        "SPENDOS_AGENT": "research-agent"
      }
    }
  }
}
```

## Safety

`pay_x402` and `submit_settlement` can mutate spend state. Pass an `idempotencyKey` whenever an agent may retry a task. Use `preflight_settlement` before `submit_settlement` when an agent needs a read-only onchain execution check.

## Test

```txt
npm run test:mcp
```
