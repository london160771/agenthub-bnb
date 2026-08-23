import { createContext, useContext } from 'react';

/**
 * The wallet context object and its consumer hook, deliberately kept in a
 * component-free module: mixing component and non-component exports in one file
 * breaks React Fast Refresh (and the repo's lint rules say so).
 *
 * The provider that fills this in lives in WalletProvider.jsx.
 */
export const WalletContext = createContext(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
