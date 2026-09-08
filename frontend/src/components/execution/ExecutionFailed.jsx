import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardBody } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';

/**
 * A failed execution. The spec is explicit that failure must be handled
 * gracefully and never leave the user on a spinner.
 *
 * Free/local retry is safe because it only reads data. Paid retries are not
 * offered here: Sentinels Audit redeems each payment transaction hash once.
 */
export function ExecutionFailed({ execution, onRetry, retrying, paymentStatus = 'none' }) {
  const paymentSensitive = paymentStatus !== 'none';
  const paid = paymentStatus === 'confirmed';
  return (
    <Card>
      <CardBody className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-bad/10 text-bad">
          <AlertTriangle size={22} aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-lg font-bold tracking-tight text-fg">The task didn&apos;t finish</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          {execution.errorMessage || (paid
            ? 'The paid provider did not return a result. Do not retry payment automatically; review the confirmed transaction and provider status.'
            : paymentSensitive
              ? 'Payment status is uncertain. Do not retry payment automatically; review the execution and wallet activity first.'
              : 'The free read-only agent stopped before completing. No payment was required and nothing was sent on-chain.')}
        </p>

        {onRetry && !paymentSensitive && (
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
