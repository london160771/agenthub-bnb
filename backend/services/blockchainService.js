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

/**
 * One JSON-RPC request. Rejects with ChainReadError carrying a message that is
 * safe to show a user — RPC failures are routine (rate limits, timeouts) and the
 * execution page has to explain them rather than show a stack trace.
 */
export async function rpcCall(method, params = []) {
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
