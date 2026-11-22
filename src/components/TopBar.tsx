import { Database, Menu } from 'lucide-react';
import type { WorkspaceSection } from './SidebarNav';

interface TopBarProps {
  activeSection: WorkspaceSection;
  onOpenMobileMenu: () => void;
  onPrimaryAction: () => void;
}

const SECTION_TITLES: Record<WorkspaceSection, string> = {
  planner: 'Delhi Bus Journey Planner',
  analytics: 'Historical Demand Analytics',
  dataset: 'Dataset & Schema',
};

export function TopBar({
  activeSection,
  onOpenMobileMenu,
  onPrimaryAction,
}: TopBarProps) {
  const isDatasetView = activeSection === 'dataset';

  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-700"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-slate-500 whitespace-nowrap shrink-0">
            SmartTransit Delhi
          </span>
          <span className="hidden sm:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="font-display font-semibold text-slate-900 truncate">
            {SECTION_TITLES[activeSection]}
          </span>
        </nav>
      </div>

      <div className="shrink-0">
        <button
          type="button"
          onClick={onPrimaryAction}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          {!isDatasetView && <Database className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>
            {isDatasetView ? (
              'Open Journey Planner'
            ) : (
              <>
                <span className="sm:hidden">Dataset Info</span>
                <span className="hidden sm:inline">Dataset &amp; Methodology</span>
              </>
            )}
          </span>
        </button>
      </div>
    </header>
  );
}
