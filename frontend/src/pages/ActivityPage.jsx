import { ArrowRight, History, Info } from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { ExecutionHistoryList } from '../components/activity/ExecutionHistoryList.jsx';
import { useApi } from '../hooks/useApi.js';
import { listExecutions } from '../services/executions.js';
import { useWallet } from '../context/walletContext.js';

export default function ActivityPage() {
  const { address } = useWallet();
  const { data, error, loading, refetch } = useApi(
    (signal) => address ? listExecutions({ userAddress: address, limit: 20 }, { signal }) : Promise.resolve({ items: [] }),
    [address],
  );
  const items = data?.items || [];

  return (
    <Container className="py-8 lg:py-12">
      <PageHeader
        eyebrow="History"
        title="Activity"
        description="A record of hires and execution results, kept separate from the public marketplace."
      />

      <div className="mt-6">
        {!address ? (
          <EmptyState icon={History} title="Connect to see your activity" description="AgentHub shows completed executions tied to your connected public wallet. No sample history is created." action={<ButtonLink to="/discover" variant="primary">Discover an agent <ArrowRight size={15} /></ButtonLink>} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : loading ? (
          <div className="space-y-3"><Skeleton className="h-28 w-full rounded-xl" /><Skeleton className="h-28 w-full rounded-xl" /></div>
        ) : items.length > 0 ? (
          <ExecutionHistoryList items={items} />
        ) : (
          <EmptyState icon={History} title="No completed activity yet" description="Run a free executable agent and its real result, duration, network, and provenance will appear here." action={<div className="flex flex-wrap justify-center gap-2"><ButtonLink to="/discover" variant="primary">Discover an agent <ArrowRight size={15} /></ButtonLink><ButtonLink to="/find" variant="outline">Describe a task</ButtonLink></div>} />
        )}
      </div>

      <Card className="mt-5">
        <CardBody className="flex items-start gap-3">
          <Info size={17} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted">Only completed records persisted for this connected wallet are shown. Pending or failed attempts stay out of the judge-facing history.</p>
        </CardBody>
      </Card>
    </Container>
  );
}
