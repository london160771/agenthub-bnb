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
import { readHealthFactor, riskBand } from './lendingProtocolAdapter.js';

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

const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
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
async function runHealthFactor({ input, chain }) {
  const target = input.positionWallet;
  const protocol = input.protocol || 'the selected protocol';
  const state = await readAddressState(target);
  const position = readHealthFactor({ address: target, protocol });
  const band = riskBand(position.healthFactor);
  const warnBelow = Number(input.warnBelow ?? 1.5);
  const breached = position.healthFactor < warnBelow;

  return {
    headline: `Health factor ${position.healthFactor.toFixed(2)} — ${band.level} risk`,
    summary:
      `The wallet's on-chain state was read live at block #${chain.blockNumber.toLocaleString('en-US')}. ` +
      `The ${protocol} position itself is modelled, not read from the protocol's contracts — see the note below.`,
    fields: [
      field('healthFactor', 'Health factor', position.healthFactor.toFixed(2), {
        source: SOURCES.simulated,
        tone: band.tone,
        note: position.note,
      }),
      field('risk', 'Risk level', band.level, { source: SOURCES.simulated, tone: band.tone }),
      field('collateral', 'Collateral supplied', usd(position.collateralUsd), {
        source: SOURCES.simulated,
      }),
      field('borrow', 'Amount borrowed', usd(position.borrowUsd), { source: SOURCES.simulated }),
      field('protocol', 'Protocol', protocol, { source: SOURCES.input }),
      field('walletBalance', 'Wallet native balance', bnb(state.balance), {
        note: 'Real: what this wallet could use to top up collateral or repay.',
      }),
      ...networkFields(chain),
      field(
        'threshold',
        'Your warning threshold',
        `${warnBelow} — ${breached ? 'BREACHED' : 'not breached'}`,
        { source: SOURCES.derived, tone: breached ? 'bad' : 'ok' },
      ),
    ],
    recommendation: breached
      ? `The modelled health factor (${position.healthFactor.toFixed(2)}) is below your ${warnBelow} threshold. In a live position this is where you would add collateral or repay part of the borrow. Liquidation happens at 1.0.`
      : `The modelled health factor (${position.healthFactor.toFixed(2)}) sits above your ${warnBelow} threshold. No action required.`,
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
