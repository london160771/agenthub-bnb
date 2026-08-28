import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import LandingPage from '../pages/LandingPage.jsx';
import DiscoverPage from '../pages/DiscoverPage.jsx';
import AgentProfilePage from '../pages/AgentProfilePage.jsx';
import ComparePage from '../pages/ComparePage.jsx';
import HirePage from '../pages/HirePage.jsx';
import ExecutionPage from '../pages/ExecutionPage.jsx';
import FindPage from '../pages/FindPage.jsx';
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

        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/agents/:agentId" element={<AgentProfilePage />} />
        <Route path="/find" element={<FindPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/hire/:agentId" element={<HirePage />} />
        <Route path="/execution/:executionId" element={<ExecutionPage />} />
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
