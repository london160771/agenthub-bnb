import { ArrowRight, Bookmark, Info } from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export default function SavedPage() {
  return (
    <Container className="py-8 lg:py-12">
      <PageHeader
        eyebrow="Bookmarks"
        title="Saved agents"
        description="Keep a short list of agents you want to revisit."
      />

      <div className="mt-6">
        <EmptyState
          icon={Bookmark}
          title="No saved agents"
          description="There is no saved-agent data connected in this build, so this list stays empty instead of showing invented recommendations."
          action={
            <ButtonLink to="/discover" variant="primary">Explore the marketplace <ArrowRight size={15} /></ButtonLink>
          }
        />
      </div>

      <Card className="mt-5">
        <CardBody className="flex items-start gap-3">
          <Info size={17} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted">
            Saved agents are a personal feature, not marketplace data. No remove or unsave control is shown until a real bookmark store is available.
          </p>
        </CardBody>
      </Card>
    </Container>
  );
}
