import { Link } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import { Card, CardBody } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { AgentAvatar } from '../agents/AgentAvatar.jsx';
import { AgentStatus } from '../agents/AgentStatus.jsx';
import { AgentTrustScore } from '../agents/AgentTrustScore.jsx';
import { SOURCE_LABELS, CATEGORIES } from '../../config.js';

const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;

/**
 * Who you're about to hire. Carries the provenance badge so a seeded demo
 * listing is never presented as verified on-chain fact at the moment of hiring.
 */
export function HireSummary({ agent }) {
  const provenance = SOURCE_LABELS[agent.source];

  return (
    <Card>
      <CardBody className="flex gap-4">
        <AgentAvatar name={agent.name} seed={agent.agentId} src={agent.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <AgentStatus status={agent.status} />
            {provenance && <Badge variant={provenance.variant}>{provenance.label}</Badge>}
            <Badge variant="neutral">{categoryLabel(agent.category)}</Badge>
            {agent.verified && (
              <Badge variant="ok">
                <BadgeCheck size={13} aria-hidden="true" />
                AgentHub-verified
              </Badge>
            )}
          </div>

          <h2 className="mt-2 truncate text-lg font-semibold text-fg">{agent.name}</h2>
          {agent.tagline && <p className="mt-0.5 text-sm text-muted">{agent.tagline}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <AgentTrustScore
              score={agent.trustScore ?? agent.trust?.overall}
              confidence={agent.trust?.confidence}
            />
            <Link
              to={`/agents/${agent.agentId}`}
              className="text-sm text-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
            >
              View full profile
            </Link>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
