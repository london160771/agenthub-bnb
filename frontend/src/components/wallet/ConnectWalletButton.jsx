import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { DEFAULT_CHAIN } from '../../config.js';

/**
 * Placeholder wallet control for the foundation phase. It renders the real
 * navbar affordance and network label, but actual wagmi/viem connection logic
 * is wired up in the wallet phase. Kept honest: it does not fake a connection.
 */
export function ConnectWalletButton({ className }) {
  const [showNote, setShowNote] = useState(false);

  return (
    <div className={`relative ${className || ''}`}>
      <Button variant="primary" size="sm" onClick={() => setShowNote((v) => !v)}>
        <Wallet size={16} aria-hidden="true" />
        Connect Wallet
      </Button>
      {showNote && (
        <div
          role="status"
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-line bg-panel-2 p-3 text-xs leading-relaxed text-muted shadow-xl"
        >
          Wallet connection ({DEFAULT_CHAIN.name}) is enabled in the wallet phase. You can browse
          and compare agents now.
        </div>
      )}
    </div>
  );
}
