import { CheckCircle2, Clock, Copy, Check, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { Card, CardBody } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Button, ButtonLink } from '../ui/Button.jsx';
import { DEFAULT_CHAIN } from '../../config.js';
import { formatBnb } from '../../lib/format.js';

/**
 * Confirmation after a hire record is created.
 *
 * Careful wording throughout: the hire is *recorded*, the agent has not run and
 * nothing was paid. Overstating this at the moment of success is exactly where a
 * demo becomes dishonest, so the state is called what it is — `pending`.
 */
export function HireSuccess({ agent, execution }) {
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(execution.executionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission can be denied; the id is displayed in full above.
    }
  };

  return (
    <Card>
      <CardBody className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok/10 text-ok">
          <CheckCircle2 size={26} aria-hidden="true" />
        </span>

        <h2 className="mt-4 text-xl font-bold tracking-tight text-fg">Hire recorded</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          <span className="font-medium text-fg">{agent.name}</span> has been queued for your task.
          It hasn&apos;t started running yet.
        </p>

        <div className="mx-auto mt-5 max-w-md rounded-xl border border-line bg-panel-2 p-4 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Execution ID</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-sm text-fg">
              {execution.executionId}
            </code>
            <Button variant="ghost" size="sm" onClick={copyId} aria-label="Copy execution ID">
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            </Button>
          </div>

          <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
            <Detail label="Status">
              <Badge variant="warn">
                <Clock size={12} aria-hidden="true" />
                {execution.status}
              </Badge>
            </Detail>
            <Detail label="Recorded fee">
              <span className="font-mono">
                {formatBnb(execution.cost, DEFAULT_CHAIN.currency)}
              </span>
            </Detail>
            <Detail label="Network">{DEFAULT_CHAIN.name}</Detail>
            <Detail label="Transaction">
              {/* Empty on purpose — no transaction was broadcast, so inventing a
                  hash here would be fabricating on-chain data. */}
              <span className="text-faint">None — payment simulated</span>
            </Detail>
          </dl>

          <p className="mt-3 break-words border-t border-line pt-3 text-xs leading-relaxed text-muted">
            <span className="text-faint">Task: </span>
            {execution.task}
          </p>
        </div>

        <div className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row">
          <ButtonLink
            to={`/execution/${execution.executionId}`}
            variant="primary"
            className="flex-1"
          >
            View execution
          </ButtonLink>
          <ButtonLink to="/discover" variant="secondary" className="flex-1">
            Hire another agent
          </ButtonLink>
        </div>

        <div className="mx-auto mt-5 max-w-md rounded-lg border border-info/25 bg-info/5 p-3 text-left">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-info">
            <FlaskConical size={14} aria-hidden="true" />
            What actually happened
          </p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted">
            <li>
              <strong className="text-fg">Real:</strong> your wallet address and network were read,
              and this hire record was saved in the AgentHub database.
            </li>
            <li>
              <strong className="text-fg">Simulated:</strong> the payment. No transaction was signed
              or broadcast, and no {DEFAULT_CHAIN.currency} moved.
            </li>
            <li>
              <strong className="text-fg">Not yet built:</strong> running the agent and returning a
              result. The execution stays <code className="font-mono">pending</code> until the
              execution phase lands.
            </li>
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}

function Detail({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right text-fg">{children}</dd>
    </div>
  );
}
