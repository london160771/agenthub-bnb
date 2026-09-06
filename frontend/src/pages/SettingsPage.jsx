import { CheckCircle2, Network, ShieldCheck, Wallet } from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { PageHeader, SectionHeading } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { ConnectWalletButton } from '../components/wallet/ConnectWalletButton.jsx';
import { DEFAULT_CHAIN } from '../config.js';
import { shortAddress } from '../lib/wallet.js';
import { useWallet } from '../context/walletContext.js';

export default function SettingsPage() {
  const { address, chainId, chainLabel, isConnected, isCorrectChain } = useWallet();

  return (
    <Container className="py-8 lg:py-12">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="A small control surface for the settings AgentHub actually supports."
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardBody>
            <SectionHeading title="Wallet session" description="AgentHub only uses the public address supplied by your browser wallet." />
            <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-panel-2 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                  <Wallet size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{isConnected ? shortAddress(address) : 'Not connected'}</p>
                  <p className="mt-0.5 text-xs text-muted">{isConnected ? (chainLabel || `Chain ${chainId}`) : 'Connect only when you are ready to hire.'}</p>
                </div>
              </div>
              <ConnectWalletButton />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              Disconnect clears AgentHub’s local session state. It does not revoke the site from your wallet’s connected-sites list.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionHeading title="Default network" description="The app’s configured network is read-only here." />
            <div className="flex items-center gap-3 rounded-lg border border-ok/25 bg-ok/5 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ok/10 text-ok">
                <Network size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">{DEFAULT_CHAIN.name}</p>
                <p className="mt-0.5 text-xs text-muted">Chain {DEFAULT_CHAIN.id} · {DEFAULT_CHAIN.currency}</p>
              </div>
              <Badge variant="ok" className="ml-auto">Default</Badge>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              Hiring uses the configured BNB Smart Chain Testnet. A connected wallet must match this network before a testnet hire can proceed.
            </p>
            {isConnected && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
                <CheckCircle2 size={13} className={isCorrectChain ? 'text-ok' : 'text-warn'} aria-hidden="true" />
                {isCorrectChain ? 'Your wallet is on the default network.' : 'Your wallet is on a different network.'}
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardBody className="flex items-start gap-3">
          <ShieldCheck size={17} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-fg">What is not here</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">There are no theme, notification, or automatic-payment toggles because those settings are not implemented.</p>
          </div>
        </CardBody>
      </Card>
    </Container>
  );
}
