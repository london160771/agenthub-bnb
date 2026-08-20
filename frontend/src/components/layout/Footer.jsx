import { NavLink } from 'react-router-dom';
import { Logo } from './Logo.jsx';

const FOOTER_LINKS = [
  { label: 'Discover', to: '/discover' },
  { label: 'Find Agent', to: '/find' },
  { label: 'Compare', to: '/compare' },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Activity', to: '/activity' },
  { label: 'Saved', to: '/saved' },
  { label: 'Settings', to: '/settings' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-xs space-y-3">
            <Logo />
            <p className="text-sm text-muted">
              Discover, compare and hire verified AI agents running on BNB Smart Chain.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3" aria-label="Footer">
            {FOOTER_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className="text-muted transition-colors hover:text-fg">
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-8 space-y-1 border-t border-line pt-6 text-xs text-faint">
          <p>
            AgentHub is a hackathon MVP. Metrics labelled “demo” or “seeded” are illustrative and are
            not verified on-chain claims.
          </p>
          <p>© {year} AgentHub · Built for the BNB Chain hackathon.</p>
        </div>
      </div>
    </footer>
  );
}
