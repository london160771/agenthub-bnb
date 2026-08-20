import { Container } from '../components/ui/Container.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';

export default function NotFoundPage() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <p className="text-6xl font-black text-brand">404</p>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="max-w-sm text-sm text-muted">
          The page you’re looking for doesn’t exist or may have moved.
        </p>
      </div>
      <ButtonLink to="/">Back to home</ButtonLink>
    </Container>
  );
}
