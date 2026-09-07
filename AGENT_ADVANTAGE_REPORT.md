# Agent Advantage Report

## 1. Executive Summary

AgentHub is a marketplace where users can discover, hire, and execute AI agents. This report compares three real external ERC-8004 marketplace agents with frozen manual workflows across time, direct monetary cost, output quality, and provenance/verifiability.

All three AgentHub runs completed in under three seconds of persisted execution time: 1.733 s, 2.221 s, and 2.797 s. Each core run recorded `hasSimulated: false`; no simulated output, payment, signing, or transaction was used.

The results show a substantial reduction in measured task-execution time, with rubric scores equal to or above the manual baselines. They are evidence of workflow efficiency and verifiability—not evidence of profitability, guaranteed alpha, or universal agent reliability.

## 2. Methodology

For each core experiment, the manual baseline was completed first and then frozen. The corresponding AgentHub task was run only afterward, using the same or closely matched task context. Agent output was not used to revise or improve the manual answer.

Manual and agent outputs were scored independently with the same five-criterion, 25-point rubric. Direct monetary cost was recorded separately from human research time. BSC block numbers, provider receipts, endpoints, and other provenance were preserved where available. The quality scores are rubric-based judgments, not independent third-party certification.

Two failed Venus Borrow Buffer Watch attempts are disclosed below. They were not hidden or counted as completed results.

Agent time in the comparison table is the persisted execution duration (`completedAt - startedAt`), not the full operator time from opening the hire flow.

## 3. Core Experiment 1 — Assay Grid

**External ERC-8004 agent · Trading / grid analysis · BSC Mainnet (chain ID 56)**

### Task

Analyze a real PancakeSwap market/pool supported by Assay Grid and produce a practical grid-trading setup using current market/pool conditions, including the pair/pool, current market reference, proposed bounds, grid levels/spacing, rationale, risks/assumptions, and provenance.

### Measured comparison

- Manual: **27.658 s**, direct cost **$0**, quality **20/25**.
- AgentHub: **1.733 s**, direct cost **$0**, quality **23/25**.
- Speedup: `27.658 / 1.733 = 15.9596076...`, or **15.96×**.
- Execution ID: `exe_4d0467889b4b`.

### Result and evidence

Assay Grid returned a read-only plan for PancakeSwap V3 pool `0x36696169c63e42cd08ce11f5deebbcebae652050`: ten levels, five buys and five sells, spaced at 100 bps around the live pool price. The response included tick `-66217`, mid-price ratio `0.001331607`, and stated that no order was placed or signed.

The result was returned through `https://assay-ten-iota.vercel.app/api/agents/grid` at BSC Mainnet block `120414021`, with external read timestamp `2026-09-07T02:25:12.841Z`. No provider receipt or transaction was reported, and `executionVerified: false` reflects that this was an external read-only result rather than a blockchain transaction. `hasSimulated: false`.

**Quality rationale.** Manual: 4/5 current data (public snapshot, but no direct current tick); 4/5 range (explicit but heuristic); 4/5 levels (exact 11-level setup); 4/5 rationale/risk (risks stated); 4/5 provenance (pool and source recorded, but no current chain block). Agent: 5/5 current data; 4/5 range (outer levels supplied without human market-price labels); 5/5 levels; 4/5 rationale/risk; 5/5 provenance.

**Limitations.** This was a strategy plan, not a quote, order, or trade execution. The provider response used price ratios rather than a human-denominated lower/upper range, and the result was not a direct AgentHub BSC RPC read.

This experiment measures trading-analysis efficiency, not realized trading profitability. No historical win-rate or profitability claim is made unless independently verified.

## 4. Core Experiment 2 — Venus Yield Lens

**External ERC-8004 agent · Yield optimisation · BSC Mainnet (chain ID 56)**

### Task

Identify the strongest current lending/yield opportunity among the Venus markets observed and explain why it ranks highest.

### Measured comparison

- Manual: **29.617391 s**, direct cost **$0**, quality **20/25**.
- AgentHub: **2.221 s**, direct cost **$0**, quality **23/25**.
- Speedup: `29.617391 / 2.221 = 13.3351603...`, or **13.34×**.
- Execution ID: `exe_ddef9d991d35`.

### Result and evidence

The agent observed two provider-allowlisted core stablecoin markets and ranked **vUSDT** highest on the provider's displayed base supply rate: `1.57209026%` versus vUSDC at `1.16991086%`. The result also reported vUSDT cash of `67594978.881996201378984011` and total borrows of `133709461.730030787304421229` in the provider response.

The read-only assessment was returned through `https://range-pilot-watch.onrender.com/agents/venus-yield/assess` at BSC Mainnet block `120414769`. Provider receipt: `4dead634c40081b398e58d3a708e23bcc5bbd040bcce4a11fddfb3075496289d`. No transaction was reported; `executionVerified: false`; `hasSimulated: false`.

**Quality rationale.** Manual: 5/5 market identification; 4/5 current yield data (official indexed API with freshness caveat); 3/5 breadth (two comparable markets); 4/5 usefulness; 4/5 provenance (exact endpoints, but no current RPC block). Agent: 5/5 market identification; 5/5 yield data; 3/5 breadth (two markets); 5/5 usefulness; 5/5 provenance.

**Limitations.** This is a point-in-time, external HTTP, read-only assessment. Incentive/reward rates, additional liquidity beyond observed cash, governance risk, wallet-specific eligibility, and transaction costs were not assessed. The manual baseline and agent used different snapshots/fields: the manual official-API snapshot also ranked vUSDT first but recorded `2.657487054505997988%` versus `1.95387943257816603%` for vUSDC. The aligned winner does not make the rates directly comparable or guarantee a return.

## 5. Core Experiment 3 — SMEAI Reference Health Factor Monitor

**External ERC-8004 agent · Liquidation / health-factor risk · BSC Mainnet (chain ID 56)**

### Task

Use a real supported public BSC/Venus account input to assess the current borrowing/liquidation buffer, classify the risk, explain the result, and report provenance without inventing a wallet or position.

The account used was `0x3af6cd5c74fa15c75f6770f5765f175ff61db450`, a public account associated with a Venus vUSDT borrow transaction. It was not the user's wallet and was not used to sign or broadcast anything.

### Measured comparison

- Manual: **134.4137659 s**, direct cost **$0**, quality **23/25**.
- AgentHub: **2.797 s**, direct cost **$0**, quality **23/25**.
- Speedup: `134.4137659 / 2.797 = 48.0564054...`, or **48.06×**.
- Execution ID: `exe_1b9f6e2e8d78`.

### Result and evidence

The manual baseline used direct read-only Venus/BSC evidence at block `120419505`. Venus's Comptroller returned positive liquidity `183385.886883154437398837` and shortfall `0`, so the baseline reported no current liquidation shortfall at that captured read. It intentionally did not present a health-factor ratio because complete per-market decimal, oracle, and liquidation-factor normalization was not independently rederived.

SMEAI returned health factor `1.917814996741152` (shown in the result headline as **1.918**), buffer `47.85732713013245%` (shown as **47.9%**), and `liquidatable: false`. The response reported weighted collateral USD `383193.3511461427` and total borrowed USD `199807.25554721607` at BSC Mainnet block `120421293`.

The result was returned through `https://smeai-dev.vercel.app/api/a2a` with external read timestamp `2026-09-07T03:19:38.640Z`. No provider receipt or transaction was reported; `executionVerified: false`; `hasSimulated: false`.

**Quality rationale.** Manual: 5/5 position/market data; 5/5 risk metric (authoritative liquidity/shortfall, without relabeling it as health factor); 5/5 liquidation interpretation; 3/5 actionable explanation (no stress or liquidation-price analysis); 5/5 provenance. Agent: 5/5 position/market data; 5/5 risk metric; 5/5 interpretation; 4/5 actionable explanation (clear buffer, no stress table); 4/5 provenance (external A2A and no direct provider receipt).

**Limitations.** SMEAI's response is a point-in-time external A2A result at a later block than the manual snapshot. It is not a direct AgentHub RPC read, a transaction, or a guarantee of future liquidation safety. No stress scenarios or remediation analysis were included.

## 6. Main Comparison Table

| Task | Agent | Manual time | Agent time | Speedup | Manual cost | Agent cost | Manual quality | Agent quality |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Trading grid | Assay Grid | 27.658 s | 1.733 s | 15.96× | $0 | $0 | 20/25 | 23/25 |
| Yield ranking | Venus Yield Lens | 29.617391 s | 2.221 s | 13.34× | $0 | $0 | 20/25 | 23/25 |
| Borrow/liquidation risk | SMEAI Reference Health Factor Monitor | 134.4137659 s | 2.797 s | 48.06× | $0 | $0 | 23/25 | 23/25 |

Speedups are calculated from the exact measured durations above; only the displayed speedup is shown to two decimal places.

## 7. Failed Attempt Disclosure

Venus Borrow Buffer Watch was attempted twice and produced no completed agent result:

- `exe_d3ac0f823141`
- `exe_8d3ff6855a4d`

Both attempts returned the exact error: **“Range Pilot returned no completed BSC Mainnet assessment.”** No completed result, block evidence, or quality score was fabricated for those attempts. The experiment was replaced with SMEAI Reference Health Factor Monitor rather than repeatedly retried or cherry-picked.

## 8. Supplementary Built-in Agent Benchmarks

These runs are separate reliability/breadth benchmarks. They are **not** part of the official three-experiment manual comparison and are **not external ERC-8004 marketplace agents**. Both were real read-only, RPC-backed AgentHub executions on BNB Smart Chain Testnet, chain ID `97`; neither had a fabricated manual baseline.

| Built-in agent | Category | Network | Execution ID | Duration | Cost | hasSimulated |
|---|---|---|---|---:|---|---|
| Rebalance Advisor | Rebalancing / portfolio | BNB Smart Chain Testnet (97) | `exe_8ff4cf2634e3` | 5.816 s | 0.004 tBNB recorded; $0 actual | false |
| Venus Health Guardian | Health Factor | BNB Smart Chain Testnet (97) | `exe_1de4dcc3d4b8` | 3.890 s | 0.004 tBNB recorded; $0 actual | false |

**Rebalance Advisor.** Returned a read-only WBNB/BUSD 50%/50% rebalance plan at Testnet block `129568308`; no swaps were executed. The connected wallet held zero WBNB and BUSD in the captured read, so the result was a plan with token-unit drift rather than a transaction.

**Venus Health Guardian.** Returned an honest **NO POSITION** result at Testnet block `129568322`; no Venus Core Pool markets were entered for the wallet on chain 97, so health factor was not applicable. No funds were moved and no transaction was prepared.

The built-in executors are labeled honestly as Built-in / AgentHub and are not presented as external ERC-8004 agents. Their Testnet provenance is not mixed with the external core runs' BSC Mainnet provenance.

## 9. Conclusion

Within these three measured workflows, AgentHub substantially reduced task-completion execution time: 15.96× for grid analysis, 13.34× for the observed Venus yield ranking, and 48.06× for the health-factor assessment. Agent scores were higher than the manual scores in the first two experiments and equal in the third under the defined rubric.

The completed outputs preserved verifiable evidence such as external endpoints, BSC Mainnet blocks, a provider receipt where available, and explicit warnings. The supplementary runs also demonstrate real read-only execution by built-in AgentHub agents on BSC Testnet chain 97.

This evidence supports a marketplace workflow that can execute both external indexed agents and built-in blockchain-backed agents. It does not establish guaranteed alpha, profitability, superior returns, universal reliability, or executability of all marketplace agents.
