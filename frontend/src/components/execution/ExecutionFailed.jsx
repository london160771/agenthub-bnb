import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardBody } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';

/**
 * A failed execution. The spec is explicit that failure must be handled
 * gracefully and never leave the user on a spinner.
 *
 * Retry is safe to offer because a run has no side effects beyond the record: it
 * reads the chain and writes a result. Nothing was charged and nothing was sent,
 * so re-running cannot double anything — the copy says so, so a retry doesn't
 * feel risky.
 */
export function ExecutionFailed({ execution, onRetry, retrying }) {
  return (
    <Card>
      <CardBody className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-bad/10 text-bad">
          <AlertTriangle size={22} aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-lg font-bold tracking-tight text-fg">The task didn&apos;t finish</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          {execution.errorMessage ||
            'The agent stopped before completing. Nothing was charged and nothing was sent on-chain.'}
        </p>

        {onRetry && (
          <div className="mt-5">
            <Button variant="primary" onClick={onRetry} disabled={retrying}>
              <RefreshCw size={15} aria-hidden="true" className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Retrying…' : 'Try again'}
            </Button>
            <p className="mt-2 text-xs text-faint">
              Safe to retry — a run only reads public data. No funds move.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
