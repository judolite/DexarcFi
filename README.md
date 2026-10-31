# DexArcFi — Perpetuals Trading on Arc

A Hyperliquid-inspired perpetuals trading terminal running on Arc Testnet with USDC as the native gas token.

Built with [Arc Studio](https://studio.arc.io)

## What It Does

DexArcFi is a full-screen DEX terminal for trading perpetual contracts. Traders connect their wallet, browse live simulated markets (ETH, BTC, SOL, ARB, and more), read the order book and trade history in real time, and place long/short positions with configurable leverage (1x–50x), market or limit order types, and optional take-profit/stop-loss levels.

## Tech Stack

- **React + TypeScript** (Vite)
- **wagmi v2 + ConnectKit** — wallet connection
- **Arc Testnet** — USDC as native gas; default chain
- **Tailwind CSS** — utility-first styling
- **Space Grotesk / DM Sans / JetBrains Mono** — typography

## Development

### Prerequisites

- [Bun](https://bun.sh) (package manager and runtime)
- A browser wallet (MetaMask, Coinbase Wallet, etc.)

### Install

```bash
bun install
```

### Environment Variables

None required for local development. The app reads from the pre-generated `src/onchain-facts.ts` module.

### Run

```bash
bun run dev
```

Open `http://localhost:5173`.

### Build

```bash
bun run build
```

### Check (lint + typecheck)

```bash
bun run check
```

## Features

**Trade:**
- Live simulated order book with bid/ask depth bars
- Candlestick chart (SVG) with OHLC display and time-window selector
- Recent trades feed with buy/sell color coding
- Order form: market/limit/stop orders, 1x–50x leverage, TP/SL, balance-aware size input
- Market selector modal with search across all perpetual pairs
- Positions, open orders, and portfolio bottom panel (wallet-gated)
- Arc Testnet USDC balance reading via wagmi when wallet is connected

**Earn (Lending):**
- Supply USDC, BTC, ETH, HYPE to earn lending yield
- Borrow USDC/USDT against collateral with LTV-based liquidation
- Live APY display, oracle prices, total supplied/borrowed stats

**Vaults:**
- Strategy vaults built on Arc with EVM CoreWriter
- Featured/all filter, TVL, APY, all-time return, max drawdown per vault
- Fully onchain accounting — managers can trade but cannot withdraw depositor funds

**Staking:**
- Proof-of-stake delegation to Arc validators
- Validator table with uptime, estimated APR, commission, status
- Search and sort by stake/APR/commission; inline delegation panel with reward estimates

**Gateway (Circle Gateway — Unified USDC Balance):**
- View a single unified USDC balance aggregated across Arc Testnet, Base Sepolia, Ethereum Sepolia, Arbitrum Sepolia, Avalanche Fuji, OP Sepolia, and Polygon Amoy
- Deposit USDC from any supported chain into the Gateway Wallet via EIP-3009 single-transaction authorization
- Spend (crosschain transfer) USDC from your unified balance to any destination chain in under 500ms via the Circle Forwarding Service — sign once on the source chain only
