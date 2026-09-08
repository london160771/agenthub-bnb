# Agent Advantage Evidence

Status: **completed evidence package**. Experiments 1 and 2 and the replacement Experiment 3 completed as real AgentHub runs, and their persisted MongoDB execution records are included below. The original Venus Borrow Buffer Watch experiment failed twice with the same disclosed provider/result error and was not rerun. The replacement SMEAI Health Factor Monitor execution is `exe_1b9f6e2e8d78`, measured at `2.797 seconds`, with BSC Mainnet block `120421293`, health factor `1.918`, buffer `47.9%`, and `liquidatable: false`. No payment, signing, or transaction was attempted.

All timestamps below are UTC ISO 8601 timestamps. The manual outputs are preserved as written at the end of each manual section; they were not revised using any AgentHub output.

## 1. Methodology

For each completed controlled experiment:

1. I started the manual timer.
2. I used public read-only sources and completed the manual answer.
3. I stopped the timer and froze the manual answer.
4. Only then did I run the matching AgentHub task through the existing runtime.
5. I preserved the persisted execution record and did not use its output to revise the frozen manual answer.

For the replacement Experiment 3, I completed and froze the manual baseline after inspecting the SMEAI schema, then invoked SMEAI and preserved its completed execution record below.

Direct monetary cost for the public manual work was `$0` in each experiment. This means no paid API, transaction, or wallet action was used. The three completed external AgentHub records report `cost: 0` with currency `none`; this is a recorded free execution, not an estimate.

The controlled runtime was the existing AgentHub frontend at `http://localhost:5173` and backend at `http://localhost:3001`. No AgentHub process was started, restarted, replaced, or moved to a temporary port. Port 5174 was not touched.

## 2. Experiment 1 — Trading / Assay Grid

### Task

Analyze a real PancakeSwap market/pool supported by Assay Grid and produce a practical grid-trading setup using current market/pool conditions.

The output should include the pair/pool analyzed, current market reference, proposed lower and upper bounds, grid levels/spacing, rationale, risks/assumptions, and provenance. No profitability or historical win-rate claim is allowed without independent evidence.

### A. Manual baseline

- Start: `2026-09-07T00:00:17.3284349Z`
- Finish: `2026-09-07T00:00:44.9861693Z`
- Duration: `27.658 seconds`
- Direct monetary cost: `$0`
- Selected pool: PancakeSwap V3 WBNB/USDT
- Pool: `0x36696169c63e42cd08ce11f5deebbcebae652050`
- WBNB: `0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c`
- USDT: `0x55d398326f99059ff775485246999027b3197955`
- DEX: `pancakeswap_v3`
- Pool created block: `26970848`

Public snapshot from the [DexPaprika PancakeSwap V3 pool endpoint](https://api.dexpaprika.com/networks/bsc/pools/0x36696169c63e42cd08ce11f5deebbcebae652050):

- `last_price`: `752.2612227177431`
- `last_price_usd`: `752.4864219249353`
- Source `price_time`: `2026-09-06T23:58:38Z`
- Liquidity: `$11,100,431.651350467`
- 24-hour volume: `$12,222,019.468382088`
- 24-hour change: `-1.938162105484333%`
- 1-hour change: `+0.1328444865%`
- 6-hour change: `+0.5926592330%`
- 24-hour buys/sells: `7,520 / 9,134`

Calculation assumptions: the displayed USD price was used as a USDT-denominated reference because the source did not expose a current pool tick or liquidity distribution in this response. I used a symmetric `+/-5%` range and `1%` spacing, producing 11 inclusive levels. This is a disclosed heuristic, not a backtest or profitability claim.

Frozen manual output:

> Analyze PancakeSwap V3 WBNB/USDT, pool `0x36696169c63e42cd08ce11f5deebbcebae652050`. The current reference is `$752.4864` per WBNB from the public snapshot at `2026-09-06T23:58:38Z`. Use a provisional lower bound of `$714.86` and upper bound of `$790.11`, approximately `-5%` to `+5%` around spot, with `1%` spacing and 11 levels: `$714.86`, `$722.39`, `$729.91`, `$737.44`, `$744.96`, `$752.49`, `$760.01`, `$767.54`, `$775.06`, `$782.59`, `$790.11`. The range is centered on spot because the pool has substantial observed liquidity and volume, while the short-term moves were positive but the 24-hour move was negative, so a mean-reversion-oriented range is a reasonable starting hypothesis. Risks and assumptions: the range is not liquidity-aware; the source does not provide the current tick or distribution; price can leave the range; inventory can become one-sided; gas, fees, slippage, and stablecoin/pool risks can reduce results; and indexed data may lag. This is analysis only and does not claim profitability or a historical win rate. Provenance: public DexPaprika pool response, pool/token addresses above, source timestamp, and pool-created block `26970848`.

Manual quality score: **20/25**

- Current/correct market data: **4/5** — current public price, source timestamp, liquidity, volume, and changes were captured, but no direct RPC tick was available.
- Actionable price range: **4/5** — exact bounds were supplied with an explicit heuristic, but the range was not derived from tick/liquidity distribution.
- Actionable grid levels: **4/5** — 11 exact levels and spacing are usable as a starting setup, but not liquidity-aware.
- Rationale/risk explanation: **4/5** — the market context and important risks are stated without unsupported performance claims.
- Provenance/verifiability: **4/5** — pool identity, token addresses, public source, source time, and created block are included, but no current chain block was captured.

### B. AgentHub run

- AgentHub route: `/hire/8004-56-331751` (Assay Grid)
- Persisted record source: MongoDB `Execution` record from the live backend.
- Execution ID: `exe_4d0467889b4b`
- Agent ID: `8004-56-331751`
- Status: `completed`
- Input task: `Assay Grid — trading task (pancakeswap v3 pool: 0x3669…2050; levels per side (optional): 5; spacing (optional): 100 bps)`
- `startedAt`: `2026-09-07T02:25:04.402Z`
- `completedAt`: `2026-09-07T02:25:06.135Z`
- Measured AgentHub duration: `1.733 seconds` (`durationMs: 1733`)
- Hire-created to completion: approximately `5.467 seconds` (`createdAt: 2026-09-07T02:25:00.668Z`)
- Direct AgentHub cost: `0` (`currency: none`; no payment)
- Execution protocol: `a2a`
- Payment protocol: `none`
- Agent endpoint: `https://assay-ten-iota.vercel.app/api/agents/grid`
- Network: `BSC Mainnet` / `bnb-mainnet` / chain ID `56`
- Block: `120414021`
- Provider receipt: none reported; transaction hash is empty; `executionVerified: false` because this was a read-only external result, not a blockchain transaction.
- `hasSimulated`: `false`
- Warnings: `This is external HTTP/A2A-advertised service output, not a BSC RPC read and not a trade execution.`

Full persisted `rawResult`:

```json
{
  "agent": "Assay Grid",
  "category": "grid",
  "pool": "0x36696169c63e42cd08ce11f5deebbcebae652050",
  "block": "120414021",
  "at": "2026-09-07T02:25:12.841Z",
  "tick": -66217,
  "midPriceRatio": 0.001331607,
  "spacingBps": 100,
  "levels": [
    { "side": "buy", "price": 0.001265026 },
    { "side": "buy", "price": 0.001278343 },
    { "side": "buy", "price": 0.001291659 },
    { "side": "buy", "price": 0.001304975 },
    { "side": "buy", "price": 0.001318291 },
    { "side": "sell", "price": 0.001344923 },
    { "side": "sell", "price": 0.001358239 },
    { "side": "sell", "price": 0.001371555 },
    { "side": "sell", "price": 0.001384871 },
    { "side": "sell", "price": 0.001398187 }
  ],
  "verdict": "10 levels placed 100 bps apart around the live pool price.",
  "source": "PancakeSwap V3 pool slot0(), read live"
}
```

Full persisted `normalizedResult`:

```json
{
  "headline": "10 levels placed 100 bps apart around the live pool price.",
  "summary": "Assay Grid returned live PancakeSwap V3 pool data through an external HTTP service at BSC Mainnet block #120414021. This is a strategy plan only; no order was placed or signed.",
  "fields": [
    { "key": "agent", "label": "External agent", "value": "Assay Grid", "source": "external" },
    { "key": "pool", "label": "Pool", "value": "0x36696169c63e42cd08ce11f5deebbcebae652050", "source": "external" },
    { "key": "tick", "label": "Current tick", "value": "-66217", "source": "external" },
    { "key": "midPriceRatio", "label": "Mid-price ratio", "value": "0.001331607", "source": "external" },
    { "key": "spacingBps", "label": "Spacing", "value": "100 bps", "source": "external" },
    { "key": "block", "label": "BSC Mainnet block", "value": "#120,414,021", "source": "external" },
    { "key": "readAt", "label": "External read at", "value": "2026-09-07T02:25:12.841Z", "source": "external" }
  ],
  "tables": [
    {
      "title": "Assay Grid result",
      "note": "Levels are copied from the verified external response. They are not orders, quotes, or transaction calldata.",
      "columns": [
        { "key": "level", "label": "Level" },
        { "key": "side", "label": "Side" },
        { "key": "price", "label": "Price" }
      ],
      "rows": [
        { "level": { "value": "1", "source": "external" }, "side": { "value": "BUY", "source": "external" }, "price": { "value": "0.001265026", "source": "external" } },
        { "level": { "value": "2", "source": "external" }, "side": { "value": "BUY", "source": "external" }, "price": { "value": "0.001278343", "source": "external" } },
        { "level": { "value": "3", "source": "external" }, "side": { "value": "BUY", "source": "external" }, "price": { "value": "0.001291659", "source": "external" } },
        { "level": { "value": "4", "source": "external" }, "side": { "value": "BUY", "source": "external" }, "price": { "value": "0.001304975", "source": "external" } },
        { "level": { "value": "5", "source": "external" }, "side": { "value": "BUY", "source": "external" }, "price": { "value": "0.001318291", "source": "external" } },
        { "level": { "value": "6", "source": "external" }, "side": { "value": "SELL", "source": "external" }, "price": { "value": "0.001344923", "source": "external" } },
        { "level": { "value": "7", "source": "external" }, "side": { "value": "SELL", "source": "external" }, "price": { "value": "0.001358239", "source": "external" } },
        { "level": { "value": "8", "source": "external" }, "side": { "value": "SELL", "source": "external" }, "price": { "value": "0.001371555", "source": "external" } },
        { "level": { "value": "9", "source": "external" }, "side": { "value": "SELL", "source": "external" }, "price": { "value": "0.001384871", "source": "external" } },
        { "level": { "value": "10", "source": "external" }, "side": { "value": "SELL", "source": "external" }, "price": { "value": "0.001398187", "source": "external" } }
      ]
    }
  ],
  "warnings": [
    "This is external HTTP/A2A-advertised service output, not a BSC RPC read and not a trade execution."
  ],
  "recommendation": "Read-only grid analysis returned. Review the plan separately before taking any action; AgentHub does not place orders.",
  "hasSimulated": false,
  "provenance": {
    "source": "external-http-a2a",
    "transport": "external-http",
    "endpoint": "https://assay-ten-iota.vercel.app/api/agents/grid",
    "metadataUrl": "https://assay-ten-iota.vercel.app/api/agents/grid/card",
    "chainId": 56,
    "network": "BSC Mainnet",
    "blockNumber": 120414021,
    "readAt": "2026-09-07T02:25:12.841Z",
    "explorer": "https://bscscan.com"
  },
  "rawResponse": {
    "agent": "Assay Grid",
    "category": "grid",
    "pool": "0x36696169c63e42cd08ce11f5deebbcebae652050",
    "block": "120414021",
    "at": "2026-09-07T02:25:12.841Z",
    "tick": -66217,
    "midPriceRatio": 0.001331607,
    "spacingBps": 100,
    "levels": [
      { "side": "buy", "price": 0.001265026 },
      { "side": "buy", "price": 0.001278343 },
      { "side": "buy", "price": 0.001291659 },
      { "side": "buy", "price": 0.001304975 },
      { "side": "buy", "price": 0.001318291 },
      { "side": "sell", "price": 0.001344923 },
      { "side": "sell", "price": 0.001358239 },
      { "side": "sell", "price": 0.001371555 },
      { "side": "sell", "price": 0.001384871 },
      { "side": "sell", "price": 0.001398187 }
    ],
    "verdict": "10 levels placed 100 bps apart around the live pool price.",
    "source": "PancakeSwap V3 pool slot0(), read live"
  },
  "reads": [
    {
      "method": "HTTP GET",
      "target": "https://assay-ten-iota.vercel.app/api/agents/grid?pool=0x36696169c63e42cd08ce11f5deebbcebae652050&steps=5&spacingBps=100",
      "status": 200
    }
  ]
}
```

AgentHub quality score: **23/25**

- Current/correct market data: **5/5** — the result carries a live pool tick, mid-price ratio, source timestamp, and BSC Mainnet block.
- Actionable price range: **4/5** — exact outer levels are supplied, but the result does not label lower/upper bounds in a human market-price unit.
- Actionable grid levels: **5/5** — ten exact buy/sell levels and the 100 bps spacing are directly usable as an analysis artifact.
- Rationale/risk explanation: **4/5** — it clearly says this is a strategy plan only and not an order, but gives limited market-specific risk rationale.
- Provenance/verifiability: **5/5** — pool, endpoint, metadata URL, read timestamp, chain ID, block, and explorer are persisted.

### Limitations

This experiment compares the frozen manual workflow with one completed, free, read-only AgentHub analysis. The external result is not a BSC RPC read, quote, order, or trade execution; its prices are ratios from the provider response and are not a profitability claim.

**This experiment measures trading-analysis efficiency, not realized trading profitability. No historical win-rate or profitability claim is made unless independently verified.**

## 3. Experiment 2 — Yield / Venus Yield Lens

### Task

Identify the strongest current lending/yield opportunity among the Venus markets observed and explain why it ranks highest.

### A. Manual baseline

- Start: `2026-09-07T00:01:05.3811732Z`
- Finish: `2026-09-07T00:01:34.9985642Z`
- Duration: `29.617391 seconds`
- Direct monetary cost: `$0`
- Public source: [Venus API documentation](https://github.com/venusprotocol/venus-protocol-documentation/blob/main/services/api.md)
- Source endpoints:
  - `https://api.venus.io/markets?chainId=56&symbol=vUSDC&limit=1`
  - `https://api.venus.io/markets?chainId=56&symbol=vUSDT&limit=1`

The Venus documentation warns that indexed data can lag or omit recent events and should not be treated as authoritative for balances or liquidation safety. The comparison below is therefore a snapshot of the displayed API fields, not a guaranteed return.

Observed vUSDC:

- Address: `0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8`
- Supply APY: `1.95387943257816603%`
- Borrow APY: `3.817807350573812087%`
- Total supply: `$51,695,511.88`
- Total borrow: `$29,664,426.13`
- Liquidity: approximately `$22,031,089.07`
- Borrowers/suppliers: `3,766 / 14,928`
- Listed, borrowable, and collateral-enabled in the response

Observed vUSDT:

- Address: `0xfD5840Cd36d94D7229439859C0112a4185BC0255`
- Supply APY: `2.657487054505997988%`
- Borrow APY: `4.458560389804247612%`
- Total supply: `$200,135,288.02`
- Total borrow: `$133,704,485.18`
- Liquidity: approximately `$66,430,979.49`
- Borrowers/suppliers: `6,250 / 41,665`
- Listed, borrowable, and collateral-enabled in the response

Frozen manual output:

> Among the two provider-allowlisted core stablecoin markets observed, vUSDT ranks strongest on current displayed base supply APY: `2.6575%` versus vUSDC `1.9539%`, a `0.7036` percentage-point lead. vUSDT also shows greater absolute liquidity and market size in this snapshot. This is a ranking of the observed API field, not a guaranteed return or allocation instruction. Risks include stablecoin depeg, changing supply/borrow rates, smart-contract and oracle risk, and lag or omission in indexed API data. Only two comparable markets were observed, so this is not a ranking of every Venus market and does not account for a wallet-specific rate or transaction costs.

Manual quality score: **20/25**

- Correct market identification: **5/5** — both selected market IDs and addresses are recorded from the official API response.
- Correct/current yield data: **4/5** — the endpoints were queried during the timed baseline, but the API is indexed and carries a freshness caveat.
- Comparison breadth: **3/5** — two comparable core stablecoin markets were compared, not the full Venus universe.
- Usefulness of recommendation: **4/5** — the winner, spread, scale context, and limitations are clear without pretending the APY is guaranteed.
- Provenance/verifiability: **4/5** — official API documentation and exact endpoints are recorded, but no current BSC RPC block was attached to the indexed snapshot.

### B. AgentHub run

- AgentHub route: `/hire/8004-56-322046` (Venus Yield Lens)
- Persisted record source: MongoDB `Execution` record from the live backend.
- Execution ID: `exe_ddef9d991d35`
- Agent ID: `8004-56-322046`
- Status: `completed`
- Input task: `Venus Yield Lens — yield task (assessment set: usd-stablecoins; venus markets (optional): core-vUSDC, core-vUSDT)`
- `startedAt`: `2026-09-07T02:30:40.527Z`
- `completedAt`: `2026-09-07T02:30:42.748Z`
- Measured AgentHub duration: `2.221 seconds` (`durationMs: 2221`)
- Hire-created to completion: approximately `6.269 seconds` (`createdAt: 2026-09-07T02:30:36.479Z`)
- Direct AgentHub cost: `0` (`currency: none`; no payment)
- Execution protocol: `http`
- Payment protocol: `none`
- Agent endpoint: `https://range-pilot-watch.onrender.com/agents/venus-yield/assess`
- Network: `BSC Mainnet` / `bnb-mainnet` / chain ID `56`
- Block: `120414769`
- Provider receipt: `4dead634c40081b398e58d3a708e23bcc5bbd040bcce4a11fddfb3075496289d`; no transaction hash was reported.
- `executionVerified`: `false` because this was a provider assessment receipt, not an AgentHub blockchain transaction.
- `hasSimulated`: `false`
- Warnings: external HTTP read-only output; incentives/reward rates, additional liquidity, governance risk, and account eligibility were not assessed.

Full persisted `rawResult`:

```json
{
  "schemaVersion": "1.0.0",
  "agent": { "id": "venus-yield", "category": "Yield Optimisation" },
  "status": "completed",
  "chainId": 56,
  "request": { "assetId": "usd-stablecoins", "markets": ["core-vUSDC", "core-vUSDT"] },
  "assessment": {
    "markets": [
      {
        "marketId": "core-vUSDC",
        "marketSymbol": "vUSDC",
        "marketAddress": "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8",
        "vTokenDecimals": 8,
        "underlying": { "symbol": "USDC", "address": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", "decimals": 18 },
        "supplyRatePerBlockMantissa": "276621682",
        "displayedSupplyRatePercent": "1.16991086",
        "cash": { "raw": "22054010524421606650445604", "decimal": "22054010.524421606650445604" },
        "totalBorrows": { "raw": "29662240900258916260962939", "decimal": "29662240.900258916260962939" },
        "totalReserves": { "raw": "33372454881900368791", "decimal": "33.372454881900368791" }
      },
      {
        "marketId": "core-vUSDT",
        "marketSymbol": "vUSDT",
        "marketAddress": "0xfD5840Cd36d94D7229439859C0112a4185BC0255",
        "vTokenDecimals": 8,
        "underlying": { "symbol": "USDT", "address": "0x55d398326f99059fF775485246999027B3197955", "decimals": 18 },
        "supplyRatePerBlockMantissa": "370979418",
        "displayedSupplyRatePercent": "1.57209026",
        "cash": { "raw": "67594978881996201378984011", "decimal": "67594978.881996201378984011" },
        "totalBorrows": { "raw": "133709461730030787304421229", "decimal": "133709461.730030787304421229" },
        "totalReserves": { "raw": "99060148900729134983", "decimal": "99.060148900729134983" }
      }
    ],
    "highestObservedDisplayedSupplyRateAmongQueriedAllowlistedMarkets": { "marketId": "core-vUSDT", "displayedSupplyRatePercent": "1.57209026" },
    "conversionAssumptions": {
      "rateMantissaScale": "1e18",
      "blocksPerDay": 115200,
      "daysPerYear": 365,
      "formula": "daily-compounded annual display = (1 + ratePerBlock * blocksPerDay)^daysPerYear - 1",
      "comparisonBasis": "raw same-block supplyRatePerBlock mantissa; incentives excluded"
    }
  },
  "evidence": {
    "block": { "number": 120414769, "timestamp": "2026-09-07T02:30:49.000Z" },
    "contractAddresses": {
      "core-vUSDC": "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8",
      "core-vUSDT": "0xfD5840Cd36d94D7229439859C0112a4185BC0255",
      "core-vUSDC-underlying": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      "core-vUSDT-underlying": "0x55d398326f99059fF775485246999027B3197955"
    },
    "sourceLinks": [
      "https://docs.venus.io/deployed-contracts/markets",
      "https://github.com/VenusProtocol/venus-protocol/blob/develop/contracts/Tokens/VTokens/VToken.sol",
      "https://github.com/VenusProtocol/venus-protocol-documentation/blob/main/guides/protocol-math.md"
    ],
    "observedAt": "2026-09-07T02:30:49.567Z"
  },
  "unknowns": [
    "Incentive and reward rates are not read or included.",
    "Available liquidity beyond observed contract cash is not assessed.",
    "Governance and smart-contract governance risk are not assessed.",
    "Supply, collateral, reward, and account eligibility are not assessed.",
    "Future rate changes and rate persistence are unknown.",
    "Oracle state and oracle risk are not assessed.",
    "User-specific circumstances and suitability are not assessed."
  ],
  "limitations": [
    "Point-in-time, block-pinned contract state can become stale immediately after the cited block.",
    "No wallet, signing, swap, transaction, approval, execution, quote, valuation, or calldata interface is provided.",
    "The assessment makes no profitability, safety, suitability, or recommendation claim.",
    "The highlighted market is only the highest observed displayed supply rate within this request and fixed allowlist.",
    "USDC and USDT are distinct underlying assets; no peg equivalence, conversion, price, or value comparison is performed.",
    "Cash, borrows, and reserves are stored-state observations and may not include interest accrued by a later state-changing interaction."
  ],
  "observedAt": "2026-09-07T02:30:49.567Z",
  "receiptId": "4dead634c40081b398e58d3a708e23bcc5bbd040bcce4a11fddfb3075496289d"
}
```

Full persisted `normalizedResult`:

```json
{
  "headline": "Range Pilot yield assessment: 2 Venus markets observed",
  "summary": "Range Pilot returned a real, read-only Venus BSC Mainnet yield assessment with block-pinned market evidence. No AgentHub RPC call, wallet, payment, signing, or transaction was used.",
  "fields": [
    { "key": "agent", "label": "External agent", "value": "Range Pilot · Venus Yield Lens", "source": "external" },
    { "key": "assetId", "label": "Assessment set", "value": "usd-stablecoins", "source": "input" },
    { "key": "markets", "label": "Markets returned", "value": "2", "source": "external" },
    { "key": "highestRate", "label": "Highest displayed rate", "value": "1.57209026%", "source": "external" },
    { "key": "chain", "label": "Assessment chain", "value": "BSC Mainnet (56)", "source": "external" },
    { "key": "block", "label": "Pinned block", "value": "#120,414,769", "source": "external" },
    { "key": "observedAt", "label": "Observed at", "value": "2026-09-07T02:30:49.567Z", "source": "external" },
    { "key": "receiptId", "label": "Assessment receipt", "value": "4dead634c40081b398e58d3a708e23bcc5bbd040bcce4a11fddfb3075496289d", "source": "external" }
  ],
  "tables": [
    {
      "title": "Range Pilot Venus market observations",
      "note": "Values are copied from the external block-pinned assessment. The comparison excludes incentives and is not a promise of future returns.",
      "columns": [
        { "key": "market", "label": "Market" },
        { "key": "address", "label": "vToken address" },
        { "key": "underlying", "label": "Underlying" },
        { "key": "supplyRate", "label": "Displayed supply rate" }
      ],
      "rows": [
        {
          "market": { "value": "vUSDC", "source": "external" },
          "address": { "value": "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8", "source": "external" },
          "underlying": { "value": "USDC (0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d)", "source": "external" },
          "supplyRate": { "value": "1.16991086%", "source": "external" }
        },
        {
          "market": { "value": "vUSDT", "source": "external" },
          "address": { "value": "0xfD5840Cd36d94D7229439859C0112a4185BC0255", "source": "external" },
          "underlying": { "value": "USDT (0x55d398326f99059fF775485246999027B3197955)", "source": "external" },
          "supplyRate": { "value": "1.57209026%", "source": "external" }
        }
      ]
    }
  ],
  "warnings": [
    "This is external HTTP read-only output, not a BSC RPC read or blockchain execution.",
    "Provider limitation: Incentive and reward rates are not read or included.",
    "Provider limitation: Available liquidity beyond observed contract cash is not assessed.",
    "Provider limitation: Governance and smart-contract governance risk are not assessed.",
    "Provider limitation: Supply, collateral, reward, and account eligibility are not assessed."
  ],
  "recommendation": "Read-only yield result returned. Rates are point-in-time observations, not a deposit recommendation or guaranteed return.",
  "hasSimulated": false,
  "provenance": {
    "source": "external-http",
    "transport": "external-http",
    "endpoint": "https://range-pilot-watch.onrender.com/agents/venus-yield/assess",
    "metadataUrl": "https://range-pilot-watch.onrender.com/docs/agents/venus-yield.html",
    "chainId": 56,
    "network": "BSC Mainnet",
    "blockNumber": 120414769,
    "readAt": "2026-09-07T02:30:49.567Z",
    "receiptId": "4dead634c40081b398e58d3a708e23bcc5bbd040bcce4a11fddfb3075496289d",
    "explorer": "https://bscscan.com"
  },
  "rawResponse": {
    "schemaVersion": "1.0.0",
    "agent": { "id": "venus-yield", "category": "Yield Optimisation" },
    "status": "completed",
    "chainId": 56,
    "request": { "assetId": "usd-stablecoins", "markets": ["core-vUSDC", "core-vUSDT"] },
    "assessment": {
      "markets": [
        {
          "marketId": "core-vUSDC",
          "marketSymbol": "vUSDC",
          "marketAddress": "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8",
          "vTokenDecimals": 8,
          "underlying": { "symbol": "USDC", "address": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", "decimals": 18 },
          "supplyRatePerBlockMantissa": "276621682",
          "displayedSupplyRatePercent": "1.16991086",
          "cash": { "raw": "22054010524421606650445604", "decimal": "22054010.524421606650445604" },
          "totalBorrows": { "raw": "29662240900258916260962939", "decimal": "29662240.900258916260962939" },
          "totalReserves": { "raw": "33372454881900368791", "decimal": "33.372454881900368791" }
        },
        {
          "marketId": "core-vUSDT",
          "marketSymbol": "vUSDT",
          "marketAddress": "0xfD5840Cd36d94D7229439859C0112a4185BC0255",
          "vTokenDecimals": 8,
          "underlying": { "symbol": "USDT", "address": "0x55d398326f99059fF775485246999027B3197955", "decimals": 18 },
          "supplyRatePerBlockMantissa": "370979418",
          "displayedSupplyRatePercent": "1.57209026",
          "cash": { "raw": "67594978881996201378984011", "decimal": "67594978.881996201378984011" },
          "totalBorrows": { "raw": "133709461730030787304421229", "decimal": "133709461.730030787304421229" },
          "totalReserves": { "raw": "99060148900729134983", "decimal": "99.060148900729134983" }
        }
      ],
      "highestObservedDisplayedSupplyRateAmongQueriedAllowlistedMarkets": { "marketId": "core-vUSDT", "displayedSupplyRatePercent": "1.57209026" },
      "conversionAssumptions": {
        "rateMantissaScale": "1e18",
        "blocksPerDay": 115200,
        "daysPerYear": 365,
        "formula": "daily-compounded annual display = (1 + ratePerBlock * blocksPerDay)^daysPerYear - 1",
        "comparisonBasis": "raw same-block supplyRatePerBlock mantissa; incentives excluded"
      }
    },
    "evidence": {
      "block": { "number": 120414769, "timestamp": "2026-09-07T02:30:49.000Z" },
      "contractAddresses": {
        "core-vUSDC": "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8",
        "core-vUSDT": "0xfD5840Cd36d94D7229439859C0112a4185BC0255",
        "core-vUSDC-underlying": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        "core-vUSDT-underlying": "0x55d398326f99059fF775485246999027B3197955"
      },
      "sourceLinks": [
        "https://docs.venus.io/deployed-contracts/markets",
        "https://github.com/VenusProtocol/venus-protocol/blob/develop/contracts/Tokens/VTokens/VToken.sol",
        "https://github.com/VenusProtocol/venus-protocol-documentation/blob/main/guides/protocol-math.md"
      ],
      "observedAt": "2026-09-07T02:30:49.567Z"
    },
    "unknowns": [
      "Incentive and reward rates are not read or included.",
      "Available liquidity beyond observed contract cash is not assessed.",
      "Governance and smart-contract governance risk are not assessed.",
      "Supply, collateral, reward, and account eligibility are not assessed.",
      "Future rate changes and rate persistence are unknown.",
      "Oracle state and oracle risk are not assessed.",
      "User-specific circumstances and suitability are not assessed."
    ],
    "limitations": [
      "Point-in-time, block-pinned contract state can become stale immediately after the cited block.",
      "No wallet, signing, swap, transaction, approval, execution, quote, valuation, or calldata interface is provided.",
      "The assessment makes no profitability, safety, suitability, or recommendation claim.",
      "The highlighted market is only the highest observed displayed supply rate within this request and fixed allowlist.",
      "USDC and USDT are distinct underlying assets; no peg equivalence, conversion, price, or value comparison is performed.",
      "Cash, borrows, and reserves are stored-state observations and may not include interest accrued by a later state-changing interaction."
    ],
    "observedAt": "2026-09-07T02:30:49.567Z",
    "receiptId": "4dead634c40081b398e58d3a708e23bcc5bbd040bcce4a11fddfb3075496289d"
  },
  "reads": [
    {
      "method": "HTTP POST read-only assessment",
      "target": "https://range-pilot-watch.onrender.com/agents/venus-yield/assess",
      "status": 200
    }
  ]
}
```

AgentHub quality score: **23/25**

- Correct market identification: **5/5** — two exact allowlisted market IDs, vToken addresses, and underlying addresses are returned.
- Correct/current yield data: **5/5** — rates and market state are block-pinned and include the raw mantissas, displayed values, cash, borrows, and reserves.
- Comparison breadth: **3/5** — two comparable markets were compared, not the full Venus market universe.
- Usefulness of recommendation: **5/5** — the winner, displayed rate, comparison table, and material limitations are explicit.
- Provenance/verifiability: **5/5** — chain, block timestamp, contract addresses, official source links, endpoint, and provider receipt are persisted.

### Limitations

The manual comparison covers the two core stablecoin markets surfaced by the selected provider allowlist, not every Venus market. The AgentHub result is a point-in-time external HTTP assessment; it is not a deposit recommendation, transaction, or guarantee of future yield.

## 4. Original Experiment 3 — Liquidation / Risk / Venus Borrow Buffer Watch (failed twice)

### Task

Use a real supported Venus position/market input and assess the current borrowing/liquidation buffer. Classify the risk as safe, moderate, or risky and explain why. Do not invent a wallet position.

### A. Manual baseline

- Start: `2026-09-07T00:08:11.3958729Z`
- Finish: `2026-09-07T00:11:53.7516485Z`
- Duration: `222.3557756 seconds`
- Direct monetary cost: `$0`
- Real public account input: `0x3af6cd5c74fa15c75f6770f5765f175ff61db450`
- The account was selected from a public vUSDT borrow transaction; it is not the user’s wallet and was not used to sign or broadcast anything.
- Venus Comptroller: `0xfD36E2c2a6789Db23113685031d7F16329158384`
- Venus vUSDT: `0xfD5840Cd36d94D7229439859C0112a4185BC0255`
- Latest BSC block at the read snapshot: `120395814`

Public provenance:

- [BscScan vUSDT contract/address page](https://bscscan.com/address/0xfd5840cd36d94d7229439859c0112a4185bc0255)
- [Public vUSDT borrow transaction](https://bscscan.com/tx/0x1848d5154dee2ca35927df890c9c8025f1acb54903778fd084620acae0c6035a)
- Read-only RPC: `https://bsc-dataseed.bnbchain.org`
- Borrow transaction block: `103517621`
- Borrow transaction timestamp: `2026-06-11T01:19:23Z`
- [Venus liquidation guide](https://docs-v4.venus.io/guides/liquidation)

Read-only values:

- `getAccountLiquidity` returned error `0`, positive liquidity approximately `$1.521726106791011812`, and shortfall `0`.
- `borrowBalanceStored` for vUSDT returned approximately `0.061677487077781094 USDT`.
- `getAssetsIn` returned nine entered markets, including vUSDC, vBNB, vUSDT, and six other market contracts.

Frozen manual output:

> SAFE at the captured point: Venus’s own Comptroller returned zero shortfall and approximately `$1.5217` of positive liquidity while the account had approximately `0.06168 USDT` debt. This is not a health factor and is not a stress test; the absolute remaining buffer is small, and the account has nine entered markets. The account is not shown as currently liquidatable by this read, but the position should be monitored and de-risked if liquidity erodes. This conclusion is limited to the captured block and the protocol’s returned liquidity/shortfall values.

Manual quality score: **21/25**

- Correct position/market data: **4/5** — a real public borrow transaction and fresh account reads were used, but there is no complete per-market dollar breakdown.
- Correct risk metric: **4/5** — the protocol liquidity, shortfall, debt, and entered-market count are recorded; liquidity is not mislabeled as a health factor.
- Correct liquidation interpretation: **4/5** — zero shortfall supports “not currently liquidatable by this read,” while the small absolute buffer is disclosed; this was not stress-tested.
- Actionable explanation: **4/5** — the output gives a conservative classification and monitoring/de-risking guidance.
- Provenance/verifiability: **5/5** — RPC, current block, protocol contracts, public borrow transaction, transaction block, and Venus liquidation documentation are recorded.

### B. AgentHub run

- AgentHub route: `/hire/8004-56-322090` (Venus Borrow Buffer Watch)
- The same exact public input was attempted twice after the manual baseline. Both attempts were persisted as failed executions. Venus Borrow Buffer Watch was not rerun after these two failures.
- Exact task: `Venus Borrow Buffer Watch — health factor task (public account to assess: 0x3af6…b450; warning ratio: 1.25)`
- Exact input:

  ```json
  {
    "accountAddress": "0x3af6cd5c74fa15c75f6770f5765f175ff61db450",
    "warningRatio": 1.25,
    "notes": "Use the supplied public Venus BSC Mainnet position as the real input. Assess the current borrowing/liquidation buffer, classify risk as safe, moderate, or risky, and explain the relevant metrics. Include the important risk metrics, assumptions/limitations, and provenance. Do not treat protocol liquidity as a health factor unless the agent explicitly derives one."
  }
  ```

Attempt 1:

- Execution ID: `exe_d3ac0f823141`
- Status: `failed`
- `startedAt`: `2026-09-07T02:36:32.687Z`
- `completedAt`: `2026-09-07T02:36:33.956Z`
- Measured duration: `1.269 seconds` (`durationMs: 1269`)
- Direct cost: `0` (`currency: none`)
- Network: `BSC Mainnet` / `bnb-mainnet` / chain ID `56`
- Agent endpoint: `https://range-pilot-watch.onrender.com/docs/venus-borrow-buffer.html`
- Execution protocol: `http`; payment protocol: `none`
- Warning/error: `Range Pilot returned no completed BSC Mainnet assessment.`
- `output`: `null`; `rawResult`: `null`; `normalizedResult`: `null`; `provenance`: `null`; `paymentEvidence`: `null`; `transactionHash`: empty; `rpcCallCount`: `0`; `hasSimulated`: `N/A` because no result was produced.

Attempt 2:

- Execution ID: `exe_8d3ff6855a4d`
- Status: `failed`
- `startedAt`: `2026-09-07T02:46:19.378Z`
- `completedAt`: `2026-09-07T02:46:20.954Z`
- Measured duration: `1.576 seconds` (`durationMs: 1576`)
- Direct cost: `0` (`currency: none`)
- Network: `BSC Mainnet` / `bnb-mainnet` / chain ID `56`
- Agent endpoint: `https://range-pilot-watch.onrender.com/docs/venus-borrow-buffer.html`
- Execution protocol: `http`; payment protocol: `none`
- Warning/error: `Range Pilot returned no completed BSC Mainnet assessment.`
- `output`: `null`; `rawResult`: `null`; `normalizedResult`: `null`; `provenance`: `null`; `paymentEvidence`: `null`; `transactionHash`: empty; `rpcCallCount`: `0`; `hasSimulated`: `N/A` because no result was produced.

Failure conclusion: exactly **2 attempts** are preserved. No completed agent result, risk classification, block evidence, provider receipt, or `hasSimulated` result was produced. These failures are not counted as successful AgentHub quality evidence. Older historical failures with invalid placeholder input are unrelated and are excluded from this controlled experiment.

### Limitations

The public account is a real supported input, but it is not the user’s wallet. Range Pilot returned no completed assessment twice, so no AgentHub risk classification can be scored for this original experiment. The failed result is preserved rather than replaced or hidden.

## 5. Replacement Experiment 3 — Liquidation / Risk / SMEAI Reference Health Factor Monitor

### Agent and schema inspection

- Agent: `SMEAI Reference Health Factor Monitor`
- ERC-8004 ID: `56:331625`
- AgentHub route: `/hire/8004-56-331625`
- Execution adapter: `smeai-health`
- Execution protocol: `a2a`
- Endpoint: `https://smeai-dev.vercel.app/api/a2a`
- AgentHub capability: `indexed/executable-free`; no payment was used or prepared.
- Current mapped task schema: one required field, `wallet`, rendered in the hire form as **Venus wallet**. It must be a full public BSC Mainnet address. No optional warning-ratio field is exposed for this adapter; the optional notes field was left blank.
- Adapter request shape, documented from the local adapter without invoking the endpoint: A2A `message/send` with a text payload equivalent to `{ "skill": "health_factor", "wallet": "<public BSC address>" }`.
- Adapter result contract, documented locally without invoking it: a completed A2A message whose data response includes `wallet`, numeric `block`, `weightedCollateralUsd`, `totalBorrowedUsd`, `healthFactor` (possibly null), and `liquidatable`.

### Exact replacement task

Use the real public BSC/Venus account input to assess the current Venus borrowing/liquidation buffer. Classify the risk as safe, moderate, or risky, report the authoritative Venus Comptroller liquidity and shortfall together with entered markets and relevant debt balances, and explain why. Do not invent a wallet or position, and do not call protocol liquidity a health factor unless it is explicitly derived.

### Exact real input

- Public Venus account: `0x3af6cd5c74fa15c75f6770f5765f175ff61db450`
- Why this is a real supported input: the address appears as the sender of a public Venus vUSDT borrow transaction; it is not the user’s wallet and was not used to sign or broadcast anything.
- Public transaction: [vUSDT borrow transaction](https://bscscan.com/tx/0x1848d5154dee2ca35927df890c9c8025f1acb54903778fd084620acae0c6035a)

### A. Fresh manual baseline (frozen before SMEAI invocation)

- Start: `2026-09-07T03:04:47.4109610Z`
- Finish: `2026-09-07T03:07:01.8247269Z`
- Duration: `134.4137659 seconds`
- Direct monetary cost: `$0`
- Research method: read-only public BSC Mainnet JSON-RPC calls only; no wallet, signing, payment, or transaction.
- RPC: `https://bsc-dataseed.bnbchain.org`
- Chain ID: `56` (`0x38`)
- Latest block read: `120419505` (`0x72d74b1`)
- Block timestamp: `2026-09-07T03:06:20Z`
- Block hash: `0xb54b49b2f48b80ec2b71c587980e8c0f96b06a1846d36f56fe88591e6c6f4e44`
- Comptroller: `0xfD36E2c2a6789Db23113685031d7F16329158384` (live code read returned `1508` bytes)
- Venus vUSDT: `0xfD5840Cd36d94D7229439859C0112a4185BC0255`
- `getAccountLiquidity`: error code `0`; liquidity raw `183385886883154437398837`; liquidity `183385.886883154437398837` in Venus 1e18 USD units; shortfall raw `0`; shortfall `0`.
- `getAssetsIn`: `9` entered markets.
- `getAccountSnapshot`: error code `0` for all 9 entered markets.
- Entered markets: `vUSDC` (`0xeca88125a5adbe82614ffc12d0db554e2e2867c8`), `vBNB` (`0xa07c5b74c9b40447a954e1466938b865b6bbea36`), `vFDUSD` (`0xc4ef4229fec74ccfe17b2bdef7715fac740ba0ba`), `vUSDT` (`0xfd5840cd36d94d7229439859c0112a4185bc0255`), `vTUSD` (`0xbf762cd5991ca1dcddac9ae5c638f5b5dc3bee6e`), `vDAI` (`0x334b3ecb4dca3593bccc3c7ebd1a1c1d1780fbf1`), `vU` (`0x3d5e269787d562b74acc55f18bd26c5d09fa245e`), `vUSD1` (`0x0c1da220d301155b87318b90692da8dc43b67340`), and `vBTC` (`0x882c173bc7ff3b7786ca16dfed3dfffb9ee7847b`).
- Non-zero raw `borrowBalance` values were observed in vUSDC `5980612150609239`, vBNB `120225792309065`, vFDUSD `200001582325227217391762`, vUSDT `61678407078312485`, vDAI `25096479550803514`, vU `2511142129556926`, and vBTC `4079498864342`; vTUSD and vUSD1 returned zero. These raw balances are not summed across assets without a complete decimals/price normalization.

Public sources:

- [Venus deployed Core Pool markets documentation](https://docs-v4.venus.io/deployed-contracts/markets)
- [Venus protocol math documentation](https://github.com/VenusProtocol/venus-protocol-documentation/blob/main/guides/protocol-math.md)
- [Venus liquidation guide](https://docs-v4.venus.io/guides/liquidation)
- [Venus Comptroller page on BscScan](https://bscscan.com/address/0xfd36e2c2a6789db23113685031d7f16329158384)
- [Venus vUSDT contract/address page](https://bscscan.com/address/0xfd5840cd36d94d7229439859c0112a4185bc0255)
- [Public vUSDT borrow transaction](https://bscscan.com/tx/0x1848d5154dee2ca35927df890c9c8025f1acb54903778fd084620acae0c6035a)
- Read-only RPC: `https://bsc-dataseed.bnbchain.org`

Frozen manual output:

> SAFE at BSC Mainnet block `120419505`: Venus’s own Core Pool Comptroller returned error code `0`, positive liquidity of `183385.886883154437398837` in its 1e18 USD units, and shortfall `0`. That means the protocol did not report a current liquidation shortfall for this public account at the captured read. The account has 9 entered markets, and all 9 account snapshots returned error code `0`; non-zero raw borrow balances were present in vUSDC, vBNB, vFDUSD, vUSDT, vDAI, vU, and vBTC. I do not present a health-factor ratio because this manual pass did not independently rederive weighted collateral over debt with a complete per-market oracle and liquidation-factor normalization. This is not a stress test or a safety guarantee: the account is not shown as currently liquidatable by this read, but prices, rates, oracle state, collateral eligibility, and liquidity can change. The conclusion is limited to the cited block and Venus’s returned liquidity/shortfall values.

Manual quality score: **23/25**

- Correct position/market data: **5/5** — the real public account was tied to a public Venus borrow transaction, nine entered markets were read, and all nine snapshots returned without an error.
- Correct risk metric: **5/5** — the manual answer uses Venus’s authoritative `getAccountLiquidity` liquidity/shortfall fields and explicitly does not relabel liquidity as a health factor.
- Correct liquidation interpretation: **5/5** — zero shortfall is correctly described as no current liquidation shortfall at the cited read, with no guarantee implied.
- Actionable explanation: **3/5** — it gives a conservative classification, relevant debt-market context, and monitoring caveat, but does not include a full stress test or liquidation-price analysis.
- Provenance/verifiability: **5/5** — account, public borrow transaction, RPC, chain ID, block, block hash, contracts, and official Venus documentation are recorded.

### B. SMEAI AgentHub run

- Agent: `SMEAI Reference Health Factor Monitor`
- Source: **external indexed ERC-8004 marketplace agent**
- ERC-8004 ID: `56:331625`
- Execution ID: `exe_1b9f6e2e8d78`
- Status: `completed`
- Exact persisted task: `SMEAI Reference Health Factor Monitor — health factor task (venus wallet: 0x3af6…b450)`
- Input wallet: `0x3af6cd5c74fa15c75f6770f5765f175ff61db450`, the same real public Venus account used by the frozen manual baseline.
- Submission-safety revalidation: the persisted provider-returned wallet is also `0x3af6cd5c74fa15c75f6770f5765f175ff61db450`, an exact case-insensitive match. Experiment 3 therefore remains valid and was not rerun. Current adapter code rejects a mismatch and labels the returned address as external evidence; the historical JSON below retains its original `source: input` label only to preserve the persisted record verbatim.
- `startedAt`: `2026-09-07T03:19:36.129Z`
- `completedAt`: `2026-09-07T03:19:38.926Z`
- Measured AgentHub duration: `2.797 seconds` (`durationMs: 2797`)
- Direct monetary cost: `$0`; persisted record `cost: 0`, `currency: none`; no payment or transaction hash.
- Execution protocol: `a2a`
- Payment protocol: `none`
- Agent endpoint: `https://smeai-dev.vercel.app/api/a2a`
- Network: `BSC Mainnet` / `bnb-mainnet` / chain ID `56`
- Block: `120421293`
- `executionVerified`: `false`; this was external A2A output, not an AgentHub RPC transaction.
- `hasSimulated`: `false`
- Warning: `This result came from a free external A2A service. It is not a signed action or a guarantee of future liquidation safety.`

Full persisted `rawResult`:

```json
{
  "jsonrpc": "2.0",
  "id": "agenthub-smeai-health-1788751176724",
  "result": {
    "kind": "message",
    "role": "agent",
    "parts": [
      { "kind": "text", "text": "Health factor 1.918 — collateral can fall 47.9% before liquidation." },
      {
        "kind": "data",
        "data": {
          "response": {
            "wallet": "0x3af6cd5c74fa15c75f6770f5765f175ff61db450",
            "block": "120421293",
            "weightedCollateralUsd": 383193.3511461427,
            "totalBorrowedUsd": 199807.25554721607,
            "healthFactor": 1.917814996741152,
            "bufferPct": 47.85732713013245,
            "liquidatable": false,
            "markets": [
              { "symbol": "vUSDC", "suppliedUsd": 0.05607058173220296, "borrowedUsd": 0.005979916388615565, "collateralFactor": 0.825 },
              { "symbol": "vBNB", "suppliedUsd": 1.7176292225908179, "borrowedUsd": 0.09001285048460701, "collateralFactor": 0.8 },
              { "symbol": "vFDUSD", "suppliedUsd": 0.0268178254939213, "borrowedUsd": 199806.74478375763, "collateralFactor": 0.65 },
              { "symbol": "vUSDT", "suppliedUsd": 478989.12577701145, "borrowedUsd": 0.06167042892347797, "collateralFactor": 0.8 },
              { "symbol": "vDAI", "suppliedUsd": 0.05546863068407007, "borrowedUsd": 0.025087720628475488, "collateralFactor": 0 },
              { "symbol": "vU", "suppliedUsd": 0, "borrowedUsd": 0.00250941327671298, "collateralFactor": 0.75 },
              { "symbol": "vUSD1", "suppliedUsd": 0.06608954984445618, "borrowedUsd": 0, "collateralFactor": 0.5 },
              { "symbol": "vBTC", "suppliedUsd": 0.7246082050344318, "borrowedUsd": 0.32550312871637205, "collateralFactor": 0.8 }
            ],
            "verdict": "Health factor 1.918 — collateral can fall 47.9% before liquidation."
          }
        }
      }
    ]
  }
}
```

Full persisted `normalizedResult`:

```json
{
  "headline": "Health factor 1.918 — collateral can fall 47.9% before liquidation.",
  "summary": "SMEAI Health returned a real Venus health-factor task result through A2A at BSC Mainnet block #120421293. This is external service output, not an AgentHub RPC read or transaction.",
  "fields": [
    { "key": "wallet", "label": "Wallet checked", "value": "0x3af6cd5c74fa15c75f6770f5765f175ff61db450", "source": "input" },
    { "key": "weightedCollateralUsd", "label": "Weighted collateral", "value": "$383193.3511461427", "source": "external" },
    { "key": "totalBorrowedUsd", "label": "Total borrowed", "value": "$199807.25554721607", "source": "external" },
    { "key": "healthFactor", "label": "Health factor", "value": "1.917814996741152", "source": "external" },
    { "key": "liquidatable", "label": "Liquidatable", "value": "No", "source": "external", "tone": "ok" },
    { "key": "block", "label": "BSC Mainnet block", "value": "#120,421,293", "source": "external" },
    { "key": "readAt", "label": "External read at", "value": "Returned with task", "source": "external" }
  ],
  "warnings": [
    "This result came from a free external A2A service. It is not a signed action or a guarantee of future liquidation safety."
  ],
  "recommendation": "Read-only health-factor result returned. No funds were moved, signed, or broadcast.",
  "hasSimulated": false,
  "provenance": {
    "source": "external-http-a2a",
    "transport": "external-a2a",
    "endpoint": "https://smeai-dev.vercel.app/api/a2a",
    "agentCardUrl": "https://smeai-dev.vercel.app/api/a2a",
    "chainId": 56,
    "network": "BSC Mainnet",
    "blockNumber": 120421293,
    "readAt": "2026-09-07T03:19:38.640Z",
    "explorer": "https://bscscan.com"
  },
  "rawResponse": {
    "jsonrpc": "2.0",
    "id": "agenthub-smeai-health-1788751176724",
    "result": {
      "kind": "message",
      "role": "agent",
      "parts": [
        { "kind": "text", "text": "Health factor 1.918 — collateral can fall 47.9% before liquidation." },
        {
          "kind": "data",
          "data": {
            "response": {
              "wallet": "0x3af6cd5c74fa15c75f6770f5765f175ff61db450",
              "block": "120421293",
              "weightedCollateralUsd": 383193.3511461427,
              "totalBorrowedUsd": 199807.25554721607,
              "healthFactor": 1.917814996741152,
              "bufferPct": 47.85732713013245,
              "liquidatable": false,
              "markets": [
                { "symbol": "vUSDC", "suppliedUsd": 0.05607058173220296, "borrowedUsd": 0.005979916388615565, "collateralFactor": 0.825 },
                { "symbol": "vBNB", "suppliedUsd": 1.7176292225908179, "borrowedUsd": 0.09001285048460701, "collateralFactor": 0.8 },
                { "symbol": "vFDUSD", "suppliedUsd": 0.0268178254939213, "borrowedUsd": 199806.74478375763, "collateralFactor": 0.65 },
                { "symbol": "vUSDT", "suppliedUsd": 478989.12577701145, "borrowedUsd": 0.06167042892347797, "collateralFactor": 0.8 },
                { "symbol": "vDAI", "suppliedUsd": 0.05546863068407007, "borrowedUsd": 0.025087720628475488, "collateralFactor": 0 },
                { "symbol": "vU", "suppliedUsd": 0, "borrowedUsd": 0.00250941327671298, "collateralFactor": 0.75 },
                { "symbol": "vUSD1", "suppliedUsd": 0.06608954984445618, "borrowedUsd": 0, "collateralFactor": 0.5 },
                { "symbol": "vBTC", "suppliedUsd": 0.7246082050344318, "borrowedUsd": 0.32550312871637205, "collateralFactor": 0.8 }
              ],
              "verdict": "Health factor 1.918 — collateral can fall 47.9% before liquidation."
            }
          }
        }
      ]
    }
  },
  "reads": [
    { "method": "HTTP POST message/send", "target": "https://smeai-dev.vercel.app/api/a2a", "status": 200 }
  ]
}
```

AgentHub quality score: **23/25**

- Correct position/market data: **5/5** — the real public account is identified and eight populated markets plus supplied/borrowed USD values are returned; the empty entered market is omitted from the provider payload.
- Correct risk metric: **5/5** — the result gives a numeric health factor, weighted collateral, total borrowed value, and a 47.8573% buffer.
- Correct liquidation interpretation: **5/5** — `liquidatable: false` and the 1.00 liquidation context are communicated without claiming safety or certainty.
- Actionable explanation: **4/5** — the headline gives a clear buffer, but there is no price-shock stress table or remediation scenario.
- Provenance/verifiability: **4/5** — the endpoint, wallet, BSC Mainnet chain, block, read timestamp, and explorer are recorded, but the result is external A2A output rather than a direct AgentHub RPC read or provider transaction receipt.

### Limitations

The manual baseline remains unchanged and frozen. SMEAI’s result is a point-in-time external service response at a later block than the manual snapshot; it is not a direct AgentHub RPC read, a transaction, or a guarantee of future liquidation safety. The public account is not the user’s wallet.

## 6. Supplementary Built-in Agent Benchmarks

These two runs are separate from the required core 3 external experiments. They are evidence of AgentHub’s built-in execution breadth and read-only Testnet reliability, not additional external ERC-8004 marketplace comparisons. No manual baselines were fabricated for them.

Both are real blockchain/RPC-backed read-only executions. `hasSimulated: false` means the executor did not substitute simulated chain data; it does not mean a transaction occurred.

### 6.1 Built-in Rebalancing — Rebalance Advisor

**Safety correction:** this historical persisted result is retained verbatim for auditability, but its cross-token allocation, drift, and BUY/SELL rows are invalid because heterogeneous token quantities were added without a verified common valuation. Current code no longer produces those calculations: it shows raw per-token reads and marks allocation, drift, action, and size unavailable. This supplementary run must not be cited as evidence of a working rebalance recommendation.

- Source: **Built-in / AgentHub**
- Agent: `Rebalance Advisor`
- Agent ID: `rebalance-advisor`
- Category: `portfolio`
- External ERC-8004 marketplace agent: **No**; this is `seeded/local-executable` and has no external ERC-8004 identity.
- Task: `Rebalance Advisor — portfolio task (wallet to analyse: <connected-wallet>; target allocation: WBNB 50%, BUSD 50%; report depth: full)`
- Harmless input: read-only 50% WBNB / 50% BUSD target using verified BSC Testnet token contracts `0xae13d989dac2f0debff460ac112a837c89baa7cd` (WBNB) and `0x78867bbeef44f2326bf8ddd1941a4439382ef2a7` (BUSD). No swap or transaction was requested.
- Execution ID: `exe_8ff4cf2634e3`
- `startedAt`: `2026-09-07T03:37:25.954Z`
- `completedAt`: `2026-09-07T03:37:31.770Z`
- Duration: `5.816 seconds` (`durationMs: 5816`)
- Network: **BNB Smart Chain Testnet**, chain ID `97`, `bnb-testnet`
- Legacy persisted catalogue price: `0.004 tBNB`; actual monetary cost: `$0` — no payment, signing, or transaction occurred. New free execution records persist actual cost `0` with currency `none`.
- RPC/provenance: `source: bnb-testnet-rpc`; host `bsc-testnet-dataseed.bnbchain.org`; block `129568308`; read at `2026-09-07T03:37:31.461Z`; explorer `https://testnet.bscscan.com`.
- RPC calls: `14`; transaction hash: empty; `executionVerified: false` because no transaction was submitted.
- `rawResult`: `null` (local executor output is persisted as `normalizedResult`).
- `hasSimulated`: `false`.

Historical compact result summary, derived from the persisted `normalizedResult` with table rows flattened. It is preserved as evidence of what the old code returned, not endorsed as valid rebalancing arithmetic:

```json
{
  "headline": "Rebalance analysis — 2 assets vs target",
  "summary": "Read BEP-20 balances for 2 tokens at block #129,568,308. Computed token-unit drift vs targetAllocation; no swaps executed.",
  "fields": [
    { "key": "walletBalance", "label": "Native balance", "value": "0.103595 tBNB", "source": "chain" },
    { "key": "targets", "label": "Target assets", "value": "2", "source": "input", "note": "0xae13d989dac2f0debff460ac112a837c89baa7cd:50,0x78867bbeef44f2326bf8ddd1941a4439382ef2a7:50" },
    { "key": "block", "label": "Block read", "value": "#129,568,308", "source": "chain" },
    { "key": "gasPrice", "label": "Network gas price", "value": "0.1 gwei", "source": "chain" },
    { "key": "gasPerTrade", "label": "Gas per trade", "value": "<0.0001 tBNB", "source": "derived", "note": "Real gas price × 150,000 gas" },
    { "key": "totalGas", "label": "Total gas (if all trades)", "value": "0.000030 tBNB", "source": "derived" },
    { "key": "holdingsNote", "label": "USD values", "value": "Not shown", "source": "unavailable", "note": "USD drift needs verified Venus oracle price per token; token-unit drift shown primary." }
  ],
  "holdings": [
    { "asset": "WBNB", "decimals": 18, "balanceRaw": "0", "human": "0.000000" },
    { "asset": "BUSD", "decimals": 18, "balanceRaw": "0", "human": "0.000000" }
  ],
  "plan": [
    { "asset": "WBNB", "target": "50%", "current": "0%", "drift": "-50%", "action": "BUY", "size": "0 WBNB" },
    { "asset": "BUSD", "target": "50%", "current": "0%", "drift": "-50%", "action": "BUY", "size": "0 BUSD" }
  ],
  "warnings": [],
  "recommendation": "Plan only — review drift and sizes, then execute manually if desired. Nothing was signed or broadcast.",
  "hasSimulated": false,
  "provenance": {
    "source": "bnb-testnet-rpc",
    "rpcHost": "bsc-testnet-dataseed.bnbchain.org",
    "chainId": 97,
    "blockNumber": 129568308,
    "readAt": "2026-09-07T03:37:31.461Z",
    "explorer": "https://testnet.bscscan.com"
  }
}
```

Invalidation: although the underlying raw balance reads remain historical RPC evidence, token quantities from different assets are not a common unit. The displayed percentages, drift, BUY action, and sizes above are therefore invalid and are no longer generated. No swap or rebalancing transaction occurred.

### 6.2 Built-in Health Factor — Venus Health Guardian

- Source: **Built-in / AgentHub**
- Agent: `Venus Health Guardian`
- Agent ID: `venus-health-guardian`
- Category: `health-factor`
- External ERC-8004 marketplace agent: **No**; this is `seeded/local-executable` and reads the verified Venus Core Pool deployment on Testnet.
- Task: `Venus Health Guardian — health-factor task (wallet holding the position: <connected-wallet>; lending protocol: Venus; warning threshold: 1.5)`
- Harmless input: the same connected public wallet identity, Venus Core Pool, warning threshold `1.5`; read-only assessment only.
- Execution ID: `exe_1de4dcc3d4b8`
- `startedAt`: `2026-09-07T03:37:33.016Z`
- `completedAt`: `2026-09-07T03:37:36.906Z`
- Duration: `3.890 seconds` (`durationMs: 3890`)
- Network: **BNB Smart Chain Testnet**, chain ID `97`, `bnb-testnet`
- Legacy persisted catalogue price: `0.004 tBNB`; actual monetary cost: `$0` — no payment, signing, or transaction occurred. New free execution records persist actual cost `0` with currency `none`.
- RPC/provenance: `source: bnb-testnet-rpc`; host `bsc-testnet-dataseed.bnbchain.org`; block `129568322`; read at `2026-09-07T03:37:36.588Z`; Venus Comptroller `0x94d1820b2D1c7c7452A163983Dc888CEC546b77D`; explorer `https://testnet.bscscan.com`.
- RPC calls: `8`; transaction hash: empty; `executionVerified: false` because no transaction was submitted.
- `rawResult`: `null` (local executor output is persisted as `normalizedResult`).
- `hasSimulated`: `false`.

Compact result summary, derived from the persisted `normalizedResult`:

```json
{
  "headline": "No Venus position found for this wallet",
  "summary": "Venus's Comptroller was asked which markets this wallet has entered, live at block #129,568,322. The answer was none — so there is no collateral and no debt here, and nothing that can be liquidated.",
  "fields": [
    { "key": "risk", "label": "Risk level", "value": "NO POSITION", "source": "chain", "tone": "ok", "note": "Venus's own account market list for this wallet is empty." },
    { "key": "healthFactor", "label": "Health factor", "value": "Not applicable", "source": "unavailable", "note": "This wallet has not entered any Venus Core Pool market on BNB testnet, so it has no collateral or debt here and nothing to liquidate." },
    { "key": "marketsEntered", "label": "Venus markets entered", "value": "0", "source": "chain", "note": "Read with getAssetsIn(). Only entered markets count as collateral or debt." },
    { "key": "protocol", "label": "Protocol read", "value": "Venus Core Pool", "source": "input", "note": "Comptroller 0x94d1820b2D1c7c7452A163983Dc888CEC546b77D — address from Venus's official deployment docs, confirmed live this run." },
    { "key": "walletBalance", "label": "Wallet native balance", "value": "0.1036 tBNB", "source": "chain", "note": "What this wallet could use to top up collateral or repay a borrow." },
    { "key": "block", "label": "Block read", "value": "#129,568,322", "source": "chain" },
    { "key": "gasPrice", "label": "Network gas price", "value": "0.1 gwei", "source": "chain" }
  ],
  "recommendation": "Nothing to protect yet. Supply an asset to Venus on BNB testnet and enter that market, then re-run this agent to get a real health factor. If you expected a position here, check the address: this reads Venus Core Pool on chain 97 only, so a position on another protocol, another Venus pool, or mainnet will not appear.",
  "hasSimulated": false,
  "provenance": {
    "source": "bnb-testnet-rpc",
    "rpcHost": "bsc-testnet-dataseed.bnbchain.org",
    "chainId": 97,
    "blockNumber": 129568322,
    "readAt": "2026-09-07T03:37:36.588Z",
    "explorer": "https://testnet.bscscan.com"
  }
}
```

Limitations: this run found no Venus Core Pool position for the connected wallet on Testnet, so a health factor is correctly marked not applicable. The executor reads chain 97 only; a Mainnet or other-pool position would not appear. No funds were moved and no transaction was prepared.

Network separation: the official core experiments above are external indexed ERC-8004 marketplace agents running against BSC Mainnet evidence where applicable. These supplemental AgentHub agents are built-in/local executors using BNB Smart Chain Testnet chain `97`. The built-in agents are not presented as external ERC-8004 agents.

## 7. Summary comparison

| Task | Agent | Source | Backend processing | Timed manual baseline | Agent cost | Manual cost | Agent quality | Manual quality |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Trading grid | Assay Grid | External indexed ERC-8004 | 1.733 s | 27.658 s | $0 | $0 | 23/25 | 20/25 |
| Yield ranking | Venus Yield Lens | External indexed ERC-8004 | 2.221 s | 29.617391 s | $0 | $0 | 23/25 | 20/25 |
| Borrow/liquidation risk | SMEAI Reference Health Factor Monitor | External indexed ERC-8004 | 2.797 s | 134.4137659 s | $0 | $0 | 23/25 | 23/25 |

These are the official 3 external experiments. The AgentHub figure is the persisted backend execution duration (`completedAt - startedAt`), not an operator stopwatch. Full agent-operator timing was not recorded, so the manual/backend ratios are processing-time comparisons only and are not end-to-end workflow or hiring speedups. The two failed Venus Borrow Buffer attempts remain preserved in Section 4 and are not silently substituted into this core table.

Supplementary built-in summary:

| Built-in agent | Category | Network | Duration | Cost | hasSimulated |
|---|---|---|---:|---|---|
| Rebalance Advisor | Token holdings / allocation unavailable | BNB Smart Chain Testnet (97) | 5.816 s | Legacy 0.004 tBNB catalogue price; $0 actual | false |
| Venus Health Guardian | Health Factor | BNB Smart Chain Testnet (97) | 3.890 s | Legacy 0.004 tBNB catalogue price; $0 actual | false |

## 8. Raw execution IDs

- Experiment 1 Assay Grid: `exe_4d0467889b4b`
- Experiment 2 Venus Yield Lens: `exe_ddef9d991d35`
- Replacement Experiment 3 SMEAI Health Factor: `exe_1b9f6e2e8d78`
- Original Experiment 3 Borrow Buffer attempt 1: `exe_d3ac0f823141` (failed)
- Original Experiment 3 Borrow Buffer attempt 2: `exe_8d3ff6855a4d` (failed)
- Supplementary built-in Rebalance Advisor: `exe_8ff4cf2634e3`
- Supplementary built-in Venus Health Guardian: `exe_1de4dcc3d4b8`

Relevant non-execution provenance:

- Experiment 1 pool-created block: `26970848`
- Experiment 1 AgentHub result block: `120414021`; external read timestamp `2026-09-07T02:25:12.841Z`
- Experiment 2 AgentHub result block: `120414769`; provider receipt `4dead634c40081b398e58d3a708e23bcc5bbd040bcce4a11fddfb3075496289d`
- Original Experiment 3 manual block: `120395814`
- Replacement Experiment 3 manual block: `120419505`; block hash `0xb54b49b2f48b80ec2b71c587980e8c0f96b06a1846d36f56fe88591e6c6f4e44`
- Supplementary Rebalance Advisor Testnet block: `129568308`
- Supplementary Venus Health Guardian Testnet block: `129568322`; Comptroller `0x94d1820b2D1c7c7452A163983Dc888CEC546b77D`
- Public borrow transaction block: `103517621`
- Experiment 3 public borrow transaction: `0x1848d5154dee2ca35927df890c9c8025f1acb54903778fd084620acae0c6035a`

## 9. Failed attempts and disclosed limitations

- The two current Venus Borrow Buffer failures are documented in Section 4 with exact execution IDs, timestamps, input, error, and null result fields. No third attempt was made.
- The replacement SMEAI task completed successfully as `exe_1b9f6e2e8d78`; its full raw and normalized results are documented in Section 5.
- The two built-in supplementary runs completed on Testnet and are documented separately in Section 6; neither is an external ERC-8004 marketplace agent.
- The three completed external AgentHub runs were free read-only HTTP/A2A tasks. Their `cost: 0`/`currency: none` records did not require payment.
- A public BSC log query returned a provider `limit exceeded` response during the original research. The public position was still verified through the public borrow transaction receipt and direct read-only contract calls.
- One late read/parsing attempt encountered a transient DNS failure. It did not change the already captured manual values.
- No wallet transaction was prepared, signed, or sent; no payment was made; and no private key or secret was used. The built-in runs used the existing persisted wallet identity only as a read target and hire owner.

## 10. Evidence integrity statement

No simulated data, invented durations, invented costs, invented positions, fabricated execution IDs, or fabricated agent outputs are included. The three completed external AgentHub result payloads and the two built-in result payloads are copied from persisted records. AgentHub fields are marked `N/A` where a failed execution produced no result. Frozen manual baselines were not revised using AgentHub output.
