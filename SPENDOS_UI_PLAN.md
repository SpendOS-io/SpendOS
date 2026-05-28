# SpendOS UI Direction

## Product Frame

SpendOS is the spending control layer for autonomous AI agents on Base.

It gives AI agents USDC budgets, policy limits, x402/API payment controls, receipts, approvals, and real-time risk alerts. The user does not give an agent an unrestricted wallet. The user gives the agent a controlled SpendOS account.

SpendOS should not look or feel like a GitBank clone. GitBank is a GitHub-native project treasury, bounty, and PR payout workflow. SpendOS is agent payment infrastructure: wallet control, spend policies, x402 payment proxy, audit receipts, and risk defense for autonomous agents.

## Core Positioning

SpendOS

Spending controls for autonomous agents.

Give your AI agents USDC budgets on Base with limits, approvals, x402 payments, receipts, and real-time risk controls.

## Product Concept

A user creates an account for an AI agent, funds it with Base USDC, and defines what that agent can spend.

The agent can request payments for API calls, x402 services, market data, wallet risk scans, contract decoding, research tools, and other paid autonomous actions. SpendOS checks the request against policies, signs or blocks the payment, records the receipt, and shows the full audit trail.

## MVP Scope

### Agent Wallet

- Every agent gets a controlled Base USDC wallet or vault.
- The agent can request spending, but cannot freely drain funds.
- Owner can pause, revoke, or rotate access.
- Wallet status, balance, and spend authority are visible at all times.

### Spend Policies

- Daily spend limit
- Per-transaction limit
- Domain allowlist
- Contract allowlist
- Category-based permissions
- Approval threshold for larger payments
- Block rules for unknown or risky endpoints

### x402 Payment Proxy

- Agent requests a paid API or x402 endpoint.
- SpendOS checks policy before payment.
- If approved, SpendOS signs/executes the payment.
- If blocked, SpendOS returns a structured denial reason.
- Every payment creates a receipt.

### Dashboard

The dashboard answers:

- Which agent spent money?
- Which service did it pay?
- What task or prompt triggered the payment?
- How much USDC was spent?
- Was the payment approved, blocked, or pending?
- What is the tx hash?
- What receipt was produced?

### Risk Alerts

- Unknown endpoint
- Suspicious domain
- High price relative to normal range
- Repeated payment attempt
- Contract not allowlisted
- Possible metadata leak
- Endpoint changed response behavior

### MCP / SDK

SpendOS should expose agent tools for Claude, Codex, Cursor, and custom agents.

Tool names:

- `request_budget`
- `pay_x402`
- `check_policy`
- `get_receipts`
- `pause_agent`

## Best Demo Scenario

The user gives a research agent a task:

"Analyze this wallet."

The agent attempts to call three paid APIs:

- Token price API
- Wallet risk API
- Contract decode API

SpendOS approves two payments, blocks one risky endpoint, spends 0.42 USDC total, and generates a final activity report:

"Agent spent 0.42 USDC across 2 approved tools. 1 payment blocked. Receipts attached."

This demo clearly shows the product value: agents can spend money, but only inside controlled policy boundaries.

## Visual Direction

Design a premium autonomous finance control interface called "SpendOS".

The UI should feel like a classified operational control room for AI agent spending on Base network.

It is not:

- A startup SaaS dashboard
- A chatbot
- A crypto trading UI
- Web3 neon branding

The product should feel like:

"Financial infrastructure for autonomous intelligence."

Visual direction:

- Matte near-black surfaces
- Bone white typography
- Muted pale green accents
- Thin low-contrast geometric borders
- Compressed information density
- Terminal telemetry aesthetics
- Military research terminal vibe
- Operational intelligence dashboard
- Autonomous systems control center
- Subtle radar/scanning visuals
- Receipt, audit, and security visual language
- Dense but elegant layout
- Almost no glow
- Almost no blur
- No gradients
- No glassmorphism
- No floating cards
- No colorful startup palette

Interface inspiration:

- Bloomberg Terminal
- Palantir Foundry
- Old CRT systems
- Military command software
- Speculative research terminals
- Intelligence operations center

Main emotional tone:

- Inevitable
- Classified
- Operational
- Controlled
- Strategic
- Cryptic
- Machine-governed
- Security-first
- Autonomous financial enforcement

## Brand

- Name: SpendOS
- Subtitle: Spending controls for autonomous agents
- Logo: use the provided radar/glyph image from `/Users/frank/Desktop/emergent.jpeg`
- Visual mark: symbolic radar-style glyph, white/pale green on black
- Tone: controlled, intelligent, operational, slightly cryptic

## First Screen

The first screen must be the actual usable product interface, not a landing page.

Full-screen app interface:

- Top navigation
- Left Agent Control panel
- Center main operational surface
- Right Agent File panel

## Layout

Desktop: three-column layout.

1. Left Agent Control panel
2. Center main operational surface
3. Right Agent File panel

Mobile: stacked vertically in the same order.

Panel rules:

- Restrained panels with thin borders
- Sharp rectangular controls
- Very small radius or no radius
- No decorative cards inside cards
- No floating marketing sections
- Compact, dense, readable information hierarchy

## Top Navigation

Elements:

- Symbolic glyph logo
- SpendOS product name
- Subtitle: Spending controls for autonomous agents
- Mode switch: Monitor / Simulate / Enforce
- Copy/export action

## Left Panel

Title: Agent Control

Controls:

- Agent selector
- Agent wallet balance
- USDC budget input
- Daily limit control
- Per-transaction limit control
- Domain allowlist
- Contract allowlist
- x402 category permissions
- Pause Agent button
- Terminal activity log

Example log language:

- `POLICY: daily limit set to 10.00 USDC`
- `REQUEST: research-agent wants to pay 0.18 USDC`
- `CHECK: domain allowlist matched`
- `DENY: endpoint risk score above threshold`
- `RECEIPT: payment recorded on Base`

## Center Stage

The center is the main operational surface.

Elements:

- Animated radar/scanning canvas background
- Agent identity glyph
- Current spend state
- Live payment request queue
- Policy decision feed
- Tabs: Activity, Policies, x402, Risk, Receipts, Simulation
- Approved payments
- Blocked requests
- Autonomous policy enforcement
- Receipt generation feed

This area should feel like real-time autonomous financial operations, not conversation UI.

## Right Panel

Title: Agent File

Fields:

- Agent name
- Network: Base
- Asset: USDC
- Wallet/vault address
- Daily limit
- Risk mode
- Spend authority
- Believability/trust score can be replaced with Risk Score
- One-line memo

Actions:

- Save Policy
- Export Receipts
- Export Policy JSON
- Pause Agent

Library:

- Saved agents
- Recent receipts
- Blocked payments
- Policy templates

## Interaction Feel

SpendOS should imply:

- Autonomous intelligence under financial control
- Agent wallets with enforceable boundaries
- Weak-signal risk detection
- Real-time policy decisions
- Receipts and auditability
- A classified control room for agent money movement

The user should feel: "I am operating autonomous financial enforcement infrastructure."

The user should not feel: "I am using an AI SaaS app."

## Typography

- Modern grotesk sans-serif
- Uppercase metadata labels
- Monospace telemetry logs
- Tight spacing
- Compact operational hierarchy
- No oversized marketing headline unless it names the active agent/system state

## Color System

- Background: `#000000`
- Secondary background: `#0B0F0C`
- Primary text: bone white
- Secondary text: muted gray
- Accent: muted pale green
- Warning: restrained amber
- Danger: restrained red
- Borders: low-contrast gray-green

## Avoid

- GitHub bounty workflow as primary UX
- PR merge payout flow
- Repo treasury language
- Token launchpad language
- Gradient backgrounds
- Neon cyberpunk
- Web3 coin aesthetics
- Glowing purple
- Rounded bubbly SaaS cards
- Hero marketing sections
- Illustrations
- Mascots
- Floating UI
- Generic analytics dashboard
- Chatbot windows
- Card-inside-card layouts
