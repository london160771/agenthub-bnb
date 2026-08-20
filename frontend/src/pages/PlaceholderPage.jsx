import { Hammer } from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

/**
 * Generic scaffold for routes whose full experience lands in a later phase.
 * Keeps the app fully navigable end-to-end from day one.
 */
export default function PlaceholderPage({ eyebrow, title, description, note }) {
  return (
    <Container className="py-10">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="mt-8">
        <EmptyState
          icon={Hammer}
          title="This section is on the way"
          description={
            note ||
            'This part of AgentHub is being built out phase by phase. The navigation and foundation are already in place.'
          }
        />
      </div>
    </Container>
  );
}
