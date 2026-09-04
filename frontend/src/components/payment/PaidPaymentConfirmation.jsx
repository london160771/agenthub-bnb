import { AlertTriangle, LockKeyhole } from 'lucide-react';
import { Card, CardBody } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { SectionHeading } from '../ui/PageHeader.jsx';

function valueOrUnavailable(value) {
  return value == null || value === '' ? 'Unavailable' : String(value);
}

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-2 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="break-all text-right text-sm font-medium text-fg">{children}</span>
    </div>
  );
}

/**
 * Generic paid-agent confirmation boundary. The button is intentionally
 * disabled: this component displays a prepared requirement but cannot submit
 * payment or cause a wallet action in Phase 11.3.
 */
export function PaidPaymentConfirmation({ agent, plan, loading = false, error = null }) {
  const requirement = plan?.requirement || {};
  const failed = Boolean(error) || plan?.state === 'FAILED' || plan?.ok === false;
  const missing = plan?.error?.missing || [];

  return (
    <Card>
      <CardBody>
        <SectionHeading
          title="Payment preparation"
          description="Backend metadata only. No payment is submitted in this phase."
          className="mb-3"
        />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant={failed ? 'bad' : 'info'}>{loading ? 'Loading…' : plan?.state || 'Preparing'}</Badge>
          {plan?.provenance?.paymentVerified === false && <Badge variant="warn">Advertised · not verified</Badge>}
        </div>

        {loading ? (
          <p className="text-sm text-muted">Reading the saved payment requirement…</p>
        ) : (
          <>
            <Row label="Agent">{valueOrUnavailable(agent?.name)}</Row>
            <Row label="Protocol">{valueOrUnavailable(plan?.protocol)}</Row>
            <Row label="Network">{valueOrUnavailable(requirement.network?.name)}</Row>
            <Row label="Amount">
              {valueOrUnavailable(requirement.amount)} {valueOrUnavailable(requirement.token?.symbol)}
            </Row>
            <Row label="Recipient / contract">
              {valueOrUnavailable(requirement.recipient || requirement.contract)}
            </Row>
            <Row label="Wallet required">{requirement.requiresWallet ? 'Yes' : 'No / not stated'}</Row>
            <Row label="Mainnet transaction required">
              {requirement.requiresMainnetTx ? 'Yes' : 'No / not stated'}
            </Row>
            <Row label="Effect">{valueOrUnavailable(requirement.effect)}</Row>
            {failed && (
              <div className="mt-3 rounded-lg border border-bad/25 bg-bad/5 p-3 text-sm text-muted">
                <p className="flex items-center gap-1.5 font-medium text-bad">
                  <AlertTriangle size={15} aria-hidden="true" /> Payment preparation stopped
                </p>
                <p className="mt-1">{error?.message || plan?.error?.message || 'The payment requirement is incomplete.'}</p>
                {missing.length > 0 && <p className="mt-1 text-xs text-faint">Missing: {missing.join(', ')}</p>}
              </div>
            )}
          </>
        )}

        <Button disabled variant="outline" className="mt-4 w-full">
          <LockKeyhole size={15} aria-hidden="true" />
          Confirm payment (not enabled)
        </Button>
        <p className="mt-2 text-center text-xs text-faint">
          Confirmation, payment submission, and task execution remain separate future steps.
        </p>
      </CardBody>
    </Card>
  );
}
