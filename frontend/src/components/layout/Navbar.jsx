import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { NAV_LINKS } from '../../config.js';
import { cn } from '../../lib/cn.js';
import { Logo } from './Logo.jsx';
import { ApiStatus } from '../ui/ApiStatus.jsx';
import { ConnectWalletButton } from '../wallet/ConnectWalletButton.jsx';

const desktopLink = ({ isActive }) =>
  cn('text-sm transition-colors', isActive ? 'text-fg' : 'text-muted hover:text-fg');

const mobileLink = ({ isActive }) =>
  cn(
    'block rounded-lg px-3 py-2.5 text-sm transition-colors',
    isActive ? 'bg-panel-2 text-fg' : 'text-muted hover:text-fg',
  );

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-base/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={desktopLink}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ApiStatus className="hidden lg:inline-flex" />
          <div className="hidden md:block">
            <ConnectWalletButton />
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-fg hover:bg-panel-2 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="space-y-1 border-t border-line bg-panel px-5 py-4 md:hidden" aria-label="Mobile">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={mobileLink} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          <div className="flex items-center justify-between pt-3">
            <ApiStatus />
            <ConnectWalletButton />
          </div>
        </nav>
      )}
    </header>
  );
}
