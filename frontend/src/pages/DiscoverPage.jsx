import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, SearchX, ChevronLeft, ChevronRight } from 'lucide-react';
import { Container } from '../components/ui/Container.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { SearchBar } from '../components/marketplace/SearchBar.jsx';
import { CategoryTabs } from '../components/marketplace/CategoryTabs.jsx';
import { SortDropdown } from '../components/marketplace/SortDropdown.jsx';
import { FilterPanel } from '../components/marketplace/FilterPanel.jsx';
import { AgentGrid } from '../components/marketplace/AgentGrid.jsx';
import { useApi } from '../hooks/useApi.js';
import { listAgents, getAgentFacets } from '../services/agents.js';
import { DEFAULT_SORT, priceBucketById } from '../lib/marketplace.js';
import { cn } from '../lib/cn.js';

const PAGE_SIZE = 12;

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  // URL is the source of truth for every filter — shareable & back/forward safe.
  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || null;
  const sort = searchParams.get('sort') || DEFAULT_SORT;
  const status = searchParams.get('status') || 'all';
  const verified = searchParams.get('verified') === 'true';
  const trust = searchParams.get('trust') || 'all';
  const success = searchParams.get('success') || 'all';
  const price = searchParams.get('price') || 'all';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const filters = { status, verified, trust, success, price };
  const activeCount = [status !== 'all', verified, trust !== 'all', success !== 'all', price !== 'all'].filter(
    Boolean,
  ).length;

  // Facet counts for the category tabs — loaded once.
  const { data: facets } = useApi((signal) => getAgentFacets({ signal }), []);

  // Agent list — refetched whenever any URL-driven filter changes.
  const { data, error, loading, refetch } = useApi(
    (signal) => {
      const bucket = priceBucketById(price);
      return listAgents(
        {
          q: q || undefined,
          category: category || undefined,
          sort,
          status: status !== 'all' ? status : undefined,
          verified: verified ? true : undefined,
          minTrust: trust !== 'all' ? Number(trust) : undefined,
          minSuccess: success !== 'all' ? Number(success) : undefined,
          minPrice: bucket.min ?? undefined,
          maxPrice: bucket.max ?? undefined,
          page,
          limit: PAGE_SIZE,
        },
        { signal },
      );
    },
    [q, category, sort, status, verified, trust, success, price, page],
  );

  const updateParams = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      for (const [k, v] of Object.entries(patch)) {
        const empty = v == null || v === '' || v === 'all' || v === false;
        if (empty) next.delete(k);
        else next.set(k, String(v));
      }
      if (resetPage && !('page' in patch)) next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const resetFilters = () =>
    updateParams({ status: null, verified: null, trust: null, success: null, price: null });
  const clearAll = () => setSearchParams({}, { replace: true });
  const goPage = (p) => updateParams({ page: p > 1 ? p : null }, { resetPage: false });

  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  let content;
  if (error) {
    content = <ErrorState error={error} onRetry={refetch} />;
  } else if (loading) {
    content = <AgentGrid loading skeletonCount={6} />;
  } else if (!data || data.items.length === 0) {
    content = (
      <EmptyState
        icon={SearchX}
        title="No agents match your filters"
        description="Try broadening your search or clearing some filters to see more agents."
        action={
          <Button variant="outline" onClick={clearAll}>
            Clear all filters
          </Button>
        }
      />
    );
  } else {
    content = <AgentGrid agents={data.items} />;
  }

  return (
    <Container className="py-8 lg:py-12">
      <PageHeader
        eyebrow="Marketplace"
        title="Discover AI Agents"
        description="Browse the AgentHub catalogue on BNB Smart Chain. Prices are in BNB; trust scores are AgentHub's own explainable metric, not a BNB endorsement."
      />

      {/* Search + sort */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <SearchBar value={q} onChange={(text) => updateParams({ q: text })} className="flex-1" />
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="lg:hidden"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filters
            {activeCount > 0 && (
              <span className="rounded-full bg-brand/15 px-1.5 text-xs font-medium text-brand">{activeCount}</span>
            )}
          </Button>
          <SortDropdown value={sort} onChange={(v) => updateParams({ sort: v === DEFAULT_SORT ? null : v })} className="w-full sm:w-56" />
        </div>
      </div>

      {/* Category tabs */}
      <CategoryTabs className="mt-4" value={category} onChange={(id) => updateParams({ category: id })} facets={facets} />

      {/* Sidebar + results */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className={cn('lg:block', showFilters ? 'block' : 'hidden')}>
          <div className="rounded-xl border border-line bg-panel p-4 lg:sticky lg:top-24">
            <FilterPanel filters={filters} onChange={updateParams} onReset={resetFilters} activeCount={activeCount} />
          </div>
        </aside>

        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted">
              {loading ? 'Searching…' : `${total} ${total === 1 ? 'agent' : 'agents'}`}
              {!loading && q && <span className="text-faint"> for “{q}”</span>}
            </p>
          </div>

          {content}

          {!loading && !error && pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>
                <ChevronLeft size={15} aria-hidden="true" />
                Prev
              </Button>
              <span className="text-sm text-muted">
                Page {data.page} of {pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => goPage(page + 1)}>
                Next
                <ChevronRight size={15} aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
