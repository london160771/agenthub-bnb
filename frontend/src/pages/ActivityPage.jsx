import { ArrowRight, History, Info } from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export default function ActivityPage() {
  return (
    <Container className="py-8 lg:py-12">
      <PageHeader
        eyebrow="History"
        title="Activity"
        description="A record of hires and execution results, kept separate from the public marketplace."
      />

      <div className="mt-6">
        <EmptyState
          icon={History}
          title="No activity yet"
          description="There are no persisted execution records to show. Run an executable agent and its status, task, duration, fee, and result link will belong here."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/discover" variant="primary">Discover an agent <ArrowRight size={15} /></ButtonLink>
              <ButtonLink to="/find" variant="outline">Describe a task</ButtonLink>
            </div>
          }
        />
      </div>

      <Card className="mt-5">
        <CardBody className="flex items-start gap-3">
          <Info size={17} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted">
            This build does not expose a user activity list endpoint, so this page intentionally does not create sample history or pretend that a hire happened.
          </p>
        </CardBody>
      </Card>
    </Container>
  );
}
