import { CheckCircle2, ExternalLink, Info } from 'lucide-react';
import { Card, CardBody } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { cn } from '../../lib/cn.js';
import {
  explorerBlockUrl,
  formatMs,
  sourceMeta,
  TONE_VARIANTS,
} from '../../lib/execution.js';

/**
 * The completed result.
 *
 * The design rule here: **every value carries its own provenance badge**. A
 * page-level "some of this is simulated" banner would let a reader assume the
 * one number they care about is the real one. So the label sits on the row, and
 * a simulated value is visually distinct from a chain reading — not a footnote.
 */
export function ExecutionResult({ execution }) {
  const output = execution.output;
  if (!output) return null;

  const { provenance = {}, fields = [], reads = [] } = output;
  const blockUrl = explorerBlockUrl(provenance.explorer, provenance.blockNumber);

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ok/10 text-ok">
              <CheckCircle2 size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ok">
                Task completed in {formatMs(execution.durationMs)}
              </p>
              {/* Headline and summary quote wallet/contract addresses, which are
                  42 unbreakable characters. Without break-words they set a min
                  width that blows the layout out on a phone. */}
              <h2 className="mt-1 break-words text-lg font-bold leading-snug tracking-tight text-fg">
                {output.headline}
              </h2>
              <p className="mt-1.5 break-words text-sm leading-relaxed text-muted">
                {output.summary}
              </p>
            </div>
          </div>

          {output.hasSimulated && (
            <div className="mt-4 flex gap-2 rounded-lg border border-warn/25 bg-warn/5 p-3">
              <Info size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-muted">
                <span className="font-semibold text-warn">Some values below are simulated.</span>{' '}
                They are marked individually. A simulated value is a model, not a reading from the
                blockchain — check the note on each row before acting on it.
              </p>
            </div>
          )}

          <dl className="mt-4 divide-y divide-line border-t border-line">
            {fields.map((field) => (
              <ResultField key={field.key} field={field} />
            ))}
          </dl>

          {Array.isArray(output.tables) && output.tables.length > 0 && (
            <div className="mt-4 space-y-4">
              {output.tables.map((table, ti) => (
                <ResultTable key={table.title || String(ti)} table={table} />
              ))}
            </div>
          )}

          {Array.isArray(output.warnings) && output.warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {output.warnings.map((w, i) => (
                <div
                  key={String(i)}
                  className="flex gap-2 rounded-lg border border-warn/25 bg-warn/5 p-3"
                >
                  <Info size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-muted">{w}</p>
                </div>
              ))}
            </div>
          )}

          {output.recommendation && (
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Recommendation
              </p>
              <p className="mt-1 text-sm leading-relaxed text-fg">{output.recommendation}</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Provenance: what was read, from where, at which block. This is what makes
          the numbers above checkable rather than merely asserted. */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold text-fg">Where this data came from</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <ProvRow label="Network">
              BNB Smart Chain Testnet{' '}
              <span className="text-faint">· chain {provenance.chainId}</span>
            </ProvRow>
            <ProvRow label="RPC node">
              <span className="break-all font-mono text-xs">{provenance.rpcHost}</span>
            </ProvRow>
            <ProvRow label="Block">
              {blockUrl ? (
                <a
                  href={blockUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:underline"
                >
                  #{Number(provenance.blockNumber).toLocaleString('en-US')}
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              ) : (
                <span className="font-mono text-xs">{provenance.blockNumber}</span>
              )}
            </ProvRow>
            <ProvRow label="Read at">
              <span className="font-mono text-xs">
                {provenance.readAt ? new Date(provenance.readAt).toLocaleString('en-US') : '—'}
              </span>
            </ProvRow>
          </dl>

          {reads.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">
                RPC calls made ({reads.length})
              </p>
              <ul className="mt-1.5 space-y-1">
                {reads.map((read, i) => (
                  <li key={`${read.method}-${i}`} className="font-mono text-xs text-muted">
                    <span className="text-info">{read.method}</span>
                    {read.target && (
                      <span className="text-faint">
                        {' '}
                        ({read.target.slice(0, 10)}…{read.target.slice(-6)})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-faint">
                All read-only. Reading a blockchain costs nothing and needs no signature — no
                transaction was created, signed or broadcast by this run.
              </p>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ResultField({ field }) {
  const meta = sourceMeta(field.source);
  const isSimulated = field.source === 'simulated';
  const isUnavailable = field.source === 'unavailable';

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <dt className="flex items-center gap-2 text-sm text-muted">
          {field.label}
          <Badge variant={meta.variant} title={meta.tooltip}>
            {meta.label}
          </Badge>
        </dt>
        <dd
          className={cn(
            'text-right text-sm font-semibold',
            isUnavailable ? 'text-faint' : 'text-fg',
            // A simulated headline number gets a dotted underline: a small,
            // constant visual reminder that it isn't a measurement.
            isSimulated && 'underline decoration-warn/50 decoration-dotted underline-offset-4',
          )}
        >
          {field.tone && TONE_VARIANTS[field.tone] ? (
            <Badge variant={TONE_VARIANTS[field.tone]}>{field.value}</Badge>
          ) : (
            field.value
          )}
        </dd>
      </div>
      {field.note && (
        <p
          className={cn(
            'mt-1 max-w-prose text-xs leading-relaxed',
            isSimulated ? 'text-warn/90' : 'text-faint',
          )}
        >
          {field.note}
        </p>
      )}
    </div>
  );
}

function ProvRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-fg">{children}</dd>
    </div>
  );
}

function normalizeCell(cell) {
  if (cell == null) return { value: '—', source: 'unavailable' };
  if (typeof cell === 'string') return { value: cell, source: 'chain' };
  return cell;
}

function ResultTable({ table }) {
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const title = table.title || 'Table';

  if (columns.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="border-b border-line bg-panel-2 px-3 py-2.5">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {table.note && <p className="mt-1 text-xs leading-relaxed text-faint">{table.note}</p>}
      </div>

      {rows.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted">
          {table.emptyNote || 'No rows to display.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[520px] w-full text-sm">
            <thead className="bg-panel-2">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-faint"
                    title={col.note || undefined}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, ri) => (
                <tr key={String(ri)} className="hover:bg-panel-2/50">
                  {columns.map((col) => {
                    const raw = row[col.key];
                    const cell = normalizeCell(raw);
                    const meta = sourceMeta(cell.source);
                    const isUnavailable = cell.source === 'unavailable';
                    const isSimulated = cell.source === 'simulated';
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2.5 align-top',
                          isUnavailable ? 'text-faint' : 'text-fg',
                          isSimulated && 'underline decoration-warn/50 decoration-dotted underline-offset-4',
                        )}
                        title={cell.note || undefined}
                      >
                        <div className="flex flex-col gap-1">
                          <span
                            className={cn(
                              'break-all text-sm',
                              isUnavailable ? 'font-normal' : 'font-medium',
                              cell.tone && TONE_VARIANTS[cell.tone] && 'inline-flex',
                            )}
                            title={typeof cell.value === 'string' ? cell.value : undefined}
                          >
                            {cell.tone && TONE_VARIANTS[cell.tone] ? (
                              <Badge variant={TONE_VARIANTS[cell.tone]}>{cell.value}</Badge>
                            ) : (
                              cell.value
                            )}
                          </span>
                          <span className="inline-flex">
                            <Badge variant={meta.variant} title={meta.tooltip} className="text-[10px] leading-none">
                              {meta.label}
                            </Badge>
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
