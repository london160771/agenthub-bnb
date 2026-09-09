import { AlertTriangle, CheckCircle2, LockKeyhole, Wallet } from 'lucide-react';
import { Card, CardBody } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { SectionHeading } from '../ui/PageHeader.jsx';
import { useWallet } from '../../context/walletContext.js';
import { PaidExecutionLifecycle } from './PaidExecutionLifecycle.jsx';

function valueOrUnavailable(value) {
  return value == null || value === '' ? 'Unavailable' : String(value);
}

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-2 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="break-all text-right text-sm font-medium text-fg">{children}</span>
    </div>
  );
}

/**
 * Generic paid-agent confirmation boundary. Rendering is side-effect free.
 * Paid-ready records render as preflight only; an explicit payment callback is
 * required before this component can ever open a wallet.
 */
export function PaidPaymentConfirmation({
  agent,
  plan,
  task = '',
  loading = false,
  error = null,
  processing = false,
  onPay,
  lifecycleState = 'review',
}) {
  const { address, chainId, isConnected, connect, switchToMainnet, sendNativeBnb } = useWallet();
  const requirement = plan?.requirement || {};
  const request = plan?.paymentRequest;
  const network = requirement.network || {};
  const tokenSymbol = requirement.token?.symbol || 'token';
  const nativeBnb = plan?.protocol === 'native-bnb';
  const x402 = plan?.protocol === 'x402';
  const preflightOnly = typeof onPay !== 'function';
  const failed = Boolean(error) || plan?.state === 'FAILED' || plan?.ok === false;
  const missing = plan?.error?.missing || [];
  const ready = !loading && !failed && Boolean(request) && plan?.provenance?.paymentVerified === true && nativeBnb;
  const canConfirm = ready && isConnected && chainId === network.chainId && typeof onPay === 'function' && !processing;

  const handlePay = () => {
    if (!canConfirm) return;
    onPay({ sendNativeBnb, walletAddress: address });
  };

  return (
    <Card>
      <CardBody>
        <SectionHeading
          title={preflightOnly ? 'Payment preflight' : 'Confirm payment'}
          description={preflightOnly
            ? 'Review the verified payment facts before any future paid execution is enabled.'
            : 'Review this exact request before opening your wallet. AgentHub does not receive your private key.'}
          className="mb-3"
        />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant={failed ? 'bad' : processing ? 'warn' : ready ? 'warn' : 'info'}>
            {loading ? 'Loading…' : processing ? 'Waiting for confirmation…' : preflightOnly ? 'PREFLIGHT ONLY' : plan?.state || 'Preparing'}
          </Badge>
          {plan?.provenance?.paymentVerified === true && <Badge variant="ok">Payment facts verified</Badge>}
        </div>

        {!loading && plan?.protocol && (
          <PaidExecutionLifecycle
            protocol={plan.protocol}
            currentState={lifecycleState}
            preflightOnly={preflightOnly}
          />
        )}

        {loading ? (
          <p className="text-sm text-muted">Reading the saved payment requirement…</p>
        ) : (
          <>
            <Row label="Agent">{valueOrUnavailable(agent?.name)}</Row>
            <Row label="Protocol">{valueOrUnavailable(plan?.protocol)}</Row>
            {x402 && <Row label="ERC-8004 identity">BSC Mainnet (chain 56)</Row>}
            <Row label="Network">{valueOrUnavailable(network.name)} (chain {valueOrUnavailable(network.chainId)})</Row>
            <Row label="Amount">
              {valueOrUnavailable(requirement.amount)} {valueOrUnavailable(tokenSymbol)}
            </Row>
            <Row label="Recipient">{valueOrUnavailable(requirement.recipient || requirement.contract)}</Row>
            {x402 && <Row label="Settlement">{valueOrUnavailable(requirement.settlementNetwork)} · x402 {valueOrUnavailable(requirement.protocolVersion)} {valueOrUnavailable(requirement.scheme)}</Row>}
            {x402 && <Row label="Token contract">{valueOrUnavailable(requirement.token?.address)}</Row>}
            {x402 && <Row label="Token approval">{requirement.requiresTokenApproval == null ? 'Not specified by the provider challenge' : requirement.requiresTokenApproval ? 'Required' : 'Not required'}</Row>}
            <Row label="Payment effect">{valueOrUnavailable(requirement.effect)}</Row>
            <Row label="Wallet required">{requirement.requiresWallet == null ? 'Unknown' : requirement.requiresWallet ? 'Yes' : 'No'}</Row>
            <Row label="Mainnet transaction required">{requirement.requiresMainnetTx == null ? 'Unknown' : requirement.requiresMainnetTx ? 'Yes' : 'No'}</Row>
            {nativeBnb && <Row label="Token approval">Not required</Row>}
            {task && <Row label="Task">{task}</Row>}
            {request && nativeBnb && (
              <div className="mt-3 rounded-lg border border-warn/30 bg-warn/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-warn">Wallet transaction request</p>
                <dl className="mt-2 space-y-1 text-xs text-muted">
                  <div className="flex justify-between gap-3"><dt>from</dt><dd className="break-all font-mono text-right">{address || 'your connected wallet'}</dd></div>
                  <div className="flex justify-between gap-3"><dt>to</dt><dd className="break-all font-mono text-right">{request.to}</dd></div>
                  <div className="flex justify-between gap-3"><dt>value</dt><dd className="break-all font-mono text-right">{request.valueWei} wei (0x{request.value.slice(2)})</dd></div>
                </dl>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  This opens the wallet’s confirmation screen for the prepared {tokenSymbol} payment. Review the network and recipient in your wallet before approving.
                </p>
              </div>
            )}
            {request && x402 && (
              <div className="mt-3 rounded-lg border border-warn/30 bg-warn/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-warn">x402 payment challenge</p>
                <dl className="mt-2 space-y-1 text-xs text-muted">
                  <div className="flex justify-between gap-3"><dt>scheme</dt><dd className="text-right">{valueOrUnavailable(request.scheme)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>amount</dt><dd className="text-right">{valueOrUnavailable(request.amountBaseUnits)} base units</dd></div>
                  <div className="flex justify-between gap-3"><dt>payTo</dt><dd className="break-all font-mono text-right">{valueOrUnavailable(request.payTo)}</dd></div>
                  <div className="flex justify-between gap-3"><dt>token</dt><dd className="break-all font-mono text-right">{valueOrUnavailable(request.tokenAddress)}</dd></div>
                </dl>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  The provider challenge is verified, but x402 signing and submission are not enabled. No wallet prompt or payment request will be made in this phase.
                </p>
              </div>
            )}
            {failed && (
              <div className="mt-3 rounded-lg border border-bad/25 bg-bad/5 p-3 text-sm text-muted">
                <p className="flex items-center gap-1.5 font-medium text-bad">
                  <AlertTriangle size={15} aria-hidden="true" /> Payment preparation stopped
                </p>
                <p className="mt-1">{error?.message || plan?.error?.message || 'The payment requirement is incomplete.'}</p>
                {missing.length > 0 && <p className="mt-1 text-xs text-faint">Missing: {missing.join(', ')}</p>}
              </div>
            )}
          </>
        )}

        <div className="mt-4">
          {!onPay ? (
            <div className="rounded-lg border border-line bg-panel-2 px-3 py-3" role="status">
              <p className="text-sm font-semibold text-fg">Payment preview only</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                This agent’s payment details are verified, but live paid execution is not enabled yet. No funds will be sent.
              </p>
            </div>
          ) : x402 ? (
            <Button variant="outline" className="w-full" disabled>
              x402 payment preparation only — wallet signing disabled
            </Button>
          ) : !isConnected ? (
            <Button variant="primary" className="w-full" onClick={connect} disabled={loading || processing}>
              <Wallet size={16} aria-hidden="true" /> Connect wallet to pay
            </Button>
          ) : chainId !== network.chainId ? (
            <Button variant="primary" className="w-full" onClick={switchToMainnet} disabled={loading || processing}>
              Switch wallet to {network.name || 'the required network'} ({network.chainId || '—'})
            </Button>
          ) : (
            <Button variant="primary" className="w-full" onClick={handlePay} disabled={!canConfirm}>
              {processing ? 'Waiting for wallet and chain confirmation…' : `Pay ${requirement.amount || ''} ${tokenSymbol} and run task`}
            </Button>
          )}
        </div>
        <p className="mt-2 flex items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-faint">
          <LockKeyhole size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          The payment button is the explicit confirmation boundary. No wallet request is made while this card is merely rendered.
        </p>
        {processing && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ok">
            <CheckCircle2 size={13} aria-hidden="true" /> Waiting for a confirmed receipt before calling the external agent.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
