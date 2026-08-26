/**
 * Venus Protocol reader — BNB Smart Chain Testnet, Core Pool.
 *
 * Venus is a Compound fork, and that shapes everything here. Compound-family
 * protocols do not store an Aave-style "health factor"; the Comptroller exposes
 * `getAccountLiquidity(account)` → (error, liquidity, shortfall) in 1e18 USD, where
 * a NON-ZERO SHORTFALL means the account is liquidatable right now. That verdict is
 * the protocol's own, so it is reported first and unmodified.
 *
 * A health-factor RATIO is then derived from per-market reads, and — this is the
 * important part — RECONCILED against `getAccountLiquidity` before it is trusted.
 * Compound's Comptroller computes liquidity as exactly
 *
 *     sum(collateral_i) - sum(borrow_i)
 *
 * so re-deriving that sum and comparing it to what the protocol reports is a
 * complete check on every input and every scaling factor at once. If the two
 * disagree by a single wei, the derived ratio is withheld rather than shown.
 *
 * WHY THAT CHECK IS NOT PARANOIA: it caught a real bug during development. The
 * per-market risk weight was initially read from `markets()` word[1] (0.70 for
 * vBNB), which looked right and produced a plausible health factor. The
 * reconciliation was out by $0.60 and forced a second look: Venus keeps a separate,
 * higher liquidation threshold in word[3] (0.80), and that is the one
 * `getAccountLiquidity` applies. Using word[1] would have shipped a health factor
 * that overstated danger on every position — a false liquidation warning, in the
 * one place this app must never be confidently wrong. The check stays in at
 * runtime, on every execution.
 *
 * ADDRESSES ARE VERIFIED, NOT GUESSED. The Comptroller below is from Venus's
 * official deployed-contracts documentation for BNB Chain Testnet, and was
 * confirmed to hold code and to answer all four reads used here. The price oracle
 * is deliberately NOT hardcoded — it is read from the Comptroller at run time, so
 * an oracle migration cannot leave this file quoting a dead contract.
 *
 * TESTNET PRICES ARE NOT MARKET PRICES. The testnet oracle reports figures like
 * BNB $600 and BTC $2,100,000. Those are real chain reads of a test oracle, not
 * quotes. Every USD value out of this module must carry that caveat, which is why
 * `priceCaveat` is part of the return value rather than a comment.
 */
import { ethCall, ChainReadError } from './blockchainService.js';
import {
  SELECTORS,
  AbiDecodeError,
  decodeAddressArray,
  decodeString,
  decodeWords,
  encodeAddress,
  encodeCall,
  scaledToDecimalString,
  toAddress,
  toUint,
} from './abi.js';

/**
 * Venus Core Pool on BNB testnet.
 *
 * Source: https://docs-v4.venus.io/deployed-contracts/markets — "BNB Chain Testnet".
 * Confirmed live: holds bytecode, and `getAllMarkets()` returns 49 markets.
 */
export const VENUS_CORE_POOL = {
  protocol: 'Venus',
  pool: 'Core Pool',
  chainId: 97,
  comptroller: '0x94d1820b2D1c7c7452A163983Dc888CEC546b77D',
  docs: 'https://docs-v4.venus.io/deployed-contracts/markets',
  explorer: 'https://testnet.bscscan.com/address/0x94d1820b2D1c7c7452A163983Dc888CEC546b77D',
};

/** Protocol names (as used by seeded agents) that this adapter can actually read. */
const SUPPORTED_PROTOCOLS = new Set(['venus']);

/** Compound's fixed-point scale. Every mantissa below is 1e18. */
const MANTISSA = 10n ** 18n;

/**
 * Ceiling on markets analysed per run. A wallet may enter all 49 markets, and each
 * one costs four contract reads — 200 reads would make a web request time out on a
 * public endpoint. Beyond this ceiling the derived ratio is dropped (the sums would
 * be incomplete, so reconciliation could not pass) but Venus's own liquidity and
 * shortfall are still reported, because those come from a single call and are the
 * authoritative answer anyway. The truncation is always reported, never silent.
 */
const MAX_MARKETS_ANALYSED = 12;

/** Raised when Venus cannot be read. Distinct from a generic node failure. */
export class VenusReadError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'VenusReadError';
    this.cause = cause;
  }
}

export function supportsProtocol(protocol) {
  return SUPPORTED_PROTOCOLS.has(String(protocol || '').trim().toLowerCase());
}

/** The price oracle the Comptroller is currently using. Read, never hardcoded. */
export async function readOracleAddress() {
  const raw = await ethCall(VENUS_CORE_POOL.comptroller, encodeCall(SELECTORS.oracle));
  return toAddress(decodeWords(raw, 1)[0]);
}

/**
 * Markets the account has entered. Only these count toward collateral and debt —
 * an account can hold vTokens without having entered the market, in which case
 * Venus does not treat them as collateral, and neither must we.
 */
export async function readAssetsIn(account) {
  const raw = await ethCall(
    VENUS_CORE_POOL.comptroller,
    encodeCall(SELECTORS.getAssetsIn, [encodeAddress(account)]),
  );
  return decodeAddressArray(raw);
}

/**
 * Venus's own verdict on the account, in 1e18 USD.
 *
 * `shortfall > 0` means liquidatable NOW. `liquidity` is the USD buffer remaining
 * before that happens. These are the strongest statements this module can make,
 * because they are the protocol's own numbers rather than our arithmetic.
 */
export async function readAccountLiquidity(account) {
  const raw = await ethCall(
    VENUS_CORE_POOL.comptroller,
    encodeCall(SELECTORS.getAccountLiquidity, [encodeAddress(account)]),
  );
  const w = decodeWords(raw, 3);
  return {
    errorCode: Number(toUint(w[0])),
    liquidityWei: toUint(w[1]),
    shortfallWei: toUint(w[2]),
  };
}

/**
 * Per-market risk parameters.
 *
 * `liquidationFactorMantissa` is word[3] — the weight `getAccountLiquidity`
 * applies, established by reconciliation (see the module header and abi.js). The
 * seven-word width is required: word[4] is non-zero on every market checked, so a
 * narrower read would be rejected by the decoder rather than silently truncate.
 */
export async function readMarketRisk(vToken) {
  const raw = await ethCall(
    VENUS_CORE_POOL.comptroller,
    encodeCall(SELECTORS.markets, [encodeAddress(vToken)]),
  );
  const w = decodeWords(raw, 7);
  return {
    isListed: toUint(w[0]) === 1n,
    liquidationFactorMantissa: toUint(w[3]),
  };
}

/**
 * (error, vTokenBalance, borrowBalance, exchangeRateMantissa) for one market.
 *
 * A non-zero error code means Venus itself could not produce the snapshot, so it
 * is surfaced rather than treated as zero balances — "no position" and "could not
 * read the position" are different answers.
 */
export async function readAccountSnapshot(vToken, account) {
  const raw = await ethCall(vToken, encodeCall(SELECTORS.getAccountSnapshot, [encodeAddress(account)]));
  const w = decodeWords(raw, 4);
  return {
    errorCode: Number(toUint(w[0])),
    vTokenBalance: toUint(w[1]),
    borrowBalance: toUint(w[2]),
    exchangeRateMantissa: toUint(w[3]),
  };
}

/**
 * Underlying price from the oracle, scaled 1e(36 - underlyingDecimals).
 *
 * Returns null instead of throwing when the oracle has no price for a market —
 * `getUnderlyingPrice` genuinely reverts for some testnet markets (vMATIC did),
 * and one unpriced market must degrade that row rather than abort the whole run.
 */
export async function readUnderlyingPrice(oracle, vToken) {
  try {
    const raw = await ethCall(oracle, encodeCall(SELECTORS.getUnderlyingPrice, [encodeAddress(vToken)]));
    const price = toUint(decodeWords(raw, 1)[0]);
    return price > 0n ? price : null;
  } catch (err) {
    if (err instanceof ChainReadError || err instanceof AbiDecodeError) return null;
    throw err;
  }
}

/** Market symbol, for labelling only. null when it won't decode — cosmetic. */
export async function readMarketSymbol(vToken) {
  try {
    return decodeString(await ethCall(vToken, encodeCall(SELECTORS.symbol)));
  } catch {
    return null;
  }
}

/**
 * Compound's collateral arithmetic, in its exact truncation order.
 *
 * The order matters: Compound truncates to 1e18 at every multiplication, so
 * rearranging these three lines changes the last few wei. Reproducing the order
 * exactly is what turns "close enough" into an exact match against the protocol,
 * which is the only reason the reconciliation check can demand equality.
 *
 * Underlying decimals never appear — they cancel between the exchange rate and the
 * 1e(36-d) oracle scale. That removes two contract reads per market and, more
 * usefully, removes a whole class of scaling mistake.
 */
function marketContribution({ liquidationFactorMantissa, exchangeRateMantissa, price, vTokenBalance, borrowBalance }) {
  const factorTimesRate = (liquidationFactorMantissa * exchangeRateMantissa) / MANTISSA;
  const tokensToDenom = (factorTimesRate * price) / MANTISSA;
  return {
    collateralWei: (tokensToDenom * vTokenBalance) / MANTISSA,
    borrowWei: (price * borrowBalance) / MANTISSA,
    // Unweighted supply value, for showing what the position is actually worth.
    suppliedWei: (((exchangeRateMantissa * price) / MANTISSA) * vTokenBalance) / MANTISSA,
  };
}

const usd = (wei) => scaledToDecimalString(wei, 18, 2);

/**
 * Everything Venus can tell us about an account's liquidation risk.
 *
 * Never throws for "this wallet has no position" — that is a legitimate answer and
 * comes back as `hasPosition: false`. It throws only when the chain could not be
 * read at all.
 */
export async function readVenusPosition(account) {
  const assetsIn = await readAssetsIn(account);
  const venus = await readAccountLiquidity(account);

  const base = {
    protocol: VENUS_CORE_POOL.protocol,
    pool: VENUS_CORE_POOL.pool,
    comptroller: VENUS_CORE_POOL.comptroller,
    account,
    marketsEntered: assetsIn.length,
    venus: {
      errorCode: venus.errorCode,
      liquidityUsd: usd(venus.liquidityWei),
      shortfallUsd: usd(venus.shortfallWei),
      liquidatable: venus.shortfallWei > 0n,
    },
    priceCaveat:
      'USD values use the Venus TESTNET price oracle, which is a test feed — it ' +
      'quotes BNB at $600 and BTC at $2,100,000. These are real on-chain reads of ' +
      'that oracle, not market prices.',
  };

  // No entered markets means no collateral and no debt as far as Venus is
  // concerned. A distinct outcome, not an error and not a zeroed-out position.
  if (assetsIn.length === 0) {
    return {
      ...base,
      hasPosition: false,
      markets: [],
      totals: null,
      healthFactor: null,
      healthFactorUnavailableReason:
        'This wallet has not entered any Venus Core Pool market on BNB testnet, so ' +
        'it has no collateral or debt here and nothing to liquidate.',
      reconciliation: null,
      truncated: false,
    };
  }

  if (venus.errorCode !== 0) {
    return {
      ...base,
      hasPosition: true,
      markets: [],
      totals: null,
      healthFactor: null,
      healthFactorUnavailableReason:
        `Venus's Comptroller returned error code ${venus.errorCode} for this account, ` +
        'so its own liquidity figures cannot be trusted and nothing was derived from them.',
      reconciliation: null,
      truncated: false,
    };
  }

  const analysed = assetsIn.slice(0, MAX_MARKETS_ANALYSED);
  const truncated = assetsIn.length > analysed.length;
  const oracle = await readOracleAddress();

  const markets = [];
  let sumCollateralWei = 0n;
  let sumBorrowWei = 0n;
  let sumSuppliedWei = 0n;
  let incomplete = truncated;

  for (const vToken of analysed) {
    // Four independent reads per market, issued together — they don't depend on
    // each other, and a public endpoint is the slow part. AsyncLocalStorage
    // propagates into these, so the per-run RPC meter still counts every one.
    const [symbol, snapshot, risk, price] = await Promise.all([
      readMarketSymbol(vToken),
      readAccountSnapshot(vToken, account),
      readMarketRisk(vToken),
      readUnderlyingPrice(oracle, vToken),
    ]);

    if (snapshot.errorCode !== 0) {
      incomplete = true;
      markets.push({
        vToken,
        symbol,
        available: false,
        reason: `Venus returned error code ${snapshot.errorCode} for this market.`,
      });
      continue;
    }
    if (price === null) {
      incomplete = true;
      markets.push({
        vToken,
        symbol,
        available: false,
        reason: 'The Venus testnet oracle has no price for this market, so its USD value is unknown.',
      });
      continue;
    }

    const c = marketContribution({
      liquidationFactorMantissa: risk.liquidationFactorMantissa,
      exchangeRateMantissa: snapshot.exchangeRateMantissa,
      price,
      vTokenBalance: snapshot.vTokenBalance,
      borrowBalance: snapshot.borrowBalance,
    });

    sumCollateralWei += c.collateralWei;
    sumBorrowWei += c.borrowWei;
    sumSuppliedWei += c.suppliedWei;

    markets.push({
      vToken,
      symbol,
      available: true,
      isListed: risk.isListed,
      liquidationFactor: scaledToDecimalString(risk.liquidationFactorMantissa, 18, 4),
      suppliedUsd: usd(c.suppliedWei),
      borrowedUsd: usd(c.borrowWei),
      weightedCollateralUsd: usd(c.collateralWei),
    });
  }

  // The check that makes the derived numbers trustworthy: re-derive Venus's own
  // liquidity/shortfall and require exact agreement.
  const computedLiquidityWei = sumCollateralWei > sumBorrowWei ? sumCollateralWei - sumBorrowWei : 0n;
  const computedShortfallWei = sumBorrowWei > sumCollateralWei ? sumBorrowWei - sumCollateralWei : 0n;
  const matches =
    computedLiquidityWei === venus.liquidityWei && computedShortfallWei === venus.shortfallWei;
  const reconciled = matches && !incomplete;

  const reconciliation = {
    reconciled,
    matches,
    complete: !incomplete,
    computedLiquidityUsd: usd(computedLiquidityWei),
    computedShortfallUsd: usd(computedShortfallWei),
    protocolLiquidityUsd: usd(venus.liquidityWei),
    protocolShortfallUsd: usd(venus.shortfallWei),
    deltaWei: (computedLiquidityWei > venus.liquidityWei
      ? computedLiquidityWei - venus.liquidityWei
      : venus.liquidityWei - computedLiquidityWei
    ).toString(),
    explanation:
      "Our per-market arithmetic is re-checked against Venus's own " +
      'getAccountLiquidity. The derived health factor is only reported when the two ' +
      'agree exactly.',
  };

  let healthFactor = null;
  let healthFactorUnavailableReason = null;

  if (!reconciled) {
    healthFactorUnavailableReason = incomplete
      ? 'Some markets in this position could not be valued' +
        (truncated ? ` and only ${analysed.length} of ${assetsIn.length} markets were analysed` : '') +
        ", so the totals are incomplete and a health factor derived from them would be wrong. Venus's own liquidity and shortfall figures above are unaffected."
      : "Our re-derivation of Venus's liquidity did not match what the Comptroller " +
        `reports (off by ${reconciliation.deltaWei} wei), so the derived health factor is ` +
        "withheld. Venus's own verdict above still stands.";
  } else if (sumBorrowWei === 0n) {
    healthFactorUnavailableReason =
      'This wallet has supplied collateral but borrowed nothing, so there is no debt ' +
      'to liquidate and a health factor is undefined — not a risk, simply not applicable.';
  } else {
    healthFactor = Number(scaledToDecimalString((sumCollateralWei * MANTISSA) / sumBorrowWei, 18, 6));
  }

  return {
    ...base,
    hasPosition: true,
    oracle,
    markets,
    totals: {
      suppliedUsd: usd(sumSuppliedWei),
      weightedCollateralUsd: usd(sumCollateralWei),
      borrowedUsd: usd(sumBorrowWei),
    },
    healthFactor,
    healthFactorUnavailableReason,
    reconciliation,
    truncated,
    marketsAnalysed: analysed.length,
  };
}
