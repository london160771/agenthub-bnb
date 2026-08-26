/**
 * Minimal ABI encoding/decoding for read-only contract calls.
 *
 * WHY HAND-WRITTEN: this repo has no ethers/web3 (see backend/package.json), and
 * adding one for read-only calls would be a large dependency for a few hundred
 * bytes of hex manipulation. AGENTS.md also says not to add dependencies unless
 * genuinely necessary.
 *
 * WHY SELECTORS ARE VERIFIED CONSTANTS, NOT COMPUTED: a function selector is the
 * first 4 bytes of keccak256("name(types)"). There is no keccak256 in this repo,
 * so selectors CANNOT be computed here. Every selector below was therefore
 * verified EMPIRICALLY against BNB testnet (chain 97) before use: called against
 * a real deployed contract, with the result cross-checked against an independently
 * known value wherever one existed. A selector that merely "looks right" is not
 * accepted, because a wrong selector on a proxy either reverts (loud, fine) or
 * silently returns a decodable value from a different function (quiet, dangerous).
 *
 * WHY DECODING IS STRICT: `decodeWords` requires an exact payload width and
 * refuses anything it cannot account for. Venus's older vToken delegator proxies
 * return MORE words than the function's return type implies — `balanceOf(address)`
 * comes back as three 32-byte words from vUSDT where a plain BEP-20 (WBNB) returns
 * one, for the identical call on the identical node. Ten of the 49 core-pool
 * markets behave this way.
 *
 * That padding was measured, not guessed. Two independent cross-checks fixed the
 * layout as PAYLOAD-FIRST, TRAILING WORDS ZERO:
 *
 *   1. `getCash()` must equal `underlying.balanceOf(vToken)` — two unrelated
 *      contracts, and the underlying returns exactly one word. Across the ten
 *      delegator markets this matched at word[0] in all seven cases with a
 *      non-zero balance, never at the last word, with every trailing word zero.
 *      Zero counterexamples.
 *   2. `getAccountSnapshot`'s exchange-rate member must equal an independently
 *      read `exchangeRateStored()`. This matched on all 39 four-word markets with
 *      non-zero rates, and on the delegator markets it appeared at the stock index
 *      3 of 6 with words 4-5 zero.
 *
 * So `decodeWords` takes the leading words and REQUIRES every extra word to be
 * zero. A non-zero trailing word means the layout assumption has broken, and the
 * decoder throws rather than return a number it cannot justify — callers degrade
 * that field to `unavailable`. This matters because the value on the other end of
 * this decoder is a liquidation warning; a confidently wrong one is worse than
 * none.
 */

/** Raised when a return value does not match the expected shape. */
export class AbiDecodeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AbiDecodeError';
  }
}

/**
 * Function selectors verified against chain 97. The comment on each records the
 * evidence, because "verified" with no stated evidence is just a claim.
 *
 * Contracts these were verified against:
 *   Comptroller 0x94d1820b2D1c7c7452A163983Dc888CEC546b77D (Venus Core Pool)
 *   Oracle      read from Comptroller.oracle() — never hardcoded
 *   vUSDT       0xb7526572FFE56AB9D7489838Bf2E18e3323b441A
 *   vBNB        0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c
 *   WBNB        0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd (non-proxy control)
 */
export const SELECTORS = {
  // --- Comptroller: all decode to the exact expected word count ------------
  /** getAllMarkets() → address[]. Returned 49 markets. */
  getAllMarkets: '0xb0772d0b',
  /** oracle() → address. Used so the oracle address is READ, not hardcoded. */
  oracle: '0x7dc0d1d0',
  /** getAssetsIn(address) → address[]. Correct dynamic-array framing. */
  getAssetsIn: '0xabfceffc',
  /**
   * getAccountLiquidity(address) → (error, liquidity, shortfall), all 1e18 USD.
   * Returns exactly 3 words, matching Compound's documented 3-tuple.
   */
  getAccountLiquidity: '0x5ec88c79',
  /**
   * markets(address) → Venus's market struct. Returns SEVEN words, and the two
   * that matter were identified by RECONCILIATION against the protocol's own
   * answer, not by inspection:
   *
   *   word[0] isListed (1/0)
   *   word[3] the risk weight `getAccountLiquidity` actually applies
   *
   * word[3] is NOT the obvious choice, and getting it wrong was caught only by
   * checking the arithmetic against Venus. Venus separates two per-market
   * mantissas — a borrowing-power collateral factor and a higher liquidation
   * threshold:
   *
   *   market   word[1]   word[3]
   *   vBNB      0.70      0.80
   *   vUSDT     0.75      0.80
   *   vCAKE     0.60      0.60
   *   vETH      0.00      0.80     ← no new borrowing power, still liquidatable
   *
   * Summing per-market collateral with word[3] reproduced
   * `getAccountLiquidity` EXACTLY (0 wei delta) on a real testnet position;
   * word[1] was out by 0.6e18 on the same position. So word[3] is what a
   * liquidation monitor must use. word[1] must NOT be used for liquidation risk —
   * it would overstate danger by understating collateral.
   *
   * Words 2, 4, 5 and 6 are never decoded: word[4] was 1.1e18 on every market
   * checked and word[6] was 1, which look like a liquidation incentive and a
   * flag, but nothing here depends on a guess.
   */
  markets: '0x8e8f294b',

  // --- Oracle ---------------------------------------------------------------
  /**
   * getUnderlyingPrice(vToken) → price scaled 1e(36 - underlyingDecimals).
   * One word. Validated across decimals: vBNB (18) → 6e20 = $600, vUSDT (6) →
   * 5e29 = $0.50. Fails outright for some markets (vMATIC), which callers must
   * handle per-market rather than aborting the whole read.
   */
  getUnderlyingPrice: '0xfc57d4df',

  // --- vToken, NO-ARGUMENT reads: these decode correctly -------------------
  /** symbol() → string. */
  symbol: '0x95d89b41',
  /** decimals() → uint8. Returned 8 for every vToken, 6 for USDT's underlying. */
  decimals: '0x313ce567',
  /** exchangeRateStored() → uint, scaled 1e(18 + underlyingDec - vTokenDec). */
  exchangeRateStored: '0x182df0f5',
  /**
   * getCash() → uint. THE STRONGEST EVIDENCE IN THIS FILE: for vBNB this
   * returned 16278354653298648953, byte-for-byte identical to what
   * `eth_getBalance` independently reported for the same contract. Two unrelated
   * code paths agreeing on one number validates the encoder, the decoder and the
   * selector at once.
   */
  getCash: '0x3b1d21a2',
  /** underlying() → address. Reverts on vBNB by design: native BNB has no ERC-20. */
  underlying: '0x6f307dc3',

  /**
   * getAccountSnapshot(address) → (error, vTokenBalance, borrowBalance,
   * exchangeRateMantissa). Four-word payload, stock Compound order.
   *
   * The order was PROVEN, not assumed: member 4 is the exchange rate, which is
   * also readable on its own via `exchangeRateStored()`. Across all 39 markets
   * that return four words, the two agreed byte-for-byte with non-zero values —
   * 39 confirmations, no mismatches, no vacuous zero-equals-zero cases. On the ten
   * delegator markets the rate appeared at the same index with the extra words
   * zero. Then the balances themselves were validated end to end: feeding them
   * through Venus's own liquidity formula reproduced `getAccountLiquidity` to the
   * wei on a real position.
   */
  getAccountSnapshot: '0xc37f68e2',

  // --- Plain (non-proxy) BEP-20 --------------------------------------------
  /**
   * balanceOf(address) → uint. Safe ONLY on non-proxy tokens: verified returning
   * exactly one word from WBNB. Through a Venus vToken delegator the same call
   * returns three words, so `venusAdapter` deliberately never calls it there.
   */
  balanceOf: '0x70a08231',
};

/**
 * Selectors that exist on-chain but whose RETURN LAYOUT was never established.
 * Exported so the ambiguity is documented in code rather than lost in a commit
 * message. Nothing may call these until the layout is confirmed — decoding them on
 * an assumption would silently produce wrong borrow figures.
 *
 * `borrowBalanceStored` is listed not because it is unknowable but because it is
 * UNNECESSARY: `getAccountSnapshot` returns the same borrow balance alongside the
 * data needed to validate it, in one call instead of two. A second path to the
 * same number is a second thing that can drift.
 */
export const UNVERIFIED_LAYOUT_SELECTORS = {
  borrowBalanceStored: '0x95dd9193',
};

const HEX_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Left-pad an address to a 32-byte ABI word. */
export function encodeAddress(address) {
  if (!HEX_ADDRESS_RE.test(String(address))) {
    throw new AbiDecodeError(`"${address}" is not a 20-byte hex address.`);
  }
  return String(address).replace(/^0x/, '').toLowerCase().padStart(64, '0');
}

/** `selector` plus each argument as one 32-byte word. Static types only. */
export function encodeCall(selector, args = []) {
  return selector + args.join('');
}

/**
 * Split return data into 32-byte words and return the leading `expected` ones.
 *
 * Extra words are tolerated ONLY if every one of them is zero — the measured
 * behaviour of Venus's legacy delegator proxies (see the module header for the two
 * cross-checks that established this). A non-zero extra word means the layout
 * assumption no longer holds, so this throws instead of returning a value it
 * cannot account for.
 *
 * `expected` is mandatory on purpose. Making it optional would invite callers to
 * skip it and read word[0] of a shape they never checked — exactly the failure
 * this module exists to prevent.
 */
export function decodeWords(hex, expected) {
  if (typeof hex !== 'string' || !hex.startsWith('0x')) {
    throw new AbiDecodeError('Expected 0x-prefixed return data.');
  }
  const body = hex.slice(2);
  if (body.length === 0) {
    throw new AbiDecodeError('The call returned no data (likely a revert).');
  }
  if (body.length % 64 !== 0) {
    throw new AbiDecodeError(`Return data is ${body.length / 2} bytes, not a whole number of words.`);
  }
  const all = Array.from({ length: body.length / 64 }, (_, i) => body.slice(i * 64, i * 64 + 64));
  if (all.length < expected) {
    throw new AbiDecodeError(
      `Expected ${expected} word(s) but the call returned only ${all.length}.`,
    );
  }
  const extra = all.slice(expected);
  const padded = extra.filter((w) => BigInt(`0x${w}`) !== 0n);
  if (padded.length > 0) {
    throw new AbiDecodeError(
      `The call returned ${all.length} words for a ${expected}-word value, and ${padded.length} ` +
        'of the extra word(s) are non-zero. Refusing to guess which words hold the value.',
    );
  }
  return all.slice(0, expected);
}

/** One 32-byte word → BigInt. All chain arithmetic stays in BigInt. */
export function toUint(word) {
  return BigInt(`0x${word}`);
}

/** One 32-byte word → checksum-less lowercase address (low 20 bytes). */
export function toAddress(word) {
  return `0x${word.slice(24)}`;
}

/** Single-uint return, e.g. exchangeRateStored(). */
export function decodeUint(hex) {
  return toUint(decodeWords(hex, 1)[0]);
}

/** Single-address return, e.g. oracle(). */
export function decodeAddress(hex) {
  return toAddress(decodeWords(hex, 1)[0]);
}

/**
 * Dynamic `address[]` return: [offset][length][...items].
 *
 * The length is validated against the actual payload, so a truncated response is
 * an error rather than a short list that reads as "this account entered fewer
 * markets than it did" — which would understate risk.
 */
export function decodeAddressArray(hex) {
  const body = hex.replace(/^0x/, '');
  if (body.length < 128) {
    throw new AbiDecodeError('Return data is too short to be a dynamic array.');
  }
  const all = Array.from({ length: body.length / 64 }, (_, i) => body.slice(i * 64, i * 64 + 64));
  const length = Number(toUint(all[1]));
  const items = all.slice(2);
  if (items.length !== length) {
    throw new AbiDecodeError(`Array claims ${length} item(s) but carries ${items.length}.`);
  }
  return items.map(toAddress);
}

/**
 * Dynamic `string` return: [offset][byteLength][...utf8].
 *
 * Returns null rather than throwing, because a symbol is cosmetic: a market whose
 * name won't decode should still have its risk numbers reported.
 */
export function decodeString(hex) {
  try {
    const body = hex.replace(/^0x/, '');
    const all = Array.from({ length: body.length / 64 }, (_, i) => body.slice(i * 64, i * 64 + 64));
    if (all.length < 3) return null;
    const byteLength = Number(toUint(all[1]));
    const data = all.slice(2).join('').slice(0, byteLength * 2);
    const text = Buffer.from(data, 'hex').toString('utf8').replace(/\0+$/, '');
    return text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Scale a raw integer to a fixed-point decimal STRING.
 *
 * String, not Number: a 1e18-scaled USD figure exceeds Number.MAX_SAFE_INTEGER,
 * and rounding a collateral value before comparing it to a borrow value is how
 * you get a health factor that is wrong in the third decimal place — the one that
 * decides whether a warning fires.
 */
export function scaledToDecimalString(value, scale, places = 6) {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(scale);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(Number(scale), '0').slice(0, places).replace(/0+$/, '');
  const text = fraction ? `${whole}.${fraction}` : String(whole);
  return negative ? `-${text}` : text;
}
