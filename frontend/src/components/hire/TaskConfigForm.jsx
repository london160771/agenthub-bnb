import { ChevronDown, Wallet } from 'lucide-react';
import { Card, CardBody } from '../ui/Card.jsx';
import { SectionHeading } from '../ui/PageHeader.jsx';
import { Input, Textarea, Select, Label } from '../ui/Input.jsx';
import { cn } from '../../lib/cn.js';
import { fieldsFor } from '../../lib/hire.js';

/**
 * Renders the task configuration form for an agent's category.
 *
 * There is no per-category branching here: `fieldsFor(agent)` returns the field
 * descriptors from lib/hire.js and this component knows only how to draw the
 * five field types. Adding a category means adding data, not JSX.
 */
export function TaskConfigForm({ agent, values, errors, onChange, walletAddress, disabled }) {
  const fields = fieldsFor(agent);

  return (
    <Card>
      <CardBody>
        <SectionHeading
          title="Configure the task"
          description="These answers are passed to the agent as its input."
        />
        {/* space-y rather than a grid: one question per row reads the same at
            390px and on desktop, so nothing needs to reflow. */}
        <div className="space-y-5">
          {fields.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={values[field.key] ?? ''}
              error={errors[field.key]}
              onChange={(v) => onChange(field.key, v)}
              walletAddress={walletAddress}
              disabled={disabled}
            />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function Field({ field, value, error, onChange, walletAddress, disabled }) {
  const id = `hire-${field.key}`;
  const describedBy = [error ? `${id}-error` : null, field.help ? `${id}-help` : null]
    .filter(Boolean)
    .join(' ');

  const invalid = cn(error && 'border-bad/60 focus:border-bad');
  const common = {
    id,
    value,
    disabled,
    onChange: (e) => onChange(e.target.value),
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy || undefined,
  };

  // Only fields that actually mean "a wallet" get the shortcut. A token-contract
  // address is also `type: 'address'`, and offering your own address there would
  // be nonsense advice.
  const canUseWallet =
    field.wallet && walletAddress && value.toLowerCase() !== walletAddress.toLowerCase();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>
          {field.label}
          {!field.required && <span className="ml-1.5 font-normal text-faint">optional</span>}
        </Label>
        {canUseWallet && (
          <button
            type="button"
            onClick={() => onChange(walletAddress)}
            disabled={disabled}
            className="mb-1.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-brand-2 disabled:opacity-50"
          >
            <Wallet size={12} aria-hidden="true" />
            Use my wallet
          </button>
        )}
      </div>

      {field.type === 'select' ? (
        <div className="relative">
          <Select {...common} className={invalid}>
            <option value="">Choose…</option>
            {(field.options || []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
          />
        </div>
      ) : field.type === 'textarea' ? (
        <>
          <Textarea
            {...common}
            className={invalid}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
          />
          {field.maxLength && (
            <p className="mt-1 text-right text-xs text-faint">
              {String(value).length}/{field.maxLength}
            </p>
          )}
        </>
      ) : field.type === 'number' ? (
        <div className="relative">
          <Input
            {...common}
            type="number"
            inputMode="decimal"
            min={field.min}
            max={field.max}
            step={field.step}
            placeholder={field.placeholder}
            className={cn(invalid, field.unit && 'pr-16')}
          />
          {field.unit && (
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-faint">
              {field.unit}
            </span>
          )}
        </div>
      ) : (
        <Input
          {...common}
          type="text"
          // Addresses are long hex strings: mono font, no autocorrect meddling.
          autoComplete="off"
          spellCheck={field.type === 'address' ? false : undefined}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          className={cn(invalid, field.type === 'address' && 'font-mono text-xs sm:text-sm')}
        />
      )}

      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-bad">
          {error}
        </p>
      ) : (
        field.help && (
          <p id={`${id}-help`} className="mt-1.5 text-xs leading-relaxed text-faint">
            {field.help}
          </p>
        )
      )}
    </div>
  );
}
