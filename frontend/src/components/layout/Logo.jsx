import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn.js';
import { APP_NAME } from '../../config.js';

export function Logo({ className, showText = true }) {
  return (
    <Link
      to="/"
      className={cn('inline-flex items-center gap-2 font-bold tracking-tight', className)}
      aria-label={`${APP_NAME} home`}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-lg font-black text-black">
        A
      </span>
      {showText && <span className="text-[1.05rem]">{APP_NAME}</span>}
    </Link>
  );
}
