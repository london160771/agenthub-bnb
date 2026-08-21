import { Badge } from '../ui/Badge.jsx';

/** Up to `max` skill chips, with a "+N" overflow badge. */
export function AgentSkills({ skills = [], max = 3, className }) {
  if (!skills.length) return null;
  const shown = skills.slice(0, max);
  const extra = skills.length - shown.length;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className || ''}`}>
      {shown.map((skill) => (
        <Badge key={skill} variant="neutral">
          {skill}
        </Badge>
      ))}
      {extra > 0 && <Badge variant="neutral">+{extra}</Badge>}
    </div>
  );
}
