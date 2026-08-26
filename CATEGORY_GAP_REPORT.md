# Category implementation gap report

Audit of AgentHub's agent categories against the four BNB hackathon categories:
**Health Factor Monitoring · Yield Optimisation · Rebalancing · Grid Trading**.

**Nothing in this document is a claim of support.** A category counts as
supported only when a user can hire an agent and receive an answer to the
question the category names, sourced from real data. By that test:

| Hackathon category | Supported today | One-line reason |
|---|---|---|
| Health Factor Monitoring | **No** | The health factor is a deterministic model, not a protocol read |
| Yield Optimisation | **No** | Cannot rank pools; the one thing the category is for is `unavailable` |
| Rebalancing | **No** | The agent named for it returns a balance report, not a rebalancing plan |
| Grid Trading | **No** | Does not exist in any form |

---

## What exists today

Six internal categories, 17 seeded agents, six executors — one per category, in
[agentExecutors.js](backend/services/agentExecutors.js).

| Internal category | Agents | Executor | What it actually returns |
|---|---|---|---|
| `monitoring` | 3 | `runMonitoring` | Balance, nonce, contract-or-wallet, a derived alert threshold |
| `portfolio` | 3 | `runPortfolio` | Native balance, nonce, gas runway; tokens `unavailable` |
| `health-factor` | 2 | `runHealthFactor` | **Modelled** health factor + real wallet balance |
| `research` | 3 | `runResearch` | Contract presence, bytecode size, balance; holders/liquidity `unavailable` |
| `trading` | 3 | `runTrading` | Token-contract check, balance, gas estimate, affordability; routing `unavailable` |
| `yield` | 3 | `runYield` | Wallet balance, entry-cost estimate, fundability; **pool ranking `unavailable`** |

The category enum is wired through five places, all of which must change together
to add one: [Agent.js](backend/models/Agent.js) (`AGENT_CATEGORIES`),
[config.js](frontend/src/config.js) (`CATEGORIES`),
[hire.js](frontend/src/lib/hire.js) (`HIRE_FIELDS`),
[agentExecutors.js](backend/services/agentExecutors.js) (`EXECUTORS` +
`ADDRESS_INPUTS`), and [seedAgents.js](backend/data/seedAgents.js).

### Real vs simulated, precisely

**Real** — read live from BNB testnet every run: chain id, block number and
timestamp, gas price, native balances, account nonces, contract bytecode
presence and size. **Derived** (arithmetic on those, with the assumption stated):
gas-fee estimates, alert thresholds, affordability, gas runway.

**Simulated** — one file only,
[lendingProtocolAdapter.js](backend/services/lendingProtocolAdapter.js): health
factor, collateral, borrow, liquidation threshold. Deterministic hash of the
address so it is stable per wallet. Every field is tagged `simulated` and the UI
renders that label per value.

**Honestly withheld** (`unavailable` rather than invented): BEP-20 token
positions, pool/APY rankings, DEX routing, holder distribution, liquidity depth,
audit status, admin keys.

The gaps are all one shape: **AgentHub has no verified BNB testnet contract
addresses for any protocol.** AGENTS.md forbids guessing them. Every "not
supported" verdict below traces back to that single missing input.

---

## Per-category gap

### 1. Health Factor Monitoring

- **Exists:** a complete product flow — 2 agents, hire form (position wallet,
  protocol, warn-below threshold), executor, result page with risk bands, and a
  real wallet-balance read alongside the modelled position.
- **Real:** wallet native balance, block, gas price, threshold-breach arithmetic.
- **Simulated:** the health factor itself, collateral, borrow — i.e. the answer.
- **Needs:** one verified lending-protocol testnet deployment (Venus Comptroller
  or Radiant LendingPool) — address confirmed on testnet.bscscan.com as the
  protocol's own, plus the ABI selectors for the account-liquidity call. Then
  swap `readHealthFactor` to an `eth_call` and flip `source` to `chain`.
- **Reusable:** everything. The adapter is already written as a seam with the
  real path marked (`DEPLOYMENTS`, `hasVerifiedDeployment`), and the output
  contract does not change — only `source`.
- **New agents/executors:** none.
- **Data sources:** verified protocol address + ABI. Nothing else.
- **Realistic in remaining time:** **yes, and it is the highest-value fix.** The
  work is address verification plus one `eth_call`, not new architecture. Risk:
  the protocol may not have a usable testnet deployment, which must be confirmed
  before committing. If it does not, say so publicly rather than shipping the
  model as if it were real.

### 2. Yield Optimisation

- **Exists:** 3 agents, hire form (allocation, risk level, minimum APY),
  executor, result page.
- **Real:** wallet balance, gas price, entry-cost estimate, fundability.
- **Missing:** the actual optimisation. "Ranked pool candidates" returns *Not
  available*. A user asking "where should I put this?" gets no answer.
- **Needs:** for each candidate pool — a verified testnet pair/vault address, a
  way to read reserves or an APY-bearing value on-chain, and a documented
  formula converting that to APY. Ranking then needs a stated risk weighting.
- **Reusable:** hire form, executor scaffold, fundability and entry-cost
  arithmetic, the `unavailable` labelling.
- **New agents/executors:** no new executor; `runYield` needs a real ranking
  branch and a pool-data adapter alongside the lending adapter.
- **Data sources:** verified addresses for at least 2–3 pools, plus reserve reads.
  An external APY API would be an off-chain dependency and a new provenance
  class — it would need its own label, not `chain`.
- **Realistic in remaining time:** **partially.** A credible narrow version is
  feasible: 2–3 verified pools, APY derived from on-chain reserves with the
  formula stated, ranked by a declared rule. A general "best yield across BNB
  Chain" optimiser is not, and should not be claimed.

### 3. Rebalancing

- **Exists:** an agent named `rebalance-advisor` (`category: 'portfolio'`,
  `subcategory: 'Rebalancing'`, `status: 'live'`), tagline *"Tells you what to
  trade to hit your target allocation."*
- **Reality:** it runs `runPortfolio` and returns native balance, nonce and gas
  runway. **There is no target allocation input, no drift calculation, and no
  trade list.** The name promises something the code does not do, which is the
  most serious honesty problem in the current build — worse than an
  `unavailable` label, because nothing signals the mismatch to the user.
- **Needs:** a target-allocation input (asset → target %); current holdings per
  asset (which requires token balances — the same blocker as portfolio's
  `unavailable` token positions); prices to value holdings in a common unit;
  drift-vs-target arithmetic; a buy/sell list with sizes; and a gas estimate per
  trade.
- **Reusable:** gas estimation, affordability, the `input` provenance class, the
  result-field renderer, and the trading executor's contract-verification step.
- **New:** a `rebalancing` category with its own executor and `HIRE_FIELDS`
  (repeatable allocation rows), or an honest re-scope of the existing agent.
- **Data sources:** verified BEP-20 token addresses to read `balanceOf` per
  asset, and a price source. **Prices are the hard blocker** — there is no
  trustworthy testnet price feed, and testnet token prices are meaningless.
- **Realistic in remaining time:** **only in a restricted form.** A defensible
  version: user declares the assets and target percentages, agent reads
  `balanceOf` for each verified token address, computes drift **in token units**
  (not fiat), and outputs a trade list in token units with real gas estimates.
  That is genuine rebalancing arithmetic on real balances and avoids inventing
  prices. A fiat-valued rebalancer is not achievable honestly.
- **Immediate action regardless:** `rebalance-advisor` should not stay `live`
  with a rebalancing tagline while it returns a portfolio report. Either build
  the restricted version or relabel the agent.

### 4. Grid Trading

- **Exists:** **nothing.** No category, no agent, no executor, no hire fields, no
  UI. It is absent from the enum in all five wiring points and from the 17 seeded
  agents.
- **Needs:** a `grid-trading` category; hire fields (token, upper bound, lower
  bound, grid count, capital per level); an executor that verifies the token
  contract, reads the wallet balance, computes the grid levels and per-level
  order size, and estimates total gas across the grid; and a result view for the
  ladder.
- **Reusable:** a lot. `runTrading` already verifies a token contract, reads a
  balance, and estimates swap gas at a real gas price — the grid executor is that
  plus level arithmetic. Address validation, provenance, and the result renderer
  all apply unchanged.
- **Data sources:** the current price of the token, to place the grid around it.
  **This is the blocker** — no verified testnet DEX router or pair address is on
  file, so a market price cannot be read. Without it a grid can only be built
  around a **user-supplied** reference price (provenance `input`, not `chain`).
- **Realistic in remaining time:** **yes, in a plan-only form,** consistent with
  how `trading` already works (AgentHub prepares plans; it never submits). Grid
  levels from a user-supplied reference price are honest arithmetic — real
  balance, real gas price, stated assumption. A grid built on a chain-read market
  price requires verified DEX addresses first.

---

## What can realistically be completed

In value-per-effort order, given the four-category requirement:

1. **Health factor → real.** Verify one protocol deployment, one `eth_call`.
   Removes the only simulated data in the system and makes the category
   genuinely supported. Also unlocks `health-factor` for Agent Advantage
   experiments, which it is currently disqualified from.
2. **Grid trading → new plan-only category.** Highest coverage gain per unit of
   work; reuses the trading executor's real reads; needs no new data source if
   the reference price is a declared input.
3. **Rebalancing → restricted, token-unit version,** or relabel the existing
   agent. The honesty fix is not optional either way.
4. **Yield → narrow, verified-pool version** with the APY formula stated.
   Genuinely useful but the most data-dependent, so the most likely to be
   blocked by address verification.

**The one prerequisite that gates 1, 3 and 4:** verified BNB testnet contract
addresses. That is a research task, not a coding task, and it should happen
before any of this is scheduled — if the addresses do not exist or cannot be
confirmed, the honest outcome is to ship fewer categories and say which are real,
not to fill the gaps with models.

**Recommended framing for the submission:** claim exactly what works, name each
category's data source, and let the `unavailable` labels stand as evidence of
discipline rather than hiding them. Four shallow categories with invented cores
would be worth less than two real ones.
