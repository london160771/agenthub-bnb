/**
 * Native-BNB payment boundary.
 *
 * This module never submits a transaction and never handles a key. It has two
 * jobs only: turn an already-normalized backend requirement into a wallet
 * request preview, and verify a transaction/receipt after the user's wallet
 * has submitted it.
 */
import { env } from '../../config/env.js';

export const BSC_MAINNET_CHAIN_ID = 56;
const DEFAULT_MAINNET_RPC = 'https://bsc-dataseed.bnbchain.org';
const RPC_TIMEOUT_MS = 10_000;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

export class NativeBnbPaymentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'NativeBnbPaymentError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new NativeBnbPaymentError(code, message);
}

function decimalToWei(value, decimals = 18) {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) fail('PAYMENT_AMOUNT_INVALID', 'The native BNB amount is not a valid decimal value.');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) fail('PAYMENT_AMOUNT_INVALID', 'The native BNB amount has too many decimal places.');
  const base = 10n ** BigInt(decimals);
  const units = BigInt(whole) * base + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
  if (units <= 0n) fail('PAYMENT_AMOUNT_INVALID', 'The native BNB amount must be greater than zero.');
  return units;
}

function validateRequirement(requirement) {
  if (!requirement || requirement.protocol !== 'native-bnb') {
    fail('PAYMENT_PROTOCOL_MISMATCH', 'This payment executor only handles native BNB requirements.');
  }
  if (Number(requirement.network?.chainId) !== BSC_MAINNET_CHAIN_ID) {
    fail('PAYMENT_NETWORK_MISMATCH', 'Native-BNB payment is restricted to BSC Mainnet (chain 56).');
  }
  if (String(requirement.token?.symbol || '').toUpperCase() !== 'BNB') {
    fail('PAYMENT_TOKEN_MISMATCH', 'The verified native payment token must be BNB.');
  }
  if (requirement.token?.address) {
    fail('PAYMENT_TOKEN_MISMATCH', 'Native BNB payment cannot include an ERC-20 token contract.');
  }
  const recipient = String(requirement.recipient || '').trim();
  if (!ADDRESS_RE.test(recipient)) fail('PAYMENT_RECIPIENT_INVALID', 'The verified payment recipient is not a valid address.');
  const decimals = Number(requirement.token?.decimals ?? 18);
  if (!Number.isInteger(decimals) || decimals !== 18) fail('PAYMENT_DECIMALS_INVALID', 'Native BNB must use 18 decimals.');
  const amountWei = decimalToWei(requirement.amount, decimals);
  return { recipient, decimals, amountWei };
}

/** Build the exact request preview that the injected wallet will receive. */
export function buildNativeBnbPaymentRequest({ requirement }) {
  const { recipient, amountWei } = validateRequirement(requirement);
  return {
    chainId: BSC_MAINNET_CHAIN_ID,
    to: recipient,
    valueWei: amountWei.toString(),
    value: `0x${amountWei.toString(16)}`,
    kind: 'native-bnb-transfer',
  };
}

async function rpcRead(method, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(env.bnbRpcUrl || DEFAULT_MAINNET_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) fail('PAYMENT_RPC_UNAVAILABLE', `BSC Mainnet RPC returned HTTP ${response.status}.`);
    const body = await response.json().catch(() => null);
    if (!body || body.error || body.result === undefined) {
      fail('PAYMENT_RPC_UNAVAILABLE', `BSC Mainnet RPC could not read ${method}.`);
    }
    return body.result;
  } catch (err) {
    if (err instanceof NativeBnbPaymentError) throw err;
    if (err?.name === 'AbortError') fail('PAYMENT_RPC_TIMEOUT', 'BSC Mainnet RPC did not respond in time.');
    fail('PAYMENT_RPC_UNAVAILABLE', 'BSC Mainnet RPC could not be reached.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verify a submitted native transfer using public BSC reads. This is not a
 * signer and does not broadcast anything. The receipt must be successful, the
 * sender must match the connected wallet, and the transfer must be direct,
 * native BNB to the exact backend-authoritative recipient.
 */
export async function verifyNativeBnbPayment({ requirement, transactionHash, userAddress }) {
  const { recipient, amountWei } = validateRequirement(requirement);
  const hash = String(transactionHash || '').trim();
  const sender = String(userAddress || '').trim();
  if (!TX_HASH_RE.test(hash)) fail('PAYMENT_TX_HASH_INVALID', 'The wallet returned an invalid transaction hash.');
  if (!ADDRESS_RE.test(sender)) fail('PAYMENT_SENDER_INVALID', 'The connected wallet address is invalid.');

  const chainId = Number.parseInt(await rpcRead('eth_chainId'), 16);
  if (chainId !== BSC_MAINNET_CHAIN_ID) fail('PAYMENT_NETWORK_MISMATCH', 'The verification RPC is not BSC Mainnet (chain 56).');

  const [transaction, receipt] = await Promise.all([
    rpcRead('eth_getTransactionByHash', [hash]),
    rpcRead('eth_getTransactionReceipt', [hash]),
  ]);
  if (!transaction || !receipt) fail('PAYMENT_NOT_CONFIRMED', 'The BSC Mainnet transaction or receipt is not available yet.');
  if (String(transaction.from || '').toLowerCase() !== sender.toLowerCase()) fail('PAYMENT_SENDER_MISMATCH', 'The payment sender does not match the connected wallet.');
  if (String(transaction.to || '').toLowerCase() !== recipient.toLowerCase()) fail('PAYMENT_RECIPIENT_MISMATCH', 'The payment recipient does not match the verified requirement.');
  if (transaction.chainId !== undefined && transaction.chainId !== null && Number.parseInt(transaction.chainId, 16) !== BSC_MAINNET_CHAIN_ID) {
    fail('PAYMENT_NETWORK_MISMATCH', 'The payment transaction is not on BSC Mainnet (chain 56).');
  }
  if (String(transaction.input || '0x') !== '0x') fail('PAYMENT_NOT_DIRECT_NATIVE_TRANSFER', 'The payment transaction contains contract calldata; a direct native BNB transfer is required.');
  if (BigInt(transaction.value || '0x0') !== amountWei) fail('PAYMENT_AMOUNT_MISMATCH', 'The confirmed BNB amount must exactly match the verified requirement.');
  if (String(receipt.status || '').toLowerCase() !== '0x1') fail('PAYMENT_FAILED_ONCHAIN', 'The BSC Mainnet payment transaction did not succeed.');
  if (!receipt.blockNumber) fail('PAYMENT_NOT_CONFIRMED', 'The BSC Mainnet payment transaction has no confirmed block yet.');

  return {
    transactionHash: hash,
    chainId,
    amountWei: BigInt(transaction.value).toString(),
    recipient,
    sender,
    blockNumber: Number.parseInt(receipt.blockNumber, 16),
    verifiedAt: new Date(),
  };
}
