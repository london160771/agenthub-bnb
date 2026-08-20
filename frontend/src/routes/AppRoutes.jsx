import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import LandingPage from '../pages/LandingPage.jsx';
import PlaceholderPage from '../pages/PlaceholderPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';

/**
 * Every route in the spec is registered now so navigation works end-to-end.
 * Pages arrive phase by phase; until then they render a consistent placeholder.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />

        <Route
          path="/discover"
          element={
            <PlaceholderPage
              eyebrow="Marketplace"
              title="Discover AI Agents"
              description="Find the right agent for any task."
            />
          }
        />
        <Route
          path="/agents/:agentId"
          element={<PlaceholderPage eyebrow="Agent" title="Agent profile" />}
        />
        <Route
          path="/find"
          element={
            <PlaceholderPage
              eyebrow="AI Finder"
              title="Find an Agent"
              description="Describe your task in plain language and let AgentHub recommend agents."
            />
          }
        />
        <Route
          path="/compare"
          element={
            <PlaceholderPage
              eyebrow="Compare"
              title="Compare agents"
              description="Weigh two or three agents side by side."
            />
          }
        />
        <Route
          path="/hire/:agentId"
          element={<PlaceholderPage eyebrow="Hire" title="Hire an agent" />}
        />
        <Route
          path="/execution/:executionId"
          element={<PlaceholderPage eyebrow="Execution" title="Execution" />}
        />
        <Route
          path="/dashboard"
          element={<PlaceholderPage eyebrow="Overview" title="Dashboard" />}
        />
        <Route
          path="/activity"
          element={<PlaceholderPage eyebrow="History" title="Activity" />}
        />
        <Route
          path="/saved"
          element={<PlaceholderPage eyebrow="Bookmarks" title="Saved agents" />}
        />
        <Route
          path="/settings"
          element={<PlaceholderPage eyebrow="Account" title="Settings" />}
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
