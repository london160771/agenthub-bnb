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
 * The fee shown here is recorded on the hire record. It is NOT charged: this
 * build sends no transaction and asks for no signature. That is stated in the
 * panel itself, not just in documentation.
 */
export function HireConfirmPanel({ agent, submitting, onSubmit, submitError, className }) {
  const {
    hasProvider,
    address,
    isConnected,
    isCorrectChain,
    chainLabel,
    connecting,
    switching,
    error: walletError,
    connect,
    switchToDefaultChain,
  } = useWallet();

  const price = agent.pricing?.amount ?? 0;
  const free = price === 0;
  // Testnet funds are tBNB, not BNB — labelling them "BNB" would be misleading.
  const currency = DEFAULT_CHAIN.currency;

  return (
    <Card className={className}>
      <CardBody>
        <SectionHeading title="Review and confirm" className="mb-3" />

        <div className="divide-y divide-line">
          <div className="pb-2">
            <Row label="Agent fee">
              <span className="font-mono font-semibold">
                {free ? 'Free' : formatBnb(price, currency)}
              </span>
            </Row>
            {/* Spec §12 asks for a fee breakdown. The honest network fee in this
                build is nothing, because no transaction is broadcast — so it is
                stated as none rather than filled with a plausible gas estimate. */}
            <Row label="Network fee (gas)">
              <span className="text-faint">None — nothing is broadcast</span>
            </Row>
            <Row label="Pricing model">
              {PRICING_MODEL_LABELS[agent.pricing?.model] || agent.pricing?.model || '—'}
            </Row>
          </div>

          <div className="py-2">
            <div className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="shrink-0 text-sm font-semibold text-fg">Total</span>
              <span className="text-right font-mono text-base font-bold text-fg">
                {free ? 'Free' : formatBnb(price, currency)}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-faint">
              Recorded on the hire, not charged to your wallet.
            </p>
          </div>

          <div className="py-2">
            <Row label="Network">
              <Badge variant={isCorrectChain ? 'ok' : 'neutral'}>
                {DEFAULT_CHAIN.name} · {DEFAULT_CHAIN.id}
              </Badge>
            </Row>
            <Row label="Your wallet">
              {isConnected ? (
                <span className="font-mono text-xs">{shortAddress(address)}</span>
              ) : (
                <span className="text-faint">Not connected</span>
              )}
            </Row>
          </div>
        </div>

        {/* Honesty notice — deliberately prominent, not a footnote. */}
        <div className="mt-4 rounded-lg border border-info/25 bg-info/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-info">
            <FlaskConical size={14} aria-hidden="true" />
            Simulated payment
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Confirming records this hire in AgentHub. It does <strong className="text-fg">not</strong>{' '}
            send a blockchain transaction, you will <strong className="text-fg">not</strong> be asked
            to sign anything, and no {currency} leaves your wallet. The fee above is what this agent
            would charge.
          </p>
        </div>

        {/* The wallet gate. */}
        <div className="mt-4">
          {!hasProvider ? (
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
          ) : !isCorrectChain ? (
            <>
              <div className="mb-3 flex gap-2 rounded-lg border border-warn/30 bg-warn/5 p-3">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-muted">
                  Your wallet is on{' '}
                  <strong className="text-fg">
                    {chainLabel || 'a network AgentHub doesn’t recognise'}
                  </strong>
                  . AgentHub is testnet-only, so hiring is disabled until you switch to{' '}
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
                {submitting ? 'Creating hire…' : free ? 'Confirm hire (free)' : 'Confirm hire'}
              </Button>
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-faint">
                <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                No signature request will appear.
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

        {DEFAULT_CHAIN.faucet && (
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
