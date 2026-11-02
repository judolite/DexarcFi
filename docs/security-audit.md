# DexArcFi — Security Audit Report
**Date:** 2026-11-02  
**Scope:** All frontend components that move funds (OrderForm, StakingPage, VaultsPage, EarnPage, GatewayPage, SwapPage)  
**Chain:** Arc Testnet (chain ID 5042002)  
**Status:** All critical and high findings fixed. Medium findings fixed. ✅

---

## Summary

| Severity | Count | Status |
|---|---|---|
| Critical | 2 | Fixed |
| High | 2 | Fixed |
| Medium | 1 | Fixed |
| Low/Info | 3 | Acknowledged |

---

## Findings & Fixes

### [CRITICAL] C1 — Placeholder escrow could cause permanent fund loss
**Files:** OrderForm, StakingPage, VaultsPage, EarnPage, GatewayPage  
**Description:** All money-moving flows used hardcoded placeholder addresses (`0x000…0001` through `0x000…0015`). These are not controlled by any deployed protocol contract. Funds sent to them on any chain other than Arc Testnet are permanently unrecoverable.  
**Fix applied:**
- Created `src/security.ts` — single source of truth for all placeholder addresses (`ESCROW_ADDRESSES`), chain guard (`assertTestnetOnly`), amount parser (`parseAmountSafe`), balance checker (`assertSufficientBalance`), and recipient validator (`validateRecipient`).
- Every money-moving handler now calls `assertTestnetOnly(chainId)` before constructing any transaction. If the wallet is on the wrong chain the call throws and shows a clear error — no transaction is submitted.
- All components import escrow addresses from `ESCROW_ADDRESSES` instead of hardcoding them inline.
- A visible amber "Testnet only" banner added to the OrderForm.

### [CRITICAL] C2 — Earn Withdraw/Borrow/Repay submitted wrong transactions
**File:** EarnPage  
**Description:** Regardless of the selected action (Supply/Withdraw/Borrow/Repay), `handleConfirm` always called `erc20.transfer()` from the user's wallet to the pool. "Borrow" and "Withdraw" are the opposite direction — a user expecting to receive funds would instead send them.  
**Fix applied:**
- `openModal` now blocks any action that is not `Supply` with an informational toast: "Withdraw will be available when the lending contracts are deployed on Arc Testnet."
- `handleConfirm` has an early return for non-Supply actions as a second guard.
- Withdraw/Borrow/Repay buttons remain in the UI but are inert until real lending contracts are deployed.

### [HIGH] H1 — Recipient address accepted zero address and non-checksummed inputs
**File:** GatewayPage (Spend tab)  
**Description:** The regex `^0x[0-9a-fA-F]{40}$` accepted `0x000…000` (burn address) and any valid-looking hex string, including mistyped addresses. Funds sent to a mistyped or zero address are irreversible.  
**Fix applied:**
- `validateRecipient()` in `security.ts` uses viem's `isAddress` (EIP-55 checksum check) and `getAddress` (normalises to checksum form).
- Explicitly rejects the zero address with a clear message: "This would permanently burn your funds."
- Explicitly rejects all known placeholder escrow addresses.
- `handleSpend` now calls `validateRecipient()` and uses the returned checksummed address in the transaction.

### [HIGH] H2 — No runtime mainnet safety gate
**Files:** All money-moving components  
**Description:** Chain guards were comment-only ("replace before mainnet") with no runtime enforcement. A misconfigured deploy could ship the placeholder flows to mainnet.  
**Fix applied:**
- `assertTestnetOnly(chainId)` throws at runtime if `chainId !== 5042002`. This is called before every `writeContract`, `kit.swap`, and `unifiedBalance.deposit/spend` call.
- The function message names the wrong chain ID so the user knows exactly what to change.

### [MEDIUM] M1 — Floating-point math on money paths
**Files:** GatewayPage, EarnPage  
**Description:** `parseFloat(amount)` followed by `BigInt(Math.round(x * 10**decimals))` can produce precision errors for edge inputs (very large numbers, scientific notation strings, values near integer boundaries).  
**Fix applied:**
- `parseAmountSafe(raw, decimals)` in `security.ts` uses only string manipulation and integer arithmetic — it splits on `.`, pads/truncates the fractional part to `decimals` digits, and constructs the bigint from two integer parts. No floating-point multiplication is involved.
- All `Math.round(parseFloat(...) * 10**n)` patterns replaced with `parseAmountSafe(...)`.
- Additional guards: rejects negative, NaN, zero, values exceeding `maxWhole=1,000,000`, and inputs containing regex special characters.

---

## Remaining Acknowledged Items

### [LOW] L1 — Wallet balance not checked for USDC Gateway deposits
**File:** GatewayPage  
**Status:** Acknowledged. The Circle Gateway SDK handles the balance check server-side and will reject the transaction if the wallet has insufficient funds. Adding a client-side check requires an additional `useReadContract` call that is out of scope for this audit cycle.

### [LOW] L2 — Slippage not shown in swap confirmation for cross-chain routes
**File:** SwapPage  
**Status:** Acknowledged. Slippage is passed to `estimateSwap`/`swap` as `slippageBps` and enforced by the Circle Swap Kit. The UI shows the estimated output and the slippage tolerance setting. A cross-chain route showing `PENDING` status is expected behaviour per the SDK.

### [INFO] I1 — Staking/Vault/Earn use placeholder addresses on testnet
**Status:** By design. These are Arc Testnet simulation flows until the respective protocol contracts (perp engine, staking contract, lending pool, vaults) are deployed. The `assertTestnetOnly` guard ensures they cannot be called on mainnet. Replace `ESCROW_ADDRESSES.*` values in `src/security.ts` with the deployed contract addresses before any mainnet deployment.

---

## Pre-Mainnet Checklist

Before deploying to mainnet, the following **must** be completed:

- [ ] Replace all `ESCROW_ADDRESSES` values in `src/security.ts` with audited, deployed mainnet contract addresses
- [ ] Change `ALLOWED_CHAIN_ID` in `src/security.ts` to the mainnet chain ID
- [ ] Deploy and audit the perp engine, staking, lending pool, and vault contracts
- [ ] Enable Withdraw, Borrow, and Repay in EarnPage against the real lending contract ABI
- [ ] Get an independent third-party smart contract audit for all deployed contracts
- [ ] Add a USDC balance check for Gateway USDC deposits (`useReadContract` for the gateway USDC balance)
- [ ] Replace the Arc Testnet faucet links with mainnet buy/onramp flows
- [ ] Test all flows on a public testnet with real wallets before mainnet

---

*Generated by DexArcFi security review. Not a substitute for a professional third-party audit.*
