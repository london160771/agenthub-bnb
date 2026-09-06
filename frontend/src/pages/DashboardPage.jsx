import { ArrowRight, Compass, History, Search, ShieldCheck, WalletCards } from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { PageHeader, SectionHeading } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { AgentGrid } from '../components/marketplace/AgentGrid.jsx';
import { useApi } from '../hooks/useApi.js';
import { listAgents } from '../services/agents.js';
import { CATEGORIES } from '../config.js';
import { isExecutable, isPaymentReady } from '../lib/agentCapability.js';

function SnapshotStat({ label, value, detail }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-fg">{value}</p>
        <p className="mt-1 text-xs text-muted">{detail}</p>
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, error, loading, refetch } = useApi(
    (signal) => listAgents({ limit: 100 }, { signal }),
    [],
  );

  const agents = data?.items || [];
  const executable = agents.filter(isExecutable);
  const paidReady = agents.filter(isPaymentReady);
  const categoriesFound = new Set(agents.map((agent) => agent.category).filter(Boolean)).size;

  return (
    <Container className="py-8 lg:py-12">
      <PageHeader
        eyebrow="Overview"
        title="Your AgentHub workspace"
        description="A quick starting point for discovering agents and following a task from hire to result. Personal history and saved agents stay empty until real records exist."
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Marketplace summary">
        <SnapshotStat
          label="Marketplace"
          value={loading ? '…' : data ? data.total : '—'}
          detail={data ? 'agents in the catalogue' : 'Catalogue unavailable'}
        />
        <SnapshotStat
          label="Ready to run"
          value={loading ? '…' : data ? executable.length : '—'}
          detail={data ? 'verified agents in this view' : 'Waiting for catalogue data'}
        />
        <SnapshotStat
          label="Task areas"
          value={data ? categoriesFound || CATEGORIES.length : '—'}
          detail={data ? 'categories represented' : 'Waiting for catalogue data'}
        />
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        <Card>
          <CardBody>
            <SectionHeading
              title="Start with a real task"
              description="Choose the shortest path to the result you want."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <ButtonLink to="/discover" variant="primary" className="justify-between">
                <span className="inline-flex items-center gap-2"><Compass size={16} /> Browse agents</span>
                <ArrowRight size={15} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to="/find" variant="outline" className="justify-between">
                <span className="inline-flex items-center gap-2"><Search size={16} /> Describe a task</span>
                <ArrowRight size={15} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to="/activity" variant="secondary" className="justify-between">
                <span className="inline-flex items-center gap-2"><History size={16} /> View activity</span>
                <ArrowRight size={15} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to="/settings" variant="secondary" className="justify-between">
                <span className="inline-flex items-center gap-2"><WalletCards size={16} /> Wallet settings</span>
                <ArrowRight size={15} aria-hidden="true" />
              </ButtonLink>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionHeading title="Personal records" description="Only persisted user data appears here." />
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-line bg-panel-2 p-3">
                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-fg">Saved agents</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">No saved-agent store is connected yet.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-line bg-panel-2 p-3">
                <History size={17} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-fg">Recent executions</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">Run a verified agent to create a result record.</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <section className="mt-8">
        <SectionHeading
          title="Ready to try"
          description={paidReady.length > 0 ? `${paidReady.length} paid listing${paidReady.length === 1 ? '' : 's'} also show a verified payment requirement.` : 'Agents with a verified task and result path appear here.'}
          actions={<ButtonLink to="/discover" variant="ghost" size="sm">See all <ArrowRight size={14} /></ButtonLink>}
        />
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : loading ? (
          <AgentGrid loading skeletonCount={3} />
        ) : executable.length > 0 ? (
          <AgentGrid agents={executable.slice(0, 3)} />
        ) : (
          <Card className="border-dashed">
            <CardBody className="py-10 text-center">
              <p className="text-sm font-medium text-fg">No executable agents are available in the current catalogue.</p>
              <p className="mt-1 text-sm text-muted">Browse the full marketplace to inspect catalog and watch-only listings.</p>
              <ButtonLink to="/discover" variant="outline" size="sm" className="mt-4">Browse marketplace</ButtonLink>
            </CardBody>
          </Card>
        )}
      </section>
    </Container>
  );
}
