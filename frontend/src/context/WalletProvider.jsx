import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHAINS, DEFAULT_CHAIN } from '../config.js';
import { chainParamsFor, parseChainId, toHexChainId, walletErrorMessage } from '../lib/wallet.js';
import { WalletContext } from './walletContext.js';

/**
 * Wallet connection state, shared app-wide.
 *
 * WHAT THIS DOES: talks to the wallet extension the browser injects at
 * `window.ethereum`, using the standard EIP-1193 interface — a small set of
 * named requests every wallet understands. We use exactly five:
 *   - eth_requestAccounts  → ask permission to see the user's address (popup)
 *   - eth_accounts         → read an address we were ALREADY granted (no popup)
 *   - eth_chainId          → which network the wallet is pointed at
 *   - wallet_switchEthereumChain → point the wallet at testnet
 *   - wallet_addEthereumChain    → teach it testnet first, if it needs that
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: it never calls `eth_sendTransaction`,
 * never calls a signing method, and never asks for a private key, seed phrase or
 * password. Connecting a wallet only reveals a public address; it cannot move
 * funds. Nothing in AgentHub spends BNB in this phase.
 *
 * State lives in context rather than in the button because ConnectWalletButton
 * is mounted twice (desktop + mobile navbar) and the hire page has to agree with
 * both of them.
 */

/** The injected provider, or null when no wallet extension is installed. */
function getProvider() {
  return typeof window !== 'undefined' && window.ethereum ? window.ethereum : null;
}

export function WalletProvider({ children }) {
  // Read once at mount. A wallet installed *after* the page loaded won't be seen
  // until something probes again — `connect()` does, so the UI offers that rather
  // than making a reload the only escape.
  const [hasProvider, setHasProvider] = useState(() => Boolean(getProvider()));
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  const readChain = useCallback(async (provider) => {
    const raw = await provider.request({ method: 'eth_chainId' });
    return parseChainId(raw);
  }, []);

  /**
   * Silent restore. `eth_accounts` returns an address only if the user already
   * authorised this site on a previous visit — it never opens a popup, so simply
   * loading a page can't nag. An empty array just means "not connected".
   */
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const accounts = await provider.request({ method: 'eth_accounts' });
        if (cancelled || !Array.isArray(accounts) || accounts.length === 0) return;
        setAddress(accounts[0]);
        const id = await readChain(provider);
        if (!cancelled) setChainId(id);
      } catch {
        // A failed silent probe isn't worth an error message — the user hasn't
        // asked for anything yet. They'll get a real one if `connect` fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [readChain]);

  // Wallets push changes rather than expecting us to poll. Keyed on `hasProvider`
  // so a provider discovered after mount gets its listeners attached too; both are
  // removed on unmount so a hot reload can't stack duplicates.
  useEffect(() => {
    const provider = getProvider();
    if (!provider?.on) return undefined;

    const onAccountsChanged = (accounts) => {
      const next = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null;
      setAddress(next);
      setError(null);
      if (!next) {
        setChainId(null); // wallet locked, or site permission removed
        return;
      }
      // An account arriving back (unlock, or a switch to a different account)
      // comes with no `chainChanged` event, so re-read the network instead of
      // trusting a stale — or cleared — value. `eth_chainId` opens no popup.
      readChain(provider).then(
        (id) => setChainId(id),
        () => {
          /* the next chainChanged or connect will correct it */
        },
      );
    };
    const onChainChanged = (raw) => {
      setChainId(parseChainId(raw));
      setError(null);
    };

    provider.on('accountsChanged', onAccountsChanged);
    provider.on('chainChanged', onChainChanged);
    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged);
      provider.removeListener?.('chainChanged', onChainChanged);
    };
  }, [hasProvider, readChain]);

  /** Explicit user action only — this is what opens the wallet popup. */
  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setHasProvider(false);
      setError('No browser wallet detected. Install one, then reload this page.');
      return null;
    }
    setHasProvider(true);
    setConnecting(true);
    setError(null);
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const next = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null;
      if (!next) {
        setError('Your wallet returned no accounts. Unlock it and try again.');
        return null;
      }
      setAddress(next);
      setChainId(await readChain(provider));
      return next;
    } catch (err) {
      setError(walletErrorMessage(err));
      return null;
    } finally {
      setConnecting(false);
    }
  }, [readChain]);

  /**
   * Ask the wallet to point at BNB testnet. If the wallet has never heard of
   * chain 0x61 it answers with code 4902, and we follow up with an add request
   * carrying the network parameters verified in config.js.
   */
  const switchToDefaultChain = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return false;
    setSwitching(true);
    setError(null);
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: toHexChainId(DEFAULT_CHAIN.id) }],
      });
      setChainId(DEFAULT_CHAIN.id);
      return true;
    } catch (err) {
      if (err?.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [chainParamsFor(DEFAULT_CHAIN)],
          });
          setChainId(await readChain(provider));
          return true;
        } catch (addErr) {
          setError(walletErrorMessage(addErr));
          return false;
        }
      }
      setError(walletErrorMessage(err));
      return false;
    } finally {
      setSwitching(false);
    }
  }, [readChain]);

  /**
   * Clears our own session state. It does NOT revoke the site's authorisation —
   * injected wallets have no standard method for that; the user does it from the
   * wallet's connected-sites screen. The UI says so rather than implying more.
   */
  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(() => {
    const known = Object.values(CHAINS).find((c) => c.id === chainId) || null;
    return {
      hasProvider,
      address,
      chainId,
      chain: known,
      // A readable name for a chain we're on but don't model (e.g. Ethereum).
      chainLabel: known?.name || (chainId != null ? `chain ${chainId}` : null),
      isConnected: Boolean(address),
      isCorrectChain: chainId === DEFAULT_CHAIN.id,
      connecting,
      switching,
      error,
      connect,
      disconnect,
      switchToDefaultChain,
      clearError,
    };
  }, [
    hasProvider,
    address,
    chainId,
    connecting,
    switching,
    error,
    connect,
    disconnect,
    switchToDefaultChain,
    clearError,
  ]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
