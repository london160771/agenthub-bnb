import { NavLink } from 'react-router-dom';
import { Activity, Compass, Home, Sparkles, User } from 'lucide-react';
import { MOBILE_NAV } from '../../config.js';
import { cn } from '../../lib/cn.js';

const ICONS = { home: Home, compass: Compass, sparkles: Sparkles, activity: Activity, user: User };

/** Fixed bottom tab bar shown on small screens only. */
export function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-line bg-panel/95 backdrop-blur md:hidden"
      aria-label="Mobile navigation"
    >
      {MOBILE_NAV.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium transition-colors',
                isActive ? 'text-brand' : 'text-faint hover:text-muted',
              )
            }
          >
            <Icon size={20} aria-hidden="true" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
