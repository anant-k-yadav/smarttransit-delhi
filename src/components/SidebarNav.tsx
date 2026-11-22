import { BarChart3, Database, Map, X } from 'lucide-react';
import type { DatasetSourceType } from '../data/types';

export type WorkspaceSection = 'planner' | 'analytics' | 'dataset';

interface SidebarNavProps {
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  sourceType: 'loading' | 'gtfs_official' | DatasetSourceType;
  stopCount: number;
  routeCount: number;
  matchedRouteCount?: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: WorkspaceSection;
  label: string;
  description: string;
  icon: typeof Map;
}> = [
  {
    id: 'planner',
    label: 'Journey Planner',
    description: 'Bus routes, demand & map',
    icon: Map,
  },
  {
    id: 'analytics',
    label: 'Demand Analytics',
    description: 'Peak vs off-peak & routes',
    icon: BarChart3,
  },
  {
    id: 'dataset',
    label: 'Dataset & Schema',
    description: 'GTFS, matching & caveats',
    icon: Database,
  },
];

export function SidebarNav({
  activeSection,
  onSelectSection,
  sourceType,
  stopCount,
  routeCount,
  matchedRouteCount,
  mobileOpen,
  onCloseMobile,
}: SidebarNavProps) {
  const handleSelect = (section: WorkspaceSection) => {
    onSelectSection(section);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      <div>
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200">
          <a
            href="#main-content"
            onClick={(e) => {
              e.preventDefault();
              handleSelect('planner');
            }}
            className="flex items-center gap-2.5 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 rounded"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-700 text-white font-display font-bold text-sm"
              aria-hidden="true"
            >
              ST
            </span>
            <span className="font-display font-bold text-base tracking-tight whitespace-nowrap">
              SmartTransit Delhi
            </span>
          </a>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 pt-5 pb-2">
          <p className="px-2 text-xs font-medium text-slate-500">
            Transport Stack Hackathon 2026
          </p>
          <p className="px-2 mt-0.5 text-xs text-slate-500">
            Problem 2 · Delhi Bus Planner
          </p>
        </div>

        <nav aria-label="Primary workspace navigation" className="px-3 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  isActive
                    ? 'bg-teal-50 text-teal-900'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    isActive ? 'text-teal-700' : 'text-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-5 whitespace-nowrap">
                    {item.label}
                  </span>
                  <span className="block text-xs text-slate-500 leading-4 mt-0.5 truncate">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-1.5">
        {sourceType === 'loading' ? (
          <>
            <p className="text-xs font-semibold text-slate-800">
              Loading Delhi GTFS + Oct 2026…
            </p>
            <p className="text-xs text-slate-500">
              Preparing bus stops, routes &amp; historical ticketing demand locally
            </p>
          </>
        ) : sourceType === 'gtfs_official' ? (
          <>
            <p className="text-xs font-semibold text-slate-800">
              Delhi GTFS + Oct 2026
            </p>
            <p className="text-xs text-slate-600 tabular-nums">
              {stopCount.toLocaleString()} stops · {routeCount.toLocaleString()} bus routes
            </p>
            {matchedRouteCount !== undefined && (
              <p className="text-[11px] text-slate-500 tabular-nums">
                {matchedRouteCount.toLocaleString()} exact ticketing matches
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-semibold text-slate-800">
              {sourceType === 'synthetic_sample'
                ? 'Active data: Synthetic fallback'
                : 'Active data: Custom JSON'}
            </p>
            <p className="text-xs text-slate-600 tabular-nums">
              {stopCount.toLocaleString()} stops · {routeCount.toLocaleString()} corridors
            </p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0">{navContent}</aside>

      {/* Mobile accessible drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full w-72 max-w-[85vw] shadow-xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
