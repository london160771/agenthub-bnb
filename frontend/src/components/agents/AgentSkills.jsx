import { Badge } from '../ui/Badge.jsx';

/**
 * Up to `max` skill chips with a "+N" overflow badge. On small screens the row
 * is capped at `mobileMax` (defaults to `max`) so marketplace cards stay
 * compact — chips beyond the mobile cap, and the desktop overflow badge, are
 * hidden below `sm`; the full set (identical to before) shows from `sm` up.
 */
export function AgentSkills({ skills = [], max = 3, mobileMax = max, className }) {
  if (!skills.length) return null;
  const shown = skills.slice(0, max);
  const desktopExtra = skills.length - shown.length;
  const mobileExtra = skills.length - Math.min(mobileMax, skills.length);
  return (
    <div className={`flex flex-wrap gap-1.5 ${className || ''}`}>
      {shown.map((skill, i) => (
        <Badge
          key={skill}
          variant="neutral"
          className={i >= mobileMax ? 'hidden sm:inline-flex' : undefined}
        >
          {skill}
        </Badge>
      ))}
      {mobileExtra > 0 && (
        <Badge variant="neutral" className="sm:hidden">
          +{mobileExtra}
        </Badge>
      )}
      {desktopExtra > 0 && (
        <Badge variant="neutral" className="hidden sm:inline-flex">
          +{desktopExtra}
        </Badge>
      )}
    </div>
  );
}
