/**
 * Paid Sentinels Audit MCP adapter.
 *
 * Payment is intentionally not performed here. The generic native-BNB payment
 * boundary verifies the user's confirmed transfer first; this adapter then
 * sends the real Solidity task plus that real transaction hash to the public
 * MCP endpoint and preserves the response verbatim.
 */
import { TaskInputError } from '../agentExecutors.js';
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const SENTINELS_AUDIT_ENDPOINT = 'https://smartsentinels.net/api/audit-mcp';
export const SENTINELS_AUDIT_RECIPIENT = '0x4E21F74143660ee576F4D2aC26BD30729a849f55';
export const SENTINELS_AUDIT_CHAIN_ID = 56;
export const SENTINELS_AUDIT_AMOUNT_BNB = 0.2;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const TIMEOUT_MS = 120_000;
const MAX_SOLIDITY_LENGTH = 50_000;

function fail(message) {
  throw new TaskInputError(message);
}

export class SentinelsResultValidationError extends TaskInputError {
  constructor(message, rawResult) {
    super(message);
    this.name = 'SentinelsResultValidationError';
    this.rawResult = rawResult;
  }
}

function failResult(message, rawResult) {
  throw new SentinelsResultValidationError(message, rawResult);
}

function substantiveScalar(value) {
  return (typeof value === 'string' && value.trim() !== '')
    || (typeof value === 'number' && Number.isFinite(value));
}

function substantiveReportUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function parseInput(input = {}, execution) {
  const solidityCode = typeof input.solidityCode === 'string' ? input.solidityCode.trim() : '';
  if (!solidityCode) fail('Paste the Solidity source code to audit.');
  if (solidityCode.length > MAX_SOLIDITY_LENGTH) fail(`Solidity source must be ${MAX_SOLIDITY_LENGTH} characters or fewer.`);

  const contractName = input.contractName == null ? '' : String(input.contractName).trim();
  if (contractName.length > 120) fail('Contract name must be 120 characters or fewer.');

  const paymentTxHash = String(execution?.transactionHash || '').trim();
  if (!TX_HASH_RE.test(paymentTxHash)) fail('A confirmed BSC payment transaction hash is required before the audit can run.');
  return { solidityCode, contractName, paymentTxHash };
}

async function request(args) {
  const id = `agenthub-sentinels-audit-${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(SENTINELS_AUDIT_ENDPOINT, {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: {
          name: 'sentinels_ai_audit_contract',
          arguments: {
            solidityCode: args.solidityCode,
            ...(args.contractName ? { contractName: args.contractName } : {}),
            paymentTxHash: args.paymentTxHash,
          },
        },
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body;
    try { body = JSON.parse(raw); } catch { fail('Sentinels Audit returned malformed JSON.'); }
    if (!response.ok) fail(`Sentinels Audit returned HTTP ${response.status}.`);
    if (body?.error || body?.result?.isError === true) fail('Sentinels Audit rejected the paid task.');
    return { body, url: SENTINELS_AUDIT_ENDPOINT, status: response.status };
  } catch (err) {
    if (err instanceof TaskInputError) throw err;
    if (err?.name === 'AbortError') fail('Sentinels Audit did not respond within 120 seconds.');
    fail(`Sentinels Audit could not be reached: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

export function validateSentinelsResult(body, { paymentTxHash = '', contractName = '' } = {}) {
  const content = body?.result?.content;
  if (!Array.isArray(content)) failResult('Sentinels Audit returned no task result content.', body);
  const text = content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n\n')
    .trim();
  if (!text) failResult('Sentinels Audit returned an empty task result.', body);

  let structured = null;
  try { structured = JSON.parse(text); } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fenced) {
      try { structured = JSON.parse(fenced); } catch { structured = null; }
    }
  }
  if (!structured || typeof structured !== 'object' || Array.isArray(structured)) {
    failResult('Sentinels Audit returned unrecognized free text instead of a structured audit result.', body);
  }
  if (structured.ok === false || structured.error) {
    failResult('Sentinels Audit returned an error instead of an audit result.', body);
  }

  const findings = structured.findings || structured.issues || structured.vulnerabilities;
  const reportUrl = structured.report?.viewUrl || structured.report?.htmlUrl || structured.reportUrl;
  const score = structured.score ?? structured.securityScore ?? structured.riskScore;
  const risk = structured.risk || structured.riskLevel || structured.severity;
  const substantive = Array.isArray(findings)
    || substantiveReportUrl(reportUrl)
    || substantiveScalar(score)
    || substantiveScalar(risk);
  if (!substantive) {
    failResult('Sentinels Audit returned structured data without substantive audit fields.', body);
  }

  const returnedPaymentHash = structured.paymentTxHash
    || structured.transactionHash
    || structured.payment?.transactionHash;
  if (returnedPaymentHash && String(returnedPaymentHash).toLowerCase() !== String(paymentTxHash).toLowerCase()) {
    failResult('Sentinels Audit returned a result bound to a different payment transaction.', body);
  }
  const returnedContractName = structured.contractName || structured.task?.contractName;
  if (contractName && returnedContractName && String(returnedContractName).trim().toLowerCase() !== String(contractName).trim().toLowerCase()) {
    failResult('Sentinels Audit returned a result for a different contract task.', body);
  }

  return { text, structured };
}

function valueOrNull(value) {
  return value == null || value === '' ? null : String(value);
}

function resultFields(structured, text) {
  const fields = [];
  const add = (key, label, value, source = 'external') => {
    const normalized = valueOrNull(value);
    if (normalized != null) fields.push({ key, label, value: normalized, source });
  };
  if (structured && typeof structured === 'object') {
    add('status', 'Audit status', structured.status || structured.verdict || structured.result);
    add('score', 'Security score', structured.score ?? structured.securityScore ?? structured.riskScore);
    add('risk', 'Risk level', structured.risk || structured.riskLevel || structured.severity);
    const findings = structured.findings || structured.issues || structured.vulnerabilities;
    if (Array.isArray(findings)) add('findings', 'Findings returned', findings.length);
    add('reportUrl', 'Report URL', structured.report?.viewUrl || structured.report?.htmlUrl || structured.reportUrl);
  }
  if (fields.length === 0) add('report', 'Audit report', text);
  return fields;
}

function findingsTable(structured) {
  const findings = structured?.findings || structured?.issues || structured?.vulnerabilities;
  if (!Array.isArray(findings) || findings.length === 0) return [];
  return [{
    title: 'Sentinels Audit findings',
    note: 'Finding values are copied from the paid external MCP response.',
    columns: [
      { key: 'severity', label: 'Severity' },
      { key: 'title', label: 'Finding' },
      { key: 'description', label: 'Description' },
    ],
    rows: findings.map((finding) => ({
      severity: { value: valueOrNull(finding?.severity || finding?.risk || finding?.level) || 'Not reported', source: 'external' },
      title: { value: valueOrNull(finding?.title || finding?.name || finding?.id) || 'Not reported', source: 'external' },
      description: { value: valueOrNull(finding?.description || finding?.detail || finding?.message) || 'Not reported', source: 'external' },
    })),
  }];
}

export async function executeSentinelsAudit({ agent, execution }) {
  if (getExternalAdapterKey(agent) !== 'sentinels-audit') fail('This is not the verified Sentinels Audit agent.');
  if (execution?.payment?.status !== 'confirmed') fail('The BSC Mainnet payment is not confirmed.');
  const args = parseInput(execution.input || {}, execution);
  const { body, url, status } = await request(args);
  const { text, structured } = validateSentinelsResult(body, args);
  const now = new Date().toISOString();
  return {
    headline: structured?.headline || structured?.verdict || 'Sentinels Audit returned a paid security result',
    summary: structured?.summary || structured?.message || text,
    fields: resultFields(structured, text),
    tables: findingsTable(structured),
    warnings: ['This result came from the paid Sentinels Audit MCP service. It is external HTTP/MCP output, not a blockchain security guarantee.'],
    recommendation: 'Paid security-analysis result returned. Review the full raw response and report URL before acting.',
    hasSimulated: false,
    executionVerified: true,
    provenance: {
      source: 'external-http-mcp-paid',
      transport: 'external-mcp',
      endpoint: SENTINELS_AUDIT_ENDPOINT,
      chainId: SENTINELS_AUDIT_CHAIN_ID,
      network: 'BSC Mainnet',
      paymentProtocol: 'native-bnb',
      paymentTransactionHash: args.paymentTxHash,
      paymentAmount: SENTINELS_AUDIT_AMOUNT_BNB,
      paymentToken: 'BNB',
      paymentRecipient: SENTINELS_AUDIT_RECIPIENT,
      resultReceivedAt: now,
      explorer: 'https://bscscan.com',
    },
    rawResponse: body,
    reads: [{ method: 'HTTP POST MCP tools/call', target: url, status }],
  };
}

export const sentinelsAuditAdapter = Object.freeze({
  kind: 'execution',
  adapterKey: 'sentinels-audit',
  endpoint: SENTINELS_AUDIT_ENDPOINT,
  chainId: SENTINELS_AUDIT_CHAIN_ID,
  paymentProtocol: 'native-bnb',
  paid: true,
  paidExecutionEnabled: false,
  canHandle: (agent) => getExternalAdapterKey(agent) === 'sentinels-audit',
  execute: executeSentinelsAudit,
});
