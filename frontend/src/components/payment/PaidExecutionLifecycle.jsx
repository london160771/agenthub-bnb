import { CheckCircle2, Circle, LockKeyhole } from 'lucide-react';

const PAID_FLOW_STATES = Object.freeze(['review', 'funded', 'executing', 'settled']);

function protocolDetails(protocol) {
  const normalized = String(protocol || '').trim().toLowerCase();
  if (normalized === 'erc8183') {
    return {
      label: 'ERC-8183',
      fundingLabel: 'Fund escrow',
      fundingDescription: 'Funds are deposited into the commerce contract before the agent executes.',
    };
  }
  if (normalized === 'x402') {
    return {
      label: 'x402',
      fundingLabel: 'Authorize payment',
      fundingDescription: 'The provider challenge authorizes payment for the requested task.',
    };
  }
  if (normalized === 'native-bnb') {
    return {
      label: 'Native BNB',
      fundingLabel: 'Confirm payment',
      fundingDescription: 'A verified native BNB payment is confirmed before the agent executes.',
    };
  }
  return {
    label: protocol ? String(protocol) : 'Payment protocol',
    fundingLabel: 'Authorize payment',
    fundingDescription: 'The verified payment step must complete before the agent executes.',
  };
}

function stepLabel(step, details) {
  if (step === 'review') return 'Review';
  if (step === 'funded') return details.fundingLabel;
  if (step === 'executing') return 'Agent executes';
  return 'Settlement';
}

/**
 * Static paid-flow explainer for preflight, with the same state vocabulary a
 * verified paid executor can use later. It has no wallet or payment callback.
 */
export function PaidExecutionLifecycle({ protocol, currentState = 'review', preflightOnly = false }) {
  const details = protocolDetails(protocol);
  const activeIndex = Math.max(0, PAID_FLOW_STATES.indexOf(currentState));

  return (
    <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3" aria-label="Paid execution flow">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-fg">How paid execution works</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Protocol: <span className="font-medium text-fg">{details.label}</span>
          </p>
        </div>
        {preflightOnly && (
          <span className="inline-flex items-center gap-1 rounded-full border border-warn/30 bg-warn/10 px-2 py-1 text-[11px] font-semibold text-warn">
            <LockKeyhole size={12} aria-hidden="true" />
            Preflight only
          </span>
        )}
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4 sm:gap-2">
        {PAID_FLOW_STATES.map((step, index) => {
          const complete = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li
              key={step}
              className={`min-w-0 rounded-md px-2 py-2 ${
                active
                  ? 'bg-brand/10'
                  : complete
                    ? 'bg-ok/5'
                    : 'bg-panel'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              <div className="flex min-h-9 items-center gap-2 sm:min-h-10 sm:flex-col sm:items-start sm:gap-1.5">
                {complete ? (
                  <CheckCircle2 size={15} className="shrink-0 text-ok" aria-hidden="true" />
                ) : active ? (
                  <span className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-brand text-[9px] font-bold text-black">{index + 1}</span>
                ) : (
                  <Circle size={15} className="shrink-0 text-faint" aria-hidden="true" />
                )}
                <span className={`text-xs leading-snug ${active ? 'font-semibold text-fg' : 'text-muted'}`}>
                  {stepLabel(step, details)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        {details.fundingDescription}
      </p>
    </div>
  );
}
