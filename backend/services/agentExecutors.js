/**
 * What an agent actually DOES when it runs.
 *
 * One executor per agent category. Every executor returns the same output
 * contract, and every value in it is tagged with where it came from:
 *
 *   chain       — read live from BNB testnet this run. A fact.
 *   derived     — arithmetic on chain reads. A fact, plus stated assumptions.
 *   input       — echoed back from what the user configured.
 *   simulated   — MODELLED. Not on-chain. Always rendered with a label.
 *   unavailable — we could get this, but not honestly, so we didn't.
 *
 * That per-field tagging is the point. A page-level "some data is simulated"
 * disclaimer lets a reader assume the number they care about is the real one, so
 * the label travels with each individual value instead.
 *
 * No executor writes to the chain, signs anything, or spends anything.
 */
import {
  buildProvenance,
  estimateFee,
  ethCall,
  readAddressState,
  readContractInfo,
} from './blockchainService.js';
import { positionRiskLevel, readLendingPosition } from './lendingProtocolAdapter.js';
import {
  SELECTORS,
  decodeAddressArray,
  decodeString,
  decodeWords,
  encodeAddress,
  scaledToDecimalString,
  toUint,
} from './abi.js';
import { VENUS_CORE_POOL, readUnderlyingPrice } from './venusAdapter.js';

export const SOURCES = {
  chain: 'chain',
  derived: 'derived',
  input: 'input',
  simulated: 'simulated',
  unavailable: 'unavailable',
};

/** One row of a result. `value` is display-ready so the UI never re-formats. */
function field(key, label, value, opts = {}) {
  return { key, label, value, source: SOURCES.chain, ...opts };
}

/**
 * One cell of a table. `value` is display-ready. String shorthand is allowed and
 * implies source:'chain' — the common case for an address or symbol that is a
 * straight chain read. Use the object form when you need a different provenance,
 * tone or note.
 */
export function cell(value, opts = {}) {
  return { value: String(value), source: SOURCES.chain, ...opts };
}
function cellSource(c) {
  if (c == null) return null;
  if (typeof c === 'string') return SOURCES.chain;
  return c.source;
}

const CURRENCY = 'tBNB';

/** Trim a balance to something readable without implying false precision. */
function bnb(decimalString, places = 4) {
  const n = Number(decimalString);
  if (!Number.isFinite(n)) return `${decimalString} ${CURRENCY}`;
  if (n === 0) return `0 ${CURRENCY}`;
  if (n < 0.0001) return `<0.0001 ${CURRENCY}`;
  return `${n.toFixed(places).replace(/\.?0+$/, '')} ${CURRENCY}`;
}

const pct = (n) => `${Number(n).toFixed(2).replace(/\.?0+$/, '')}%`;

/** Gas units for a typical BEP-20 → BEP-20 swap. An assumption, labelled as one. */
const SWAP_GAS_UNITS = 150_000;
/** Gas units for a plain native transfer. Fixed by the protocol, not a guess. */
const TRANSFER_GAS_UNITS = 21_000;

/**
 * Shared opening rows: what network we read, and when. Every result carries these
 * so any number below them can be re-checked at that exact block.
 */
function networkFields(chain) {
  return [
    field('block', 'Block read', `#${chain.blockNumber.toLocaleString('en-US')}`),
    field('gasPrice', 'Network gas price', `${chain.gasPriceGwei} gwei`),
  ];
}

/* ------------------------------------------------------------------ *
 * monitoring — watch a wallet or token and alert on movement
 * ------------------------------------------------------------------ */
async function runMonitoring({ input, chain }) {
  const target = input.watchTarget;
  const state = await readAddressState(target);
  const code = await readContractInfo(target);
  const threshold = Number(input.changeThreshold ?? 10);
  const absoluteMove = (Number(state.balance) * threshold) / 100;

  return {
    headline: code.isContract
      ? `Contract baseline captured at block #${chain.blockNumber.toLocaleString('en-US')}`
      : `Wallet holds ${bnb(state.balance)} at block #${chain.blockNumber.toLocaleString('en-US')}`,
    summary:
      `Read the live state of ${target} on BNB Smart Chain Testnet and stored it as ` +
      `the baseline this agent will compare future checks against.`,
    fields: [
      field('type', 'Address type', code.isContract ? 'Contract' : 'Wallet (no code)', {
        tone: 'info',
      }),
      field('balance', 'Native balance', bnb(state.balance), { tone: 'ok' }),
      field('sent', 'Transactions sent', state.transactionsSent.toLocaleString('en-US'), {
        note: 'Account nonce — outgoing transactions only, not transfers received.',
      }),
      ...networkFields(chain),
      field(
        'trigger',
        'Alert threshold',
        `${pct(threshold)} (${bnb(absoluteMove)} from this baseline)`,
        { source: SOURCES.derived, note: 'Calculated from the balance read above.' },
      ),
      field('frequency', 'Requested check frequency', String(input.frequency || '1h'), {
        source: SOURCES.input,
        note: 'No background scheduler runs in this MVP — re-run the agent to take a new reading.',
      }),
    ],
    recommendation: state.isEmpty
      ? 'This address has never transacted and holds nothing. Confirm it is the address you meant to watch.'
      : `Baseline stored. Re-run this agent to compare against ${bnb(state.balance)} at block #${chain.blockNumber.toLocaleString('en-US')}.`,
  };
}

/* ------------------------------------------------------------------ *
 * portfolio — read what an address holds, or rebalance analysis if targetAllocation given
 * Rebalancing is read-only: parse "0xToken:60,0xOther:40" (weights sum 100), verify
 * contracts, read BEP-20 balances/decimals/symbols, compute current % vs target drift
 * and BUY/SELL sizes in token units (USD secondary caveated). No swaps executed.
 * ------------------------------------------------------------------ */
function parseAllocationString(raw) {
  const s = String(raw || '').trim();
  if (!s) return { ok: false, reason: 'Target allocation is empty.' };
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { ok: false, reason: 'Provide at least 2 assets, e.g. 0xTokenA:60,0xTokenB:40' };
  if (parts.length > 8) return { ok: false, reason: 'At most 8 assets allowed.' };
  const out = [];
  let sum = 0;
  for (const p of parts) {
    const [addrRaw, weightRaw] = p.split(':').map((x) => x.trim());
    if (!addrRaw || !weightRaw) return { ok: false, reason: `Bad entry "${p}" — use 0xAddress:weight` };
    if (!/^0x[a-fA-F0-9]{40}$/.test(addrRaw)) return { ok: false, reason: `Invalid address "${addrRaw}"` };
    const w = Number(weightRaw);
    if (!Number.isFinite(w) || w <= 0 || w > 100) return { ok: false, reason: `Weight "${weightRaw}" for ${addrRaw.slice(0,6)}… must be 0-100` };
    sum += w;
    out.push({ address: addrRaw, weight: w });
  }
  if (Math.abs(sum - 100) > 0.01) return { ok: false, reason: `Weights sum to ${sum} — must be 100` };
  return { ok: true, items: out };
}

async function runPortfolio({ input, chain }) {
  const target = input.walletAddress;
  const state = await readAddressState(target);
  const full = input.reportDepth === 'full';
  const allocationRaw = input.targetAllocation != null ? String(input.targetAllocation).trim() : '';
  const isRebalance = allocationRaw !== '';

  // --- Rebalancing path ---
  if (isRebalance) {
    const parsed = parseAllocationString(allocationRaw);
    const fieldsBase = [
      field('wallet', 'Wallet', `${target.slice(0,6)}…${target.slice(-4)}`, { source: SOURCES.input }),
      field('balance', 'Native balance', bnb(state.balance, 6)),
      ...networkFields(chain),
    ];
    if (!parsed.ok) {
      return {
        headline: 'Rebalance input invalid',
        summary: parsed.reason,
        fields: [...fieldsBase, field('parse', 'Allocation parse', 'Failed', { source: SOURCES.derived, tone: 'bad', note: parsed.reason })],
        warnings: [],
        recommendation: `Fix targetAllocation: e.g. "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd:60,0x337...:40" (weights sum 100). Nothing was signed or sent.`,
      };
    }
    const targets = parsed.items; // [{address, weight}]
    // verify contracts and read balances/decimals/symbols
    const holdings = [];
    const warnings = [];
    for (const t of targets) {
      const code = await readContractInfo(t.address);
      if (!code.isContract) {
        holdings.push({ address: t.address, symbol: t.address.slice(0,6)+'…', decimals: 18, balance: 0n, human: 0, isContract: false, note: 'No contract code — cannot be a token' });
        warnings.push(`No code at ${t.address.slice(0,10)}… — treated as 0 balance`);
        continue;
      }
      let decimals = 18;
      let symbol = t.address.slice(0,6)+'…';
      let balance = 0n;
      try {
        const rawDec = await ethCall(t.address, SELECTORS.decimals);
        decimals = Number(toUint(decodeWords(rawDec, 1)[0]));
      } catch {}
      try {
        const s = await ethCall(t.address, SELECTORS.symbol).then((r)=> decodeString(r)).catch(()=>null);
        if (s) symbol = s;
      } catch {}
      try {
        const rawBal = await ethCall(t.address, SELECTORS.balanceOf + encodeAddress(target));
        const w = decodeWords(rawBal, 1);
        balance = toUint(w[0]);
        // extra zero words from delegator proxies already handled by strict decoder requiring extras zero — but balanceOf via vToken returns 3 words, so above would throw. Fall back: try decoding first word only via manual slice
      } catch (e) {
        // delegator proxy returns 3 words for balanceOf — try tolerant decode: take first word
        try {
          const rawBal2 = await ethCall(t.address, SELECTORS.balanceOf + encodeAddress(target));
          const hex = rawBal2.replace(/^0x/,'');
          const first = hex.slice(0,64);
          balance = BigInt('0x'+first);
        } catch {
          warnings.push(`Balance read failed for ${symbol} (${t.address.slice(0,10)}…)`);
          balance = 0n;
        }
      }
      const human = Number(balance) / Math.pow(10, decimals);
      holdings.push({ address: t.address, symbol, decimals, balance, human, isContract: true, targetWeight: t.weight });
    }
    const totalHuman = holdings.reduce((s,h)=> s + (Number.isFinite(h.human)? h.human:0), 0);
    const rows = [];
    for (const h of holdings) {
      const currentPct = totalHuman > 0 ? (h.human / totalHuman * 100) : 0;
      const drift = currentPct - h.targetWeight;
      let action = 'HOLD';
      let tone = 'info';
      if (drift < -0.5) { action = 'BUY'; tone = 'ok'; }
      else if (drift > 0.5) { action = 'SELL'; tone = 'bad'; }
      const sizeHuman = (h.targetWeight/100 * totalHuman - h.human);
      const sizeStr = (Math.abs(sizeHuman) < 0.0001 ? '0' : Math.abs(sizeHuman).toFixed(4)) + ' ' + h.symbol;
      rows.push({
        asset: { value: h.symbol, source: SOURCES.chain, note: h.address },
        targetPct: { value: pct(h.targetWeight), source: SOURCES.input },
        currentPct: { value: pct(currentPct), source: SOURCES.derived, note: h.isContract ? `Balance ${h.balance.toString()} / 10^${h.decimals}` : h.note },
        drift: { value: (drift>0?'+':'')+pct(drift), source: SOURCES.derived, tone: Math.abs(drift)<0.5 ? 'info' : (drift>0?'bad':'ok') },
        action: { value: action, source: SOURCES.derived, tone },
        size: { value: sizeStr, source: SOURCES.derived, note: action==='HOLD' ? 'Within 0.5% tolerance' : `${action} to reach target` },
      });
    }
    const table = {
      title: 'Rebalance plan (token units, plan-only)',
      note: 'Token-unit drift primary; USD secondary omitted (needs verified price). No swaps executed.',
      columns: [
        { key: 'asset', label: 'Asset' },
        { key: 'targetPct', label: 'Target' },
        { key: 'currentPct', label: 'Current' },
        { key: 'drift', label: 'Drift' },
        { key: 'action', label: 'Action' },
        { key: 'size', label: 'Size' },
      ],
      rows,
    };
    const holdingsTable = {
      title: 'Holdings read (chain)',
      columns: [
        { key: 'asset', label: 'Asset' },
        { key: 'decimals', label: 'Decimals' },
        { key: 'balance', label: 'Balance (raw)' },
        { key: 'human', label: 'Human' },
      ],
      rows: holdings.map((h)=> ({
        asset: { value: h.symbol, source: SOURCES.chain },
        decimals: { value: String(h.decimals), source: SOURCES.chain },
        balance: { value: h.balance.toString(), source: SOURCES.chain },
        human: { value: h.human.toFixed(6), source: SOURCES.derived },
      })),
    };
    const gasPer = estimateFee({ gasPriceWei: chain.gasPriceWei, gasUnits: SWAP_GAS_UNITS });
    const totalGas = (Number(gasPer.fee) * rows.filter(r=>r.action.value!=='HOLD').length).toFixed(6);
    return {
      headline: `Rebalance analysis — ${holdings.length} assets vs target`,
      summary: `Read BEP-20 balances for ${holdings.length} tokens at block #${chain.blockNumber.toLocaleString('en-US')}. Computed token-unit drift vs targetAllocation; no swaps executed.`,
      fields: [
        field('walletBalance', 'Native balance', bnb(state.balance, 6)),
        field('targets', 'Target assets', String(holdings.length), { source: SOURCES.input, note: allocationRaw }),
        ...networkFields(chain),
        field('gasPerTrade', 'Gas per trade', bnb(gasPer.fee,6), { source: SOURCES.derived, note: `Real gas price × ${SWAP_GAS_UNITS.toLocaleString('en-US')} gas` }),
        field('totalGas', 'Total gas (if all trades)', `${totalGas} tBNB`, { source: SOURCES.derived }),
        field('holdingsNote', 'USD values', 'Not shown', { source: SOURCES.unavailable, note: 'USD drift needs verified Venus oracle price per token; token-unit drift shown primary.' }),
      ],
      tables: [holdingsTable, table],
      warnings,
      recommendation: 'Plan only — review drift and sizes, then execute manually if desired. Nothing was signed or broadcast.',
    };
  }

  // --- Original portfolio path (no targetAllocation) ---
  const transferFee = estimateFee({
    gasPriceWei: chain.gasPriceWei,
    gasUnits: TRANSFER_GAS_UNITS,
  });
  const fundableTransfers =
    Number(transferFee.fee) > 0 ? Math.floor(Number(state.balance) / Number(transferFee.fee)) : 0;

  const fields = [
    field('balance', 'Native balance', bnb(state.balance, 6), { tone: 'ok' }),
    field('sent', 'Transactions sent', state.transactionsSent.toLocaleString('en-US')),
    ...networkFields(chain),
    field(
      'tokens',
      'BEP-20 token positions',
      'Not included',
      {
        source: SOURCES.unavailable,
        note:
          'Listing token balances needs a verified testnet token registry or an indexer, ' +
          'neither of which is configured. Inventing holdings would be worse than omitting them.',
      },
    ),
    field('gasRunway', 'Transfers this balance can fund', `${fundableTransfers.toLocaleString('en-US')}`, {
      source: SOURCES.derived,
      note: `At ${chain.gasPriceGwei} gwei and ${TRANSFER_GAS_UNITS.toLocaleString('en-US')} gas per transfer (${bnb(transferFee.fee, 6)} each).`,
    }),
  ];

  if (full) {
    fields.push(
      field('balanceWei', 'Exact balance (wei)', state.balanceWei, {
        note: 'Full precision, straight from eth_getBalance.',
      }),
      field('activity', 'Account state', state.isEmpty ? 'Never used' : 'Active', {
        source: SOURCES.derived,
        note: 'Derived from balance and nonce. First-seen date needs an indexer.',
      }),
    );
  }

  return {
    headline: `${bnb(state.balance)} held across 1 tracked asset`,
    summary:
      `Read ${target} at block #${chain.blockNumber.toLocaleString('en-US')}. Native tBNB is ` +
      `read directly from the chain; token positions are outside what this build can verify.`,
    fields,
    recommendation: state.isEmpty
      ? 'Nothing to report — this address holds no tBNB and has never sent a transaction. Fund it from the BNB testnet faucet to see a fuller report.'
      : `Native holdings confirmed on-chain. For a complete picture, token balances need a verified registry — see the note above.`,
  };
}

/* ------------------------------------------------------------------ *
 * health-factor — liquidation risk on a lending position
 * ------------------------------------------------------------------ */

/**
 * Carried by every USD figure that came through Venus's price oracle.
 *
 * The testnet oracle is a real contract returning real values, but it quotes BNB
 * at $600 and BTC at $2,100,000. So the numbers below are honest chain reads of a
 * test feed, and each one says so on its own row rather than relying on a single
 * disclaimer the reader may not connect to the figure they care about.
 */
const TESTNET_PRICE_NOTE = 'Testnet oracle price, not a market price.';

/**
 * USD from a decimal STRING, unrounded.
 *
 * A string in, not a Number: a 1e18-scaled USD value exceeds
 * Number.MAX_SAFE_INTEGER, so the adapter formats it in BigInt and hands over the
 * exact decimal. Rounding here would turn an input to the health factor into an
 * approximation — a real testnet position can be worth $3.54. Cents are kept
 * below $1,000 and dropped above it, where they are noise.
 */
function usd(decimalString) {
  const n = Number(decimalString);
  if (!Number.isFinite(n)) return `$${decimalString}`;
  return n >= 1000
    ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${n.toFixed(2)}`;
}

/** Which provenance tag a risk level earns, based on who actually decided it. */
const RISK_SOURCE = {
  protocol: SOURCES.chain,
  derived: SOURCES.derived,
  none: SOURCES.unavailable,
};

async function runHealthFactor({ input, chain, agent }) {
  const target = input.positionWallet;
  // The form offers only protocols the agent advertises, but a hire can be posted
  // straight at the API, so fall back to what the agent itself claims rather than
  // assuming Venus.
  const protocol = input.protocol || agent?.protocols?.[0] || 'the selected protocol';
  const warnBelowRaw = Number(input.warnBelow);
  const warnBelow = Number.isFinite(warnBelowRaw) ? warnBelowRaw : 1.5;

  const [state, lending] = await Promise.all([
    readAddressState(target),
    readLendingPosition({ address: target, protocol }),
  ]);

  const walletField = field('walletBalance', 'Wallet native balance', bnb(state.balance), {
    note: 'What this wallet could use to top up collateral or repay a borrow.',
  });

  /* --- The protocol cannot be read at all ------------------------------- */
  // Not a failure: a definite answer about what we do and do not have on file.
  // The alternative — reading a guessed contract address — is how you report a
  // stranger's position as the user's own.
  if (!lending.supported) {
    return {
      headline: `${protocol} positions cannot be read — no verified deployment on file`,
      summary:
        `The wallet itself was read live on BNB testnet at block ` +
        `#${chain.blockNumber.toLocaleString('en-US')}. The ${protocol} position was not, ` +
        `because AgentHub has no verified ${protocol} contract address for this chain and ` +
        `will not guess one.`,
      fields: [
        field('protocol', 'Protocol requested', protocol, { source: SOURCES.input }),
        field('healthFactor', 'Health factor', 'Not available', {
          source: SOURCES.unavailable,
          note: lending.reason,
        }),
        field('risk', 'Risk level', 'Unknown', { source: SOURCES.unavailable }),
        walletField,
        ...networkFields(chain),
      ],
      recommendation:
        `No position was invented for ${protocol}. To see a real, reconciled health factor, ` +
        `run a Venus Core Pool agent against a wallet that has supplied collateral on Venus ` +
        `BNB testnet.`,
    };
  }

  const position = lending.position;
  const risk = positionRiskLevel(position);
  const protocolLabel = `${position.protocol} ${position.pool}`;
  const protocolField = field('protocol', 'Protocol read', protocolLabel, {
    source: SOURCES.input,
    note: `Comptroller ${position.comptroller} — address from Venus's official deployment docs, confirmed live this run.`,
  });

  /* --- Supported, but this wallet has no position ----------------------- */
  // A first-class outcome. Venus's own account market list is empty, which is a
  // read result, not an error and not a position full of zeroes.
  if (!position.hasPosition) {
    return {
      headline: `No Venus position found for this wallet`,
      summary:
        `Venus's Comptroller was asked which markets this wallet has entered, live at block ` +
        `#${chain.blockNumber.toLocaleString('en-US')}. The answer was none — so there is no ` +
        `collateral and no debt here, and nothing that can be liquidated.`,
      fields: [
        field('risk', 'Risk level', risk.level, {
          tone: risk.tone,
          note: "Venus's own account market list for this wallet is empty.",
        }),
        field('healthFactor', 'Health factor', 'Not applicable', {
          source: SOURCES.unavailable,
          note: position.healthFactorUnavailableReason,
        }),
        field('marketsEntered', 'Venus markets entered', '0', {
          note: 'Read with getAssetsIn(). Only entered markets count as collateral or debt.',
        }),
        protocolField,
        walletField,
        ...networkFields(chain),
      ],
      recommendation:
        `Nothing to protect yet. Supply an asset to Venus on BNB testnet and enter that market, ` +
        `then re-run this agent to get a real health factor. If you expected a position here, ` +
        `check the address: this reads Venus Core Pool on chain 97 only, so a position on ` +
        `another protocol, another Venus pool, or mainnet will not appear.`,
    };
  }

  /* --- A real position ------------------------------------------------- */
  const hf = typeof position.healthFactor === 'number' ? position.healthFactor.toFixed(2) : null;
  const breached = hf !== null && position.healthFactor < warnBelow;
  const liquidatable = position.venus.liquidatable;
  // Venus's liquidity/shortfall pair is only meaningful when the Comptroller
  // reports errorCode 0. On a non-zero code the adapter already withholds
  // everything derived, but the raw pair still comes back — and quoting it as a
  // [chain] fact would be the worst possible version of this row: a real number,
  // read from the real contract, that the contract itself is disclaiming.
  const venusVerdictUsable = position.venus.errorCode === 0;

  const fields = [
    field('risk', 'Risk level', risk.level, {
      source: RISK_SOURCE[risk.basis] || SOURCES.unavailable,
      tone: risk.tone,
      note:
        risk.basis === 'protocol'
          ? "Venus's own getAccountLiquidity() decided this — the protocol's verdict, not our arithmetic."
          : risk.basis === 'derived'
            ? 'Banded from the health factor below. 1.00 is the liquidation point, so these bands measure distance from it.'
            : 'Neither Venus nor our own arithmetic could produce a risk level for this position.',
    }),
    hf !== null
      ? field('healthFactor', 'Health factor', hf, {
          source: SOURCES.derived,
          tone: risk.tone,
          note:
            `Liquidation-weighted collateral ÷ debt, from per-market reads, cross-checked to the ` +
            `wei against Venus's own liquidity figure. Venus liquidates at 1.00. ${TESTNET_PRICE_NOTE}`,
        })
      : field('healthFactor', 'Health factor', 'Not available', {
          source: SOURCES.unavailable,
          note: position.healthFactorUnavailableReason,
        }),
    venusVerdictUsable
      ? field(
          'venusLiquidity',
          liquidatable ? 'Venus shortfall (liquidatable now)' : 'Venus liquidity buffer',
          usd(liquidatable ? position.venus.shortfallUsd : position.venus.liquidityUsd),
          {
            note: liquidatable
              ? `Venus reports a NON-ZERO SHORTFALL, which means this account can be liquidated right now. ` +
                `This is the Comptroller's own figure. ${TESTNET_PRICE_NOTE}`
              : `How much collateral value could still be borrowed against, or lost, before Venus ` +
                `would allow a liquidation. The Comptroller's own figure. ${TESTNET_PRICE_NOTE}`,
          },
        )
      : field('venusLiquidity', "Venus's own verdict", 'Not usable', {
          source: SOURCES.unavailable,
          note:
            `The Comptroller returned error code ${position.venus.errorCode} for this account, so it ` +
            `is disclaiming its own liquidity and shortfall figures. They are not shown, because a ` +
            `number the contract will not stand behind is worse than no number on a liquidation screen.`,
        }),
    field('marketsEntered', 'Venus markets entered', String(position.marketsEntered), {
      note: position.truncated
        ? `Read with getAssetsIn(). Only the first ${position.marketsAnalysed} were valued this run — see the health-factor note.`
        : 'Read with getAssetsIn(). Only entered markets count as collateral or debt.',
    }),
  ];

  // Per-market rows. Every market that failed appears, because a failure is the
  // thing most worth seeing; markets with no balance are counted instead of
  // listed, so an entered-but-empty market doesn't bury the ones that matter.
  let emptyMarkets = 0;
  for (const market of position.markets) {
    const label = market.symbol || `${market.vToken.slice(0, 8)}…${market.vToken.slice(-4)}`;
    if (!market.available) {
      fields.push(
        field(`market-${market.vToken}`, `${label} market`, 'Could not be valued', {
          source: SOURCES.unavailable,
          note: `${market.reason} This market is therefore excluded from the totals below, which is why no health factor is derived.`,
        }),
      );
      continue;
    }
    if (Number(market.suppliedUsd) === 0 && Number(market.borrowedUsd) === 0) {
      emptyMarkets += 1;
      continue;
    }
    fields.push(
      field(
        `market-${market.vToken}`,
        `${label} position`,
        `${usd(market.suppliedUsd)} supplied · ${usd(market.borrowedUsd)} borrowed`,
        {
          source: SOURCES.derived,
          // A borrow-only market has no collateral to weight, and quoting its
          // weight next to "$0.00 counts as collateral" reads like a mistake
          // rather than a fact. Debt counts in full, which is the useful thing to
          // say about that row.
          note:
            Number(market.suppliedUsd) === 0
              ? `Borrowed only — no collateral supplied in this market, and debt counts against you in full. ${TESTNET_PRICE_NOTE}`
              : `Liquidation weight ${market.liquidationFactor} → ${usd(market.weightedCollateralUsd)} ` +
                `of this counts toward avoiding liquidation. ${TESTNET_PRICE_NOTE}`,
        },
      ),
    );
  }
  if (emptyMarkets > 0) {
    fields.push(
      field(
        'emptyMarkets',
        'Entered markets with no balance',
        String(emptyMarkets),
        {
          source: SOURCES.derived,
          note: 'Entered but holding nothing supplied or borrowed, so they contribute nothing either way.',
        },
      ),
    );
  }

  if (position.totals) {
    // WHY THESE ROWS NEED A PARTIAL LABEL: when a market could not be valued, the
    // sums cover only the markets that WERE valued, so they understate the
    // position. Unlabelled, they are the most misleading rows on the page — a
    // reader seeing "$0.00 counts as collateral" beside "$1.26 borrowed" would
    // conclude liquidation is imminent, while Venus's own figure on the row above
    // reports a healthy buffer. A number that is quietly partial is worse here
    // than no number, so the label says so and the value carries a warning tone.
    const partial = position.reconciliation?.complete === false;
    const suffix = partial ? ' (valued markets only)' : '';
    const gap = partial
      ? " This EXCLUDES the market(s) above that could not be valued, so it understates the real position — Venus's own liquidity figure is the complete one."
      : '';
    const partialTone = partial ? { tone: 'warn' } : {};
    fields.push(
      field('supplied', `Total supplied${suffix}`, usd(position.totals.suppliedUsd), {
        source: SOURCES.derived,
        ...partialTone,
        note: `Market value of everything supplied, before liquidation weights.${gap} ${TESTNET_PRICE_NOTE}`,
      }),
      field(
        'collateral',
        `Counts as collateral${suffix}`,
        usd(position.totals.weightedCollateralUsd),
        {
          source: SOURCES.derived,
          ...partialTone,
          note: `Each market's supply after its liquidation weight — the figure Venus compares against your debt.${gap} ${TESTNET_PRICE_NOTE}`,
        },
      ),
      field('borrow', `Total borrowed${suffix}`, usd(position.totals.borrowedUsd), {
        source: SOURCES.derived,
        ...partialTone,
        note: `Debt across every valued market.${gap} ${TESTNET_PRICE_NOTE}`,
      }),
    );
  }

  if (position.reconciliation) {
    const recon = position.reconciliation;
    fields.push(
      field(
        'reconciliation',
        'Cross-check against Venus',
        !recon.matches
          ? `Mismatch — off by ${recon.deltaWei} wei`
          : recon.complete
            ? 'Exact match'
            : 'Matches, but the market set is incomplete',
        {
          source: SOURCES.derived,
          tone: recon.reconciled ? 'ok' : 'warn',
          note:
            `${recon.explanation} Ours: ${usd(recon.computedLiquidityUsd)}. ` +
            `Venus: ${usd(recon.protocolLiquidityUsd)}.`,
        },
      ),
    );
  }

  if (position.oracle) {
    fields.push(
      field('oracle', 'Price oracle used', `${position.oracle.slice(0, 10)}…${position.oracle.slice(-6)}`, {
        note: "Read from the Comptroller's oracle() this run, never hardcoded, so an oracle migration cannot leave this agent quoting a dead contract.",
      }),
    );
  }

  fields.push(protocolField, walletField, ...networkFields(chain));

  fields.push(
    hf !== null
      ? field(
          'threshold',
          'Your warning threshold',
          `${warnBelow} — ${breached ? 'BREACHED' : 'not breached'}`,
          { source: SOURCES.derived, tone: breached ? 'bad' : 'ok' },
        )
      : field('threshold', 'Your warning threshold', `${warnBelow} — not evaluated`, {
          source: SOURCES.unavailable,
          note: 'There is no health factor to compare it against this run.',
        }),
  );

  const headline = liquidatable
    ? `LIQUIDATABLE NOW — Venus reports a ${usd(position.venus.shortfallUsd)} shortfall`
    : hf !== null
      ? `Health factor ${hf} — ${risk.level} risk`
      : `Venus position found — health factor unavailable`;

  const recommendation = liquidatable
    ? `Venus's Comptroller reports a shortfall of ${usd(position.venus.shortfallUsd)} for this ` +
      `account, which means it can be liquidated right now — this is the protocol's own figure, not ` +
      `our estimate. Repaying part of the borrow or supplying more collateral is what clears a ` +
      `shortfall. AgentHub cannot do either: it holds no keys and sends no transactions.`
    : hf === null
      ? // Deliberately does NOT restate healthFactorUnavailableReason — that is
        // already the note on the "Health factor" row, and repeating it here made
        // the two read like a stutter. What belongs here instead is what the user
        // should act on: the protocol's own verdict, when it is usable.
        venusVerdictUsable
        ? `Go by Venus's own verdict on the row above: ${usd(position.venus.liquidityUsd)} of ` +
          `liquidity and no shortfall, so Venus would not allow a liquidation at this block. The ` +
          `derived health factor is withheld for the reason given on its row — this agent reports a ` +
          `liquidation ratio only when it can be reconciled against Venus to the wei. Nothing was ` +
          `signed or sent; this run was read-only.`
        : `Neither Venus's own liquidity verdict nor a derived health factor is usable for this ` +
          `account this run, so this agent is not telling you how close to liquidation you are — ` +
          `checking the position directly on Venus is the reliable move. Nothing was signed or sent.`
      : breached
        ? `The health factor (${hf}) is below your ${warnBelow} threshold. Adding collateral or ` +
          `repaying part of the borrow is what raises it; liquidation becomes possible at 1.00. ` +
          `Nothing was signed or sent — this run was read-only.`
        : `The health factor (${hf}) sits above your ${warnBelow} threshold, with ` +
          `${usd(position.venus.liquidityUsd)} of liquidity left before Venus would allow a ` +
          `liquidation. No action needed at block #${chain.blockNumber.toLocaleString('en-US')}.`;

  return {
    headline,
    summary:
      `Venus Core Pool was read live on BNB testnet at block ` +
      `#${chain.blockNumber.toLocaleString('en-US')}: the markets this wallet entered, its balance ` +
      `and debt in each, each market's liquidation weight, and the Comptroller's own liquidity ` +
      `verdict. ${
        hf !== null
          ? "The health factor is our arithmetic on those reads, and it is only shown because re-deriving Venus's own liquidity figure from them matched exactly."
          : 'No health factor is shown this run — the reason is on that row.'
      }`,
    fields,
    recommendation,
  };
}

/* ------------------------------------------------------------------ *
 * research — due diligence on a token or contract
 * ------------------------------------------------------------------ */
async function runResearch({ input, chain }) {
  const target = input.tokenAddress;
  const depth = input.depth || 'standard';
  const [code, state] = await Promise.all([readContractInfo(target), readAddressState(target)]);

  // The most valuable finding here is real: an address given as a token that has
  // no bytecode cannot be a token.
  const flags = [];
  if (!code.isContract) {
    flags.push('No contract code at this address — it cannot be a token contract.');
  } else if (code.bytecodeBytes < 500) {
    flags.push(`Unusually small contract (${code.bytecodeBytes} bytes) — likely a proxy or a minimal stub.`);
  }

  const fields = [
    field('isContract', 'Contract deployed here', code.isContract ? 'Yes' : 'No', {
      tone: code.isContract ? 'ok' : 'bad',
      note: 'Read with eth_getCode — a definitive answer, not an estimate.',
    }),
    field(
      'size',
      'Bytecode size',
      code.isContract ? `${code.bytecodeBytes.toLocaleString('en-US')} bytes` : '0 bytes',
      { note: 'Rough proxy for complexity.' },
    ),
    field('held', 'Native balance at address', bnb(state.balance)),
    ...networkFields(chain),
  ];

  if (depth !== 'quick') {
    fields.push(
      field('holders', 'Holder distribution', 'Not available', {
        source: SOURCES.unavailable,
        note: 'Requires a token indexer to enumerate holders. Not configured.',
      }),
      field('liquidity', 'Liquidity depth', 'Not available', {
        source: SOURCES.unavailable,
        note: 'Requires DEX pair data for a verified router. Not configured.',
      }),
    );
  }
  if (depth === 'deep') {
    fields.push(
      field('audit', 'Audit status', 'Unknown — no audit registry queried', {
        source: SOURCES.unavailable,
      }),
      field('ownership', 'Ownership / admin keys', 'Not inspected', {
        source: SOURCES.unavailable,
        note: 'Would need the contract ABI to call owner()/admin(). Not attempted without a verified ABI.',
      }),
    );
  }

  return {
    headline: code.isContract
      ? `Contract confirmed at ${target.slice(0, 6)}…${target.slice(-4)} (${code.bytecodeBytes.toLocaleString('en-US')} bytes)`
      : `No contract at ${target.slice(0, 6)}…${target.slice(-4)}`,
    summary:
      `Inspected ${target} directly on BNB testnet at block #${chain.blockNumber.toLocaleString('en-US')}. ` +
      `What could be verified on-chain is marked as such; what needs an indexer is marked unavailable rather than filled in.`,
    fields,
    recommendation:
      flags.length > 0
        ? flags.join(' ')
        : 'Contract exists and looks structurally ordinary. Deeper checks (holders, liquidity, admin keys) need data sources this build does not have.',
  };
}

/* ------------------------------------------------------------------ *
 * trading — plan a trade or grid (never submits one)
 * Grid is plan-only under the existing `trading` category. If grid fields are
 * present (lowerBound/upperBound/gridLevels) the executor produces a ladder;
 * otherwise it falls back to the original DCA affordability plan (backward compat).
 * ------------------------------------------------------------------ */
async function getVenusPriceForToken(tokenAddress) {
  try {
    const rawMarkets = await ethCall(VENUS_CORE_POOL.comptroller, SELECTORS.getAllMarkets);
    const allMarkets = decodeAddressArray(rawMarkets);
    const capped = allMarkets.slice(0, 12);
    let oracle = null;
    try {
      const rawOracle = await ethCall(VENUS_CORE_POOL.comptroller, SELECTORS.oracle);
      const addr = decodeWords(rawOracle, 1)[0].slice(24);
      oracle = '0x' + addr;
    } catch {
      return null;
    }
    for (const vToken of capped) {
      let underlying = null;
      try {
        const rawU = await ethCall(vToken, SELECTORS.underlying);
        underlying = '0x' + decodeWords(rawU, 1)[0].slice(24);
      } catch {
        continue; // vBNB reverts, skip
      }
      if (underlying.toLowerCase() !== String(tokenAddress).toLowerCase()) continue;
      const priceWei = await readUnderlyingPrice(oracle, vToken);
      if (priceWei != null) {
        let uDec = 18;
        try {
          const rawDec = await ethCall(tokenAddress, SELECTORS.decimals);
          uDec = Number(toUint(decodeWords(rawDec, 1)[0]));
        } catch {}
        const realUsd = scaledToDecimalString(priceWei, 36 - uDec, 4);
        return { price: realUsd, oracle, vToken, uDec };
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function runTrading({ input, chain, userAddress }) {
  const isGrid = input.lowerBound != null || input.upperBound != null || input.gridLevels != null || input.capitalPerLevel != null;
  if (isGrid) {
    const target = input.tokenAddress;
    const lower = Number(input.lowerBound);
    const upper = Number(input.upperBound);
    const levels = Number(input.gridLevels);
    const capitalPerLevel = Number(input.capitalPerLevel);
    const refInput = input.referencePrice != null && String(input.referencePrice).trim() !== '' ? Number(input.referencePrice) : null;

    const [code, wallet] = await Promise.all([readContractInfo(target), readAddressState(userAddress)]);
    const warnings = [];
    const fields = [];
    fields.push(field('token', 'Target token is a contract', code.isContract ? 'Yes' : 'No', { tone: code.isContract ? 'ok' : 'bad', note: code.isContract ? 'Verified with eth_getCode.' : 'No code at this address — it cannot be traded as a token.' }));
    fields.push(field('walletBalance', 'Your balance', bnb(wallet.balance)));
    fields.push(field('lowerBound', 'Lower bound', String(lower), { source: SOURCES.input }));
    fields.push(field('upperBound', 'Upper bound', String(upper), { source: SOURCES.input }));
    fields.push(field('levels', 'Levels', String(levels), { source: SOURCES.input }));
    fields.push(field('capitalPerLevel', 'Capital per level', bnb(String(capitalPerLevel)), { source: SOURCES.input }));
    if (refInput != null) fields.push(field('refPriceInput', 'Reference price (input)', String(refInput), { source: SOURCES.input }));
    fields.push(...networkFields(chain));

    // validation
    const errs = [];
    if (!Number.isFinite(lower) || lower <= 0) errs.push('lowerBound must be > 0');
    if (!Number.isFinite(upper) || upper <= 0) errs.push('upperBound must be > 0');
    if (Number.isFinite(lower) && Number.isFinite(upper) && upper <= lower) errs.push('upperBound must be > lowerBound');
    if (!Number.isInteger(levels) || levels < 2 || levels > 50) errs.push('gridLevels must be integer 2..50');
    if (!Number.isFinite(capitalPerLevel) || capitalPerLevel <= 0) errs.push('capitalPerLevel must be > 0');
    if (refInput != null && (!Number.isFinite(refInput) || refInput <= 0)) errs.push('referencePrice must be > 0');
    if (errs.length) {
      return {
        headline: 'Grid inputs invalid',
        summary: errs.join('; '),
        fields: [...fields, field('validation', 'Validation', 'Failed', { source: SOURCES.derived, tone: 'bad', note: errs.join('; ') })],
        warnings: [],
        recommendation: 'Fix the grid bounds and levels, then re-run. Nothing was signed or sent.',
      };
    }

    // reference price resolve
    let refPrice = refInput;
    let refSource = refInput != null ? SOURCES.input : SOURCES.unavailable;
    let refNote = refInput != null ? 'Provided by you.' : 'No reference price provided.';
    let refOracle = null;
    if (refPrice == null) {
      try {
        const venusPrice = await getVenusPriceForToken(target);
        if (venusPrice && venusPrice.price) {
          refPrice = Number(venusPrice.price);
          refSource = SOURCES.chain;
          refNote = `Venus oracle ${venusPrice.oracle.slice(0,10)}… (vToken ${venusPrice.vToken.slice(0,6)}…). ${TESTNET_PRICE_NOTE}`;
          refOracle = venusPrice.oracle;
        } else {
          warnings.push('No Venus oracle price for this token — reference price unavailable. Provide one as input.');
        }
      } catch (e) {
        warnings.push(`Venus price lookup failed: ${e.message}`);
      }
    }
    if (refPrice == null) {
      fields.push(field('referencePrice', 'Reference price', 'Not available', { source: SOURCES.unavailable, note: 'Provide a reference price input, or use a Venus-listed underlying.' }));
    } else {
      fields.push(field('referencePrice', 'Reference price', String(refPrice), { source: refSource, note: refNote }));
      if (refSource === SOURCES.chain) fields.push(field('priceSource', 'Price source', 'Venus oracle (chain)', { source: SOURCES.derived, note: refNote }));
      else fields.push(field('priceSource', 'Price source', 'Your input', { source: SOURCES.input }));
      if (refPrice < lower || refPrice > upper) warnings.push(`Reference price ${refPrice} is outside [${lower}, ${upper}] — grid will be one-sided.`);
    }

    const spacing = levels > 1 ? (upper - lower) / (levels - 1) : 0;
    fields.push(field('spacing', 'Level spacing', spacing.toFixed(4), { source: SOURCES.derived, note: `(${(upper)} - ${(lower)}) / ${(levels-1)}` }));
    const gasPerOrder = estimateFee({ gasPriceWei: chain.gasPriceWei, gasUnits: SWAP_GAS_UNITS });
    const totalGas = (Number(gasPerOrder.fee) * levels).toFixed(6);
    fields.push(field('gasPerOrder', 'Gas per order', bnb(gasPerOrder.fee, 6), { source: SOURCES.derived, note: `Real gas price × ${SWAP_GAS_UNITS.toLocaleString('en-US')} gas (assumption)` }));
    fields.push(field('totalGas', 'Total gas (all levels)', `${totalGas} tBNB`, { source: SOURCES.derived, note: `${levels} × gas per order` }));
    const totalCapital = capitalPerLevel * levels;
    fields.push(field('totalCapital', 'Total capital', bnb(String(totalCapital)), { source: SOURCES.derived, note: `${capitalPerLevel} × ${levels} levels` }));
    const affordable = Number(wallet.balance) >= totalCapital + Number(totalGas);
    fields.push(field('affordable', 'Balance covers grid', affordable ? 'Yes' : 'No', { source: SOURCES.derived, tone: affordable ? 'ok' : 'bad', note: `Needs ~${bnb(String(totalCapital + Number(totalGas)),6)} inc. gas` }));

    const rows = [];
    for (let i = 0; i < levels; i++) {
      const price = Number((lower + i * spacing).toFixed(4));
      let side = '—';
      let sideTone = undefined;
      if (refPrice != null) {
        if (price < refPrice) { side = 'BUY'; sideTone = 'ok'; }
        else if (price > refPrice) { side = 'SELL'; sideTone = 'bad'; }
        else { side = 'AT REF'; sideTone = 'warn'; }
      } else {
        side = 'UNKNOWN (no ref)';
        sideTone = 'warn';
      }
      rows.push({
        level: { value: String(i + 1), source: SOURCES.derived },
        price: { value: String(price), source: SOURCES.derived },
        side: { value: side, source: refPrice != null ? SOURCES.derived : SOURCES.unavailable, tone: sideTone },
        size: { value: bnb(String(capitalPerLevel), 4), source: SOURCES.input },
      });
    }

    const table = {
      title: 'Grid ladder (plan-only)',
      note: 'Plan only — no orders placed, signed or broadcast. Re-run to refresh at a new block.',
      columns: [
        { key: 'level', label: 'Level' },
        { key: 'price', label: 'Price' },
        { key: 'side', label: 'Side' },
        { key: 'size', label: 'Size' },
      ],
      rows,
    };

    return {
      headline: code.isContract ? `Grid plan — ${levels} levels from ${lower} to ${upper}` : `No contract at ${target.slice(0,6)}…`,
      summary: `Grid ladder computed from your bounds/levels at block #${chain.blockNumber.toLocaleString('en-US')}. Reference price labelled by source; no DEX pair or order execution involved.`,
      fields,
      tables: [table],
      warnings,
      recommendation: !code.isContract ? 'Stop: no contract at token address.' : affordable ? 'Grid plan ready — nothing was signed or sent. Review levels and place orders manually if desired.' : `Insufficient balance for grid (needs ~${bnb(String(totalCapital + Number(totalGas)),6)}). Top up or reduce capital/levels.`,
    };
  }

  // --- original DCA path (backward compat) ---
  const target = input.tokenAddress;
  const amount = Number(input.amountPerTrade ?? 0);
  const slippage = Number(input.maxSlippage ?? 0.5);
  const [code, wallet] = await Promise.all([
    readContractInfo(target),
    readAddressState(userAddress),
  ]);

  const swapFee = estimateFee({ gasPriceWei: chain.gasPriceWei, gasUnits: SWAP_GAS_UNITS });
  const needed = amount + Number(swapFee.fee);
  const affordable = Number(wallet.balance) >= needed;

  return {
    headline: affordable
      ? `Trade plan ready — ${bnb(String(amount))} per ${input.schedule || 'once'} execution`
      : `Insufficient balance for this plan`,
    summary:
      `Checked the target token and your wallet on BNB testnet at block ` +
      `#${chain.blockNumber.toLocaleString('en-US')}. Nothing was submitted, signed or spent.`,
    fields: [
      field('token', 'Target token is a contract', code.isContract ? 'Yes' : 'No', {
        tone: code.isContract ? 'ok' : 'bad',
        note: code.isContract
          ? 'Verified with eth_getCode.'
          : 'No code at this address — it cannot be traded as a token.',
      }),
      field('walletBalance', 'Your balance', bnb(wallet.balance)),
      field('amount', 'Amount per trade', bnb(String(amount)), { source: SOURCES.input }),
      field('schedule', 'Schedule', String(input.schedule || 'once'), { source: SOURCES.input }),
      field('slippage', 'Max slippage', pct(slippage), { source: SOURCES.input }),
      ...networkFields(chain),
      field('gasCost', 'Estimated gas per swap', bnb(swapFee.fee, 6), {
        source: SOURCES.derived,
        note: `Real gas price × an assumed ${SWAP_GAS_UNITS.toLocaleString('en-US')} gas for a swap. The price is measured; the gas units are an assumption.`,
      }),
      field('affordable', 'Balance covers first trade', affordable ? 'Yes' : 'No', {
        source: SOURCES.derived,
        tone: affordable ? 'ok' : 'bad',
        note: `Needs ${bnb(String(needed), 6)} including estimated gas.`,
      }),
      field('route', 'Best route', 'Not computed', {
        source: SOURCES.unavailable,
        note: 'Routing needs a verified DEX router address and pair reserves. Not configured, and not guessed.',
      }),
    ],
    recommendation: !code.isContract
      ? 'Stop: there is no contract at the token address you gave, so this plan cannot be executed. Check the address.'
      : affordable
        ? `Plan is viable at current gas. Executing it would require a signed transaction — AgentHub does not submit trades, so nothing has been sent.`
        : `Your wallet holds ${bnb(wallet.balance)} but this plan needs about ${bnb(String(needed), 6)} per trade including gas. Top up from the testnet faucet or reduce the trade size.`,
  };
}

/* ------------------------------------------------------------------ *
 * yield — where to allocate (real Venus testnet ranking, plan-only)
 * ------------------------------------------------------------------ */
const BLOCKS_PER_YEAR = 10_512_000; // BSC ~3s blocks; assumption stated, APY is derived
const YIELD_MARKETS_CAP = 12;

function aprFromRate(rateWei) {
  // rate is 1e18 scaled per block → APR % = rate * blocksPerYear * 100 / 1e18
  try {
    const aprWei = (BigInt(rateWei) * BigInt(BLOCKS_PER_YEAR) * 100n);
    return scaledToDecimalString(aprWei, 18, 2) + '%';
  } catch {
    return '—';
  }
}
function aprValueForSort(rateWei) {
  try {
    // sort key as number percent (not string)
    return Number(scaledToDecimalString(BigInt(rateWei) * BigInt(BLOCKS_PER_YEAR) * 100n, 18, 6));
  } catch {
    return -1;
  }
}

async function runYield({ input, chain, userAddress }) {
  const amount = Number(input.allocationAmount ?? 0);
  const risk = input.riskLevel || 'balanced';
  const minApy = input.minApy == null ? null : Number(input.minApy);
  const wallet = await readAddressState(userAddress);

  const entryFee = estimateFee({ gasPriceWei: chain.gasPriceWei, gasUnits: SWAP_GAS_UNITS });
  const funded = Number(wallet.balance) >= amount;

  // --- Real Venus market ranking ---
  let rankedRows = [];
  let marketsConsidered = 0;
  let marketsDropped = 0;
  let totalMarkets = 0;
  let warnings = [];
  let tableNote = `Supply APY derived from on-chain supplyRatePerBlock × ${BLOCKS_PER_YEAR.toLocaleString('en-US')} blocks/year (BSC ~3s assumption). ${TESTNET_PRICE_NOTE} Not a market-price yield.`;

  try {
    const rawMarkets = await ethCall(VENUS_CORE_POOL.comptroller, SELECTORS.getAllMarkets);
    const allMarkets = decodeAddressArray(rawMarkets);
    totalMarkets = allMarkets.length;
    const capped = allMarkets.slice(0, YIELD_MARKETS_CAP);
    marketsDropped = Math.max(0, totalMarkets - capped.length);
    if (marketsDropped > 0) warnings.push(`Showing ${capped.length} of ${totalMarkets} Venus Core Pool markets (cap ${YIELD_MARKETS_CAP}); ${marketsDropped} dropped.`);
    if (minApy != null) warnings.push(`Filtered by minimum ${pct(minApy)} — markets below that are omitted.`);

    const perMarket = [];
    for (const vToken of capped) {
      try {
        const [symRaw, supRaw, borRaw] = await Promise.all([
          ethCall(vToken, SELECTORS.symbol).then((r) => decodeString(r)).catch(() => null),
          ethCall(vToken, SELECTORS.supplyRatePerBlock).then((r) => toUint(decodeWords(r, 1)[0])).catch(() => null),
          ethCall(vToken, SELECTORS.borrowRatePerBlock).then((r) => toUint(decodeWords(r, 1)[0])).catch(() => null),
        ]);
        if (supRaw == null || borRaw == null) {
          perMarket.push({ vToken, symbol: symRaw || `${vToken.slice(0, 6)}…`, available: false, reason: 'Could not read on-chain rates for this market.' });
          continue;
        }
        const supplyApr = aprFromRate(supRaw);
        const borrowApr = aprFromRate(borRaw);
        const supplyVal = aprValueForSort(supRaw);
        if (minApy != null && supplyVal < minApy) continue;
        perMarket.push({
          vToken,
          symbol: symRaw || `${vToken.slice(0, 6)}…`,
          available: true,
          supplyApr,
          borrowApr,
          supplyVal,
        });
      } catch {
        perMarket.push({ vToken, symbol: `${vToken.slice(0, 6)}…`, available: false, reason: 'Market read failed.' });
      }
    }
    // rank by supply APY desc
    perMarket.sort((a, b) => {
      if (!a.available && b.available) return 1;
      if (a.available && !b.available) return -1;
      if (!a.available && !b.available) return 0;
      return (b.supplyVal ?? -1) - (a.supplyVal ?? -1);
    });
    // take top 8 for table brevity, but keep warning counts honest
    const top = perMarket.slice(0, 8);
    marketsConsidered = perMarket.length;
    if (perMarket.length > top.length) {
      warnings.push(`Ranked ${perMarket.length} markets, showing top ${top.length} by supply APY.`);
    }
    rankedRows = top.map((m) => {
      if (!m.available) {
        return {
          market: { value: m.symbol, source: SOURCES.unavailable, note: m.reason },
          supplyApy: { value: '—', source: SOURCES.unavailable },
          borrowApy: { value: '—', source: SOURCES.unavailable },
          note: { value: 'Unavailable', source: SOURCES.unavailable },
        };
      }
      return {
        market: { value: m.symbol, source: SOURCES.chain },
        supplyApy: { value: m.supplyApr, source: SOURCES.derived, note: `supplyRatePerBlock on-chain × ${BLOCKS_PER_YEAR.toLocaleString('en-US')} blocks/year` },
        borrowApy: { value: m.borrowApr, source: SOURCES.derived },
        note: { value: 'Ranked by supply APY', source: SOURCES.derived },
      };
    });
    if (rankedRows.length === 0) warnings.push('No markets met the filter — try lowering the minimum APY.');
  } catch (err) {
    warnings.push(`Venus market list could not be read: ${err.message}`);
  }

  const rankedTable = {
    title: 'Ranked Venus markets by supply APY (BNB testnet)',
    note: tableNote,
    columns: [
      { key: 'market', label: 'Market' },
      { key: 'supplyApy', label: 'Supply APY' },
      { key: 'borrowApy', label: 'Borrow APY' },
      { key: 'note', label: 'Note' },
    ],
    rows: rankedRows,
    emptyNote: 'No ranked markets available.',
  };

  const headline = funded
    ? `Allocation of ${bnb(String(amount))} is fundable — ${rankedRows.length} Venus markets ranked`
    : `Wallet holds ${bnb(wallet.balance)} — short of the ${bnb(String(amount))} requested`;

  const fields = [
    field('walletBalance', 'Your balance', bnb(wallet.balance), { tone: funded ? 'ok' : 'warn' }),
    field('requested', 'Amount to allocate', bnb(String(amount)), { source: SOURCES.input }),
    field('risk', 'Risk level', risk, { source: SOURCES.input }),
    field('minApy', 'Minimum net APY', minApy == null ? 'No minimum' : pct(minApy), { source: SOURCES.input }),
    field('marketsConsidered', 'Markets considered', String(marketsConsidered), { source: SOURCES.derived, note: `Of ${totalMarkets} Venus Core Pool markets; ${marketsDropped} dropped by cap.` }),
    ...networkFields(chain),
    field('entryCost', 'Estimated cost to enter a pool', bnb(entryFee.fee, 6), {
      source: SOURCES.derived,
      note: `Real gas price × an assumed ${SWAP_GAS_UNITS.toLocaleString('en-US')} gas for a deposit.`,
    }),
    field('funded', 'Allocation is fundable now', funded ? 'Yes' : 'No', { source: SOURCES.derived, tone: funded ? 'ok' : 'bad' }),
    field('apyAssumption', 'APY assumption', `${BLOCKS_PER_YEAR.toLocaleString('en-US')} blocks/year at ~3s`, { source: SOURCES.derived, note: 'APY = supplyRatePerBlock × blocksPerYear. A different block time changes the APY; this assumption is stated so you can re-derive.' }),
  ];

  return {
    headline,
    summary:
      `Your wallet and live Venus Core Pool rates were read at block #${chain.blockNumber.toLocaleString('en-US')}. ` +
      `Supply/borrow rates are on-chain per-block values; APYs are derived with the stated blocks/year assumption and ranked by supply APY.`,
    fields,
    tables: [rankedTable],
    warnings,
    recommendation: funded
      ? `Top market ${rankedRows[0]?.market?.value || '—'} at ${rankedRows[0]?.supplyApy?.value || '—'} supply APY (see table). This is a read-only ranking on BNB testnet, not a deposit; nothing was signed or sent.`
      : `Top up to at least ${bnb(String(amount + Number(entryFee.fee)), 6)} (allocation plus estimated gas) before allocating. The BNB testnet faucet issues free tBNB.`,
  };
}

const EXECUTORS = {
  monitoring: runMonitoring,
  portfolio: runPortfolio,
  'health-factor': runHealthFactor,
  research: runResearch,
  trading: runTrading,
  yield: runYield,
};

/**
 * Address-shaped inputs, by category. Checked before any RPC call.
 *
 * Category-specific field *rules* live in the frontend (see lib/hire.js), but the
 * runner cannot trust that: a hire can be created straight against the API. Left
 * unchecked, a malformed address reaches the node and comes back as
 * "hex string has length 18, want 40 for common.Address" — accurate, useless, and
 * only after a wasted round trip. So the shape is checked here, where a clear
 * message can be produced instantly.
 */
const ADDRESS_INPUTS = {
  monitoring: [{ key: 'watchTarget', label: 'wallet or token to watch' }],
  portfolio: [{ key: 'walletAddress', label: 'wallet to analyse' }],
  'health-factor': [{ key: 'positionWallet', label: 'wallet holding the position' }],
  research: [{ key: 'tokenAddress', label: 'token or contract address' }],
  trading: [{ key: 'tokenAddress', label: 'token to trade' }],
  yield: [],
};

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * A task that cannot run as configured. Carries a message written for the person
 * who filled in the form, so the runner can show it verbatim.
 */
export class TaskInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TaskInputError';
  }
}

/**
 * Throws a message meant for a human if the task can't be run as configured.
 * Presence and shape only — whether an address is *the right* address is the
 * user's call, not ours.
 */
export function assertRunnableInput(agent, input = {}) {
  for (const { key, label } of ADDRESS_INPUTS[agent.category] || []) {
    const value = input[key];
    if (value == null || String(value).trim() === '') {
      throw new TaskInputError(
        `This task is missing the ${label}, so there is nothing to look up.`,
      );
    }
    if (!ADDRESS_RE.test(String(value).trim())) {
      throw new TaskInputError(
        `The ${label} ("${String(value).slice(0, 24)}") is not a valid address. ` +
          'It must be 0x followed by 40 hex characters.',
      );
    }
  }
}

/**
 * Run the executor for an agent's category.
 *
 * An unknown category is an error rather than a generic fallback: a result that
 * doesn't correspond to what the agent claims to do would be worse than a
 * visible failure.
 */
export async function executeForAgent({ agent, execution, chain }) {
  const executor = EXECUTORS[agent.category];
  if (!executor) {
    throw new Error(`No executor is implemented for the "${agent.category}" category.`);
  }
  assertRunnableInput(agent, execution.input || {});

  const result = await executor({
    input: execution.input || {},
    chain,
    userAddress: execution.userAddress,
    agent,
  });

  const hasSimulated =
    result.fields.some((f) => f.source === SOURCES.simulated) ||
    (Array.isArray(result.tables) &&
      result.tables.some(
        (t) =>
          Array.isArray(t.rows) &&
          t.rows.some((row) => Object.values(row).some((c) => cellSource(c) === SOURCES.simulated)),
      ));
  return {
    ...result,
    hasSimulated,
    provenance: buildProvenance(chain),
    // `reads` is deliberately NOT set here. The list of RPC requests is measured
    // by the log in blockchainService.js and attached by the runner, so it
    // reflects what was actually issued rather than what an executor believes it
    // issued. See withRpcLog().
  };
}
