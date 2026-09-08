import { AlertTriangle, Download, FlaskConical, Info, Wallet, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardBody } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { SectionHeading } from '../ui/PageHeader.jsx';
import { DEFAULT_CHAIN } from '../../config.js';
import { formatBnb } from '../../lib/format.js';
import { shortAddress } from '../../lib/wallet.js';
import { useWallet } from '../../context/walletContext.js';
import { isExternallyExecutable, isPaidExecutable, paymentChainIdFor } from '../../lib/agentCapability.js';

const PRICING_MODEL_LABELS = {
  'per-task': 'Per task',
  subscription: 'Subscription',
  free: 'Free',
};

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

/**
 * Cost, network, and the wallet gate that must be satisfied before hiring.
 *
 * The gate has four rungs, and the primary button only appears on the last one:
 *   no wallet extension → disconnected → wrong network → ready.
 *
 * Free/local fees are recorded only. A verified paid external agent is routed
 * to a separate payment card; this review panel never opens the wallet.
 */
export function HireConfirmPanel({ agent, submitting, onSubmit, submitError, className }) {
  const {
    hasProvider,
    address,
    chainId,
    isConnected,
    isCorrectChain,
    chainLabel,
    connecting,
    switching,
    error: walletError,
    connect,
    switchToDefaultChain,
    switchToMainnet,
  } = useWallet();

  const price = agent.pricing?.amount ?? 0;
  const external = isExternallyExecutable(agent);
  const paid = isPaidExecutable(agent);
  const x402Paid = paid && agent.paymentProtocol === 'x402';
  // Testnet funds are tBNB; paid agents use the token and settlement network
  // recorded by the backend, which may differ from the identity chain.
  const currency = paid ? (agent.payment?.token || agent.payment?.currency || 'token') : DEFAULT_CHAIN.currency;
  const amount = paid ? agent.payment?.amount : price;
  const free = !paid && amount === 0;
  const paymentChainId = paymentChainIdFor(agent);
  const feeLabel = `${amount == null ? 'Unavailable' : amount} ${currency}`;

  return (
    <Card className={className}>
      <CardBody>
        <SectionHeading title="Review before you run" description="Check the fee, network, and wallet effect before the final action." className="mb-3" />

        <div className="divide-y divide-line">
          <div className="pb-2">
            <Row label="Agent fee">
              <span className="font-mono font-semibold">
                {free ? 'Free' : x402Paid ? feeLabel : formatBnb(amount, currency)}
              </span>
            </Row>
            <Row label="Network fee (gas)">
              <span className="text-faint">{paid ? (x402Paid ? 'Not available until x402 signing is enabled' : 'Wallet estimates before approval') : 'None — nothing is broadcast'}</span>
            </Row>
            <Row label="Pricing model">
              {paid ? 'Per task' : external ? 'Free external service' : PRICING_MODEL_LABELS[agent.pricing?.model] || agent.pricing?.model || '—'}
            </Row>
          </div>

          <div className="py-2">
            <div className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="shrink-0 text-sm font-semibold text-fg">Total</span>
              <span className="text-right font-mono text-base font-bold text-fg">
                {free ? 'Free' : x402Paid ? feeLabel : formatBnb(amount, currency)}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-faint">
              {paid ? 'Payment is required before the task can run.' : 'No funds move at this step.'}
            </p>
          </div>

          <div className="py-2">
            <Row label="Network">
              <Badge variant={paid || external || isCorrectChain ? 'ok' : 'neutral'}>
                {paid ? `${x402Paid ? (agent.payment?.settlementNetwork || 'External settlement') : 'BSC Mainnet'} · ${paymentChainId}` : external ? 'External HTTP · BSC Mainnet data · 56' : `${DEFAULT_CHAIN.name} · ${DEFAULT_CHAIN.id}`}
              </Badge>
            </Row>
            {paid && (
              <>
                {x402Paid && <Row label="ERC-8004 identity">BSC Mainnet · 56</Row>}
                <Row label="Recipient">
                  <span className="break-all font-mono text-xs">{agent.payment?.recipient || 'Unavailable'}</span>
                </Row>
                <Row label="Transfer">{x402Paid ? 'x402 exact payment authorization' : 'One native BNB transfer'}</Row>
                <Row label="Transaction">{x402Paid ? `Settlement on ${agent.payment?.settlementNetwork || 'the verified provider network'}` : 'Real BSC Mainnet transaction'}</Row>
                <Row label="Token approval">{x402Paid ? 'Not specified by provider challenge' : 'Not required'}</Row>
              </>
            )}
            <Row label="Your wallet">
              {isConnected ? (
                <span className="font-mono text-xs">{shortAddress(address)}</span>
              ) : (
                <span className="text-faint">Not connected</span>
              )}
            </Row>
          </div>
        </div>

        {paid && (
          <div className="mt-4 flex gap-2 rounded-lg border border-warn/30 bg-warn/5 p-3">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-muted">
              {x402Paid
                ? 'This provider settles on a Mainnet network. Review the token, amount, recipient, and settlement chain carefully before approving anything.'
                : 'This is a real BSC Mainnet payment. AgentHub will show the exact recipient and amount again before your wallet can approve it.'}
            </p>
          </div>
        )}

        {/* Honesty notice — deliberately prominent, not a footnote. */}
        <div className="mt-4 rounded-lg border border-info/25 bg-info/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-info">
            <FlaskConical size={14} aria-hidden="true" />
              {paid ? 'Paid external task' : external ? 'Free external task' : 'Free testnet run'}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {paid ? (
              x402Paid
                ? <>This review step does <strong className="text-fg">not</strong> open your wallet. The exact x402 challenge is shown above; signing and submission are disabled in this phase.</>
                : <>This review step does <strong className="text-fg">not</strong> open your wallet. The exact native BNB transfer is shown above; only the explicit payment button can open the wallet.</>
            ) : external ? (
              <>Confirming records this hire in AgentHub and running it makes one read-only external HTTP request. It does <strong className="text-fg">not</strong> send a blockchain transaction, ask you to sign, or require payment.</>
            ) : (
              <>Confirming records this hire in AgentHub. It does <strong className="text-fg">not</strong> send a blockchain transaction, you will <strong className="text-fg">not</strong> be asked to sign anything, and no {currency} leaves your wallet.</>
            )}
          </p>
        </div>

        {/* The wallet gate. */}
        <div className="mt-4">
          {x402Paid ? (
            <>
              <Button variant="primary" size="lg" className="w-full" onClick={onSubmit} disabled>
                <Zap size={17} aria-hidden="true" />
                x402 payment preparation only
              </Button>
              <p className="mt-2 text-xs leading-relaxed text-faint">The verified challenge is shown for review. x402 signing and submission are disabled in this phase, so no wallet request can be opened.</p>
            </>
          ) : !hasProvider ? (
            <>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line-strong px-4 text-sm font-semibold text-fg transition-colors hover:bg-panel-2"
              >
                <Download size={16} aria-hidden="true" />
                Install a wallet
              </a>
              {/* A wallet installed after this page loaded isn't picked up until
                  something looks again — so let the user ask, instead of making
                  a reload the only way out. */}
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full"
                onClick={connect}
                disabled={connecting}
              >
                {connecting ? 'Checking…' : 'Already installed? Check again'}
              </Button>
              <p className="mt-2 text-xs leading-relaxed text-faint">
                Hiring records which address the work belongs to, so a browser wallet is required.
              </p>
            </>
          ) : !isConnected ? (
            <>
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={connect}
                disabled={connecting}
              >
                <Wallet size={17} aria-hidden="true" />
                {connecting ? 'Check your wallet…' : 'Connect wallet to continue'}
              </Button>
              <p className="mt-2 text-xs leading-relaxed text-faint">
                Connecting only shares your public address. It gives AgentHub no ability to move
                funds.
              </p>
            </>
          ) : paid && chainId !== paymentChainId ? (
            <>
              <div className="mb-3 flex gap-2 rounded-lg border border-warn/30 bg-warn/5 p-3">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-muted">
                   Your wallet must be on the payment settlement network (chain {paymentChainId}) before a payment request can be opened.
                </p>
              </div>
              <Button variant="primary" size="lg" className="w-full" onClick={switchToMainnet} disabled={switching}>
                {switching ? 'Check your wallet…' : `Switch to payment network (${paymentChainId})`}
              </Button>
            </>
          ) : !external && !paid && !isCorrectChain ? (
            <>
              <div className="mb-3 flex gap-2 rounded-lg border border-warn/30 bg-warn/5 p-3">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-muted">
                  Your wallet is on{' '}
                  <strong className="text-fg">
                    {chainLabel || 'a network AgentHub doesn’t recognise'}
                  </strong>
                  . This built-in agent runs on BSC Testnet, so hiring is disabled until you switch to{' '}
                  {DEFAULT_CHAIN.name}.
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={switchToDefaultChain}
                disabled={switching}
              >
                {switching ? 'Check your wallet…' : `Switch to ${DEFAULT_CHAIN.shortName}`}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={onSubmit}
                disabled={submitting}
              >
                <Zap size={17} aria-hidden="true" />
                {submitting ? 'Preparing…' : paid ? 'Review payment' : external ? 'Run external task' : free ? 'Confirm hire (free)' : 'Confirm hire'}
              </Button>
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-faint">
                <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                 {paid ? 'No wallet request appears until you review and explicitly approve the payment.' : 'No signature request will appear.'}
              </p>
            </>
          )}
        </div>

        {walletError && (
          <p role="alert" className="mt-3 text-xs leading-relaxed text-bad">
            {walletError}
          </p>
        )}
        {submitError && (
          <div role="alert" className="mt-3 rounded-lg border border-bad/30 bg-bad/5 p-3">
            <p className="text-xs leading-relaxed text-bad">{submitError.message}</p>
            {submitError.details?.executionId && (
              <Link
                to={`/execution/${submitError.details.executionId}`}
                className="mt-2 inline-block text-xs font-medium text-brand hover:text-brand-2"
              >
                Open the existing hire →
              </Link>
            )}
          </div>
        )}

        {!external && !paid && DEFAULT_CHAIN.faucet && (
          <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-faint">
            Want test funds in your wallet to see a real balance?{' '}
            <a
              href={DEFAULT_CHAIN.faucet}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand hover:text-brand-2"
            >
              BNB testnet faucet
            </a>
            .
          </p>
        )}
      </CardBody>
    </Card>
  );
}
