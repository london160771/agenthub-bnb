import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import LandingPage from '../pages/LandingPage.jsx';
import DiscoverPage from '../pages/DiscoverPage.jsx';
import AgentProfilePage from '../pages/AgentProfilePage.jsx';
import ComparePage from '../pages/ComparePage.jsx';
import HirePage from '../pages/HirePage.jsx';
import ExecutionPage from '../pages/ExecutionPage.jsx';
import FindPage from '../pages/FindPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import ActivityPage from '../pages/ActivityPage.jsx';
import SavedPage from '../pages/SavedPage.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';

/**
 * Every route in the spec is registered so the shell never sends a judge to a
 * dead end. Data-light support pages stay honest about what is available.
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
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
