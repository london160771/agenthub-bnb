/**
 * Real reads from BNB Smart Chain Testnet over raw JSON-RPC.
 *
 * WHY RAW JSON-RPC: every call here is a read, and reads of native balances,
 * nonces and block data need no ABI encoding — so a full web3 library would add
 * a large dependency for no capability we use. The spec's tech-stack section
 * lists wagmi/viem; those are browser-side wallet libraries, and this is a
 * server-side reader. Deliberate deviation, recorded here rather than hidden.
 *
 * WHAT THIS CANNOT DO: there is no signing, no transaction building, no private
 * key, and no write of any kind. Reading a blockchain is free and needs no
 * credentials, which is why this module works with a public endpoint and no
 * secret. If a private endpoint is configured later its URL may embed an API
 * key, so `provenanceHost()` deliberately exposes only the hostname — never the
 * full URL, which AGENTS.md classes as a credential.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Official BNB Chain public testnet endpoint, verified against
 * https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/
 * and confirmed live: it reports chain id 97 and returns real block data.
 * Overridable via BNB_TESTNET_RPC_URL.
 */
const DEFAULT_TESTNET_RPC = 'https://bsc-testnet-dataseed.bnbchain.org';

/** BNB Smart Chain Testnet. Must match what the endpoint reports. */
export const TESTNET_CHAIN_ID = 97;

/** Public endpoints are shared and rate-limited, so fail fast rather than hang. */
const RPC_TIMEOUT_MS = 8000;

export function rpcUrl() {
  return process.env.BNB_TESTNET_RPC_URL || DEFAULT_TESTNET_RPC;
}

/**
 * Hostname only. A configured RPC URL can carry an API key in its path or query,
 * and provenance is shown to users — so we surface where the data came from
 * without leaking how we authenticated to get it.
 */
export function provenanceHost() {
  try {
    return new URL(rpcUrl()).host;
  } catch {
    return 'unknown-rpc-host';
  }
}

/** Raised when the chain can't be read. Carries a user-safe message. */
export class ChainReadError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ChainReadError';
    this.cause = cause;
  }
}

/* ------------------------------------------------------------------ *
 * RPC call log
 * ------------------------------------------------------------------ */

/**
 * A per-run log of the JSON-RPC requests actually issued.
 *
 * WHY THIS EXISTS: the execution page shows "RPC calls made (n)" and each
 * method name, and an execution now persists `rpcCallCount`. Both were
 * previously fed by a list hand-written inside each executor — which had drifted
 * from reality (the research executor declared two reads while issuing three;
 * two others named `eth_gasPrice`, which they never call; none of them counted
 * the four reads `readChainState()` makes). A list that claims to be an audit
 * trail has to be produced by the thing being audited, so it is measured here,
 * at the single point every request passes through.
 *
 * AsyncLocalStorage rather than a module-level counter: two executions can be in
 * flight at once, and a shared counter would attribute one run's reads to the
 * other. Each run gets its own store, and async continuations inherit it.
 */
const rpcLogStore = new AsyncLocalStorage();

const ADDRESS_PARAM_RE = /^0x[a-fA-F0-9]{40}$/;

/** Append to the active run's log, if there is one. A no-op outside a run. */
function recordRpcCall(method, params) {
  const log = rpcLogStore.getStore();
  if (!log) return;
  // The first param is an address for the account/code reads and a block tag for
  // the block read, so it is only reported when it actually looks like one.
  // For eth_call it is a transaction object, whose `to` is the contract read —
  // extracted so a run's audit trail names the contracts it touched rather than
  // showing a row of anonymous "eth_call" entries.
  const first = params?.[0];
  let target;
  if (typeof first === 'string' && ADDRESS_PARAM_RE.test(first)) {
    target = first;
  } else if (first && typeof first === 'object' && ADDRESS_PARAM_RE.test(String(first.to))) {
    target = first.to;
  }
  log.push(target ? { method, target } : { method });
}

/**
 * Run `fn` with `log` collecting every RPC request it issues.
 *
 * The caller owns the array, so the log is still readable after `fn` throws —
 * a failed run's reads are as real as a successful one's.
 */
export function withRpcLog(log, fn) {
  return rpcLogStore.run(log, fn);
}

/**
 * One JSON-RPC request. Rejects with ChainReadError carrying a message that is
 * safe to show a user — RPC failures are routine (rate limits, timeouts) and the
 * execution page has to explain them rather than show a stack trace.
 */
export async function rpcCall(method, params = []) {
  // Logged at issue time, before the request can fail: a rejected request was
  // still a request issued, and a count that silently drops failures would
  // understate the work done.
  recordRpcCall(method, params);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(rpcUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new ChainReadError(
        `The BNB testnet node did not respond within ${RPC_TIMEOUT_MS / 1000}s.`,
        err,
      );
    }
    throw new ChainReadError('Could not reach the BNB testnet node.', err);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Public endpoints answer 429 when a shared quota is exhausted.
    if (res.status === 429) {
      throw new ChainReadError('The public BNB testnet node is rate-limiting requests.');
    }
    throw new ChainReadError(`The BNB testnet node returned HTTP ${res.status}.`);
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new ChainReadError('The BNB testnet node returned a malformed response.', err);
  }

  if (json.error) {
    throw new ChainReadError(
      `The BNB testnet node rejected ${method}: ${json.error.message || 'unknown error'}.`,
    );
  }
  if (json.result === undefined) {
    throw new ChainReadError(`The BNB testnet node returned no result for ${method}.`);
  }
  return json.result;
}

/** Hex quantity → Number. Safe for block numbers, nonces and gas prices. */
function hexToNumber(hex) {
  const n = Number.parseInt(hex, 16);
  if (!Number.isFinite(n)) throw new ChainReadError(`Expected a hex quantity, got "${hex}".`);
  return n;
}

/**
 * Hex wei → a decimal string with 18 places, without floating-point error.
 *
 * Balances exceed Number.MAX_SAFE_INTEGER, so the arithmetic is done in BigInt
 * and formatted by string surgery. Returning a Number here would silently lose
 * precision on large balances — the classic Web3 rounding bug.
 */
function weiToDecimalString(hexWei, decimals = 18) {
  const wei = BigInt(hexWei);
  const base = 10n ** BigInt(decimals);
  const whole = wei / base;
  const fraction = (wei % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

/**
 * Confirm the endpoint really is testnet before trusting anything it says.
 *
 * A misconfigured BNB_TESTNET_RPC_URL pointing at mainnet would otherwise
 * produce real-looking mainnet data inside a build that promises testnet-only.
 * This is the accidental-mainnet safeguard on the read path.
 */
export async function assertTestnet() {
  const chainId = hexToNumber(await rpcCall('eth_chainId'));
  if (chainId !== TESTNET_CHAIN_ID) {
    throw new ChainReadError(
      `The configured RPC endpoint reports chain ${chainId}, not BNB testnet ` +
        `(${TESTNET_CHAIN_ID}). Refusing to read from it.`,
    );
  }
  return chainId;
}

/**
 * Current network conditions. Every value is read live; nothing is cached,
 * because a stale gas price presented as current would be a fabricated fact.
 */
export async function readChainState() {
  const chainId = await assertTestnet();
  const [blockHex, gasHex] = await Promise.all([
    rpcCall('eth_blockNumber'),
    rpcCall('eth_gasPrice'),
  ]);
  const blockNumber = hexToNumber(blockHex);
  const block = await rpcCall('eth_getBlockByNumber', [blockHex, false]);

  return {
    chainId,
    blockNumber,
    gasPriceWei: BigInt(gasHex).toString(),
    gasPriceGwei: Number(weiToDecimalString(gasHex, 9)),
    blockTimestamp: block?.timestamp ? new Date(hexToNumber(block.timestamp) * 1000) : null,
    // A block's transaction count is a genuine measure of how busy the chain is.
    blockTransactions: Array.isArray(block?.transactions) ? block.transactions.length : null,
  };
}

/**
 * Everything we can learn about an address without a contract call.
 *
 * `transactionCount` is the account nonce — the number of transactions this
 * address has SENT. It is not total activity (it excludes transfers received),
 * and the field name says `sent` so nothing downstream can misread it.
 */
export async function readAddressState(address) {
  const [balanceHex, nonceHex] = await Promise.all([
    rpcCall('eth_getBalance', [address, 'latest']),
    rpcCall('eth_getTransactionCount', [address, 'latest']),
  ]);

  const balanceDecimal = weiToDecimalString(balanceHex);
  return {
    address,
    balanceWei: BigInt(balanceHex).toString(),
    balance: balanceDecimal,
    // Number form for display maths only. The string above stays authoritative.
    balanceApprox: Number(balanceDecimal),
    transactionsSent: hexToNumber(nonceHex),
    isEmpty: BigInt(balanceHex) === 0n && hexToNumber(nonceHex) === 0,
  };
}

/**
 * Is there a contract at this address, and how big is it?
 *
 * `eth_getCode` is the single most useful due-diligence read available without an
 * indexer: it distinguishes a deployed contract from a plain wallet, which
 * immediately catches "token address" inputs that are actually somebody's EOA, or
 * a contract that has been self-destructed. Bytecode size is a rough proxy for
 * complexity — genuinely measured, not estimated.
 */
export async function readContractInfo(address) {
  const code = await rpcCall('eth_getCode', [address, 'latest']);
  // '0x' (or '0x0') means no code: an externally-owned account, or nothing at all.
  const hex = typeof code === 'string' ? code.replace(/^0x/, '') : '';
  const isContract = hex.length > 0 && !/^0+$/.test(hex);
  return {
    address,
    isContract,
    bytecodeBytes: isContract ? hex.length / 2 : 0,
  };
}

/**
 * A read-only contract call: `eth_call` against `to` with pre-encoded `data`.
 *
 * WHY THIS IS STILL SAFE UNDER THE NO-WRITE RULE: `eth_call` executes contract
 * code on the node and throws the result away. It is signed by nobody, costs
 * nothing, changes no state, and cannot be included in a block. It is the read
 * side of a contract, exactly as `eth_getBalance` is the read side of an account.
 * There is still no signing, no key and no transaction anywhere in this module.
 *
 * Routed through `rpcCall` rather than issuing its own fetch, so contract reads
 * land in the per-run RPC log for free — the metering added in Phase 6.5 counts
 * them without any change to the meter.
 *
 * Reverts surface as a ChainReadError naming the contract, because "the call
 * reverted" is a legitimate and informative answer on-chain (an unlisted market,
 * a token with no `underlying()`) and callers need to distinguish it from a node
 * failure. `eth_call` always runs against `latest`; a pinned block would be more
 * reproducible but would report stale prices as current.
 */
export async function ethCall(to, data) {
  const result = await rpcCall('eth_call', [{ to, data }, 'latest']);
  if (typeof result !== 'string' || !result.startsWith('0x')) {
    throw new ChainReadError(`The contract at ${to} returned a malformed result.`);
  }
  // '0x' means the call ran but produced no return data — typically a revert
  // without a reason string, or a function that does not exist on this contract.
  if (result === '0x') {
    throw new ChainReadError(`The contract at ${to} returned no data for this call (reverted).`);
  }
  return result;
}

/**
 * Gas cost of an operation at the current gas price, in tBNB.
 *
 * The gas PRICE is a real reading. The gas UNITS are an assumption, and the
 * caller must say which operation it assumed — so the return value carries both,
 * and no caller can present the product as a measured fee.
 */
export function estimateFee({ gasPriceWei, gasUnits }) {
  const wei = BigInt(gasPriceWei) * BigInt(gasUnits);
  return {
    gasUnits,
    feeWei: wei.toString(),
    fee: weiToDecimalString(`0x${wei.toString(16)}`),
  };
}

/**
 * Provenance stamp attached to every real chain read, so a user can re-derive
 * any number we show. Without this, "your balance is 3.2 tBNB" is a claim; with
 * it, it's a checkable measurement at a named block.
 */
export function buildProvenance({ chainId, blockNumber }) {
  return {
    source: 'bnb-testnet-rpc',
    rpcHost: provenanceHost(),
    chainId,
    blockNumber,
    readAt: new Date(),
    explorer: 'https://testnet.bscscan.com',
  };
}
