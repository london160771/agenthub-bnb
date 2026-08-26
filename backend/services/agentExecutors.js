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
  readAddressState,
  readContractInfo,
} from './blockchainService.js';
import { positionRiskLevel, readLendingPosition } from './lendingProtocolAdapter.js';

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
 * portfolio — read what an address holds
 * ------------------------------------------------------------------ */
async function runPortfolio({ input, chain }) {
  const target = input.walletAddress;
  const state = await readAddressState(target);
  const full = input.reportDepth === 'full';

  // Genuinely derived: how many plain transfers this balance could still pay for
  // at the gas price we just read. Real numbers, stated assumption.
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
 * trading — plan a trade (never submits one)
 * ------------------------------------------------------------------ */
async function runTrading({ input, chain, userAddress }) {
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
 * yield — where to allocate
 * ------------------------------------------------------------------ */
async function runYield({ input, chain, userAddress }) {
  const amount = Number(input.allocationAmount ?? 0);
  const risk = input.riskLevel || 'balanced';
  const minApy = input.minApy == null ? null : Number(input.minApy);
  const wallet = await readAddressState(userAddress);

  const entryFee = estimateFee({ gasPriceWei: chain.gasPriceWei, gasUnits: SWAP_GAS_UNITS });
  const funded = Number(wallet.balance) >= amount;

  return {
    headline: funded
      ? `Allocation of ${bnb(String(amount))} is fundable`
      : `Wallet holds ${bnb(wallet.balance)} — short of the ${bnb(String(amount))} requested`,
    summary:
      `Your wallet and live network costs were read at block #${chain.blockNumber.toLocaleString('en-US')}. ` +
      `Pool yields are not read from any protocol — see below.`,
    fields: [
      field('walletBalance', 'Your balance', bnb(wallet.balance), { tone: funded ? 'ok' : 'warn' }),
      field('requested', 'Amount to allocate', bnb(String(amount)), { source: SOURCES.input }),
      field('risk', 'Risk level', risk, { source: SOURCES.input }),
      field('minApy', 'Minimum net APY', minApy == null ? 'No minimum' : pct(minApy), {
        source: SOURCES.input,
      }),
      ...networkFields(chain),
      field('entryCost', 'Estimated cost to enter a pool', bnb(entryFee.fee, 6), {
        source: SOURCES.derived,
        note: `Real gas price × an assumed ${SWAP_GAS_UNITS.toLocaleString('en-US')} gas for a deposit.`,
      }),
      field('funded', 'Allocation is fundable now', funded ? 'Yes' : 'No', {
        source: SOURCES.derived,
        tone: funded ? 'ok' : 'bad',
      }),
      field('pools', 'Ranked pool candidates', 'Not available', {
        source: SOURCES.unavailable,
        note:
          'Ranking pools needs verified testnet addresses and reserve data for each protocol. ' +
          'AgentHub has none on file, and inventing APYs would make this report worthless.',
      }),
    ],
    recommendation: funded
      ? `Your balance covers the allocation and the estimated entry cost of ${bnb(entryFee.fee, 6)}. Actual pool selection needs live protocol data this build cannot verify — that is the honest limit of this result.`
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

  const hasSimulated = result.fields.some((f) => f.source === SOURCES.simulated);
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
