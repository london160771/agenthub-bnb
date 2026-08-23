import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Copy, Check, LogOut, Wallet } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { DEFAULT_CHAIN } from '../../config.js';
import { cn } from '../../lib/cn.js';
import { shortAddress } from '../../lib/wallet.js';
import { useWallet } from '../../context/walletContext.js';

/**
 * Real wallet control, backed by the browser's injected EIP-1193 provider.
 *
 * It only ever READS a public address and the current chain id, and can ask the
 * wallet to switch networks. It never requests a signature, never sends a
 * transaction, and cannot move funds.
 *
 * Four states: no wallet installed · disconnected · connected to the wrong
 * network · connected to BNB testnet.
 */
export function ConnectWalletButton({ className }) {
  const {
    hasProvider,
    address,
    isConnected,
    isCorrectChain,
    chainLabel,
    connecting,
    switching,
    error,
    connect,
    disconnect,
    switchToDefaultChain,
  } = useWallet();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef(null);

  // Close the details popover on an outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked by permissions — the full address is shown
      // in the panel anyway, so there is nothing to recover from.
    }
  };

  // 1. No wallet extension in this browser.
  if (!hasProvider) {
    return (
      <div ref={boxRef} className={cn('relative', className)}>
        <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
          <Wallet size={16} aria-hidden="true" />
          No wallet
        </Button>
        {open && (
          <Panel>
            <p className="font-medium text-fg">No browser wallet detected</p>
            <p className="mt-1.5">
              AgentHub reads your public address from a wallet extension such as MetaMask.
            </p>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-block font-medium text-brand hover:text-brand-2"
            >
              Get a wallet →
            </a>
            {/* Nothing re-probes `window.ethereum` on its own, so a wallet installed
                after page load stays invisible until someone looks again. */}
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={connect}
              disabled={connecting}
            >
              {connecting ? 'Checking…' : 'Already installed? Check again'}
            </Button>
            {error && <p className="mt-2 text-bad">{error}</p>}
            <p className="mt-2 text-faint">
              You can browse, compare and evaluate agents without a wallet.
            </p>
          </Panel>
        )}
      </div>
    );
  }

  // 2. Wallet available but not connected.
  if (!isConnected) {
    return (
      <div ref={boxRef} className={cn('relative', className)}>
        <Button variant="primary" size="sm" onClick={connect} disabled={connecting}>
          <Wallet size={16} aria-hidden="true" />
          {connecting ? 'Check wallet…' : 'Connect Wallet'}
        </Button>
        {error && (
          <Panel role="alert">
            <p className="text-bad">{error}</p>
          </Panel>
        )}
      </div>
    );
  }

  // 3 + 4. Connected — the chip reflects whether we're on the expected network.
  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
          isCorrectChain
            ? 'border-line bg-panel-2 text-fg hover:border-line-strong'
            : 'border-bad/40 bg-bad/10 text-bad hover:bg-bad/15',
        )}
      >
        {isCorrectChain ? (
          <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
        ) : (
          <AlertTriangle size={14} aria-hidden="true" />
        )}
        <span className="font-mono text-xs">{shortAddress(address)}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <Panel>
          <p className="text-faint">Connected address</p>
          <p className="mt-1 break-all font-mono text-xs text-fg">{address}</p>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-faint">Network</span>
            {isCorrectChain ? (
              <Badge variant="ok">{DEFAULT_CHAIN.name}</Badge>
            ) : (
              <Badge variant="bad">{chainLabel || 'Unknown network'}</Badge>
            )}
          </div>

          {!isCorrectChain && (
            <div className="mt-3 rounded-lg border border-bad/30 bg-bad/10 p-2.5">
              <p className="text-bad">
                AgentHub is testnet-only. Switch to {DEFAULT_CHAIN.name} to hire an agent.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 w-full"
                onClick={switchToDefaultChain}
                disabled={switching}
              >
                {switching ? 'Check wallet…' : `Switch to ${DEFAULT_CHAIN.shortName}`}
              </Button>
            </div>
          )}

          {error && <p className="mt-3 text-bad">{error}</p>}

          <div className="mt-3 flex gap-2 border-t border-line pt-3">
            <Button variant="ghost" size="sm" className="flex-1" onClick={copyAddress}>
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
            >
              <LogOut size={14} aria-hidden="true" />
              Disconnect
            </Button>
          </div>
          <p className="mt-2 text-faint">
            Disconnecting clears this session only. To fully revoke access, use your wallet&apos;s
            connected-sites settings.
          </p>
        </Panel>
      )}
    </div>
  );
}

function Panel({ children, ...props }) {
  return (
    <div
      className="absolute right-0 top-full z-40 mt-2 w-72 rounded-lg border border-line bg-panel-2 p-3 text-xs leading-relaxed text-muted shadow-xl"
      {...props}
    >
      {children}
    </div>
  );
}
