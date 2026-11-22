import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Database, Map as MapIcon } from 'lucide-react';
import { loadGtfsCoreIndex } from './data/gtfsLoader';
import type {
  GtfsIndex,
  GtfsJourneyPlanResult,
  GtfsJourneyRequest,
} from './data/gtfsTypes';
import { SYNTHETIC_SAMPLE_DATASET } from './data/syntheticSample';
import type {
  JourneyPlanRequest,
  JourneyPlanResult,
  SmartTransitDataset,
} from './data/types';
import { planGtfsJourneys } from './engine/gtfsEngine';
import { getAvailableSamplePairs, planJourneys } from './engine/journeyPlanner';
import { CrowdingAnalyticsView } from './components/CrowdingAnalyticsView';
import { DataBanner } from './components/DataBanner';
import { DatasetSchemaView } from './components/DatasetSchemaView';
import { JourneyComparisonList } from './components/JourneyComparisonList';
import { JourneySearchForm } from './components/JourneySearchForm';
import { SidebarNav } from './components/SidebarNav';
import type { WorkspaceSection } from './components/SidebarNav';
import { TopBar } from './components/TopBar';
import { TransitMap } from './components/TransitMap';

const DEFAULT_GTFS_REQUEST: GtfsJourneyRequest = {
  originStopId: '',
  destinationStopId: '',
  travelDate: '2026-10-15',
  travelTime: '09:00',
  priority: 'balanced',
  agencyFilter: 'all',
};

const DEFAULT_SYNTHETIC_REQUEST: JourneyPlanRequest = {
  originStopId: 'stop-rajiv-chowk',
  destinationStopId: 'stop-hauz-khas',
  travelDate: '2026-10-15',
  travelTime: '09:00',
  priority: 'balanced',
  modeFilter: 'all',
};

export default function App() {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('planner');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Real GTFS + Oct 2026 ticketing dataset state
  const [gtfsIndex, setGtfsIndex] = useState<GtfsIndex | null>(null);
  const [gtfsLoading, setGtfsLoading] = useState(true);
  const [gtfsError, setGtfsError] = useState<string | null>(null);
  const [usingSyntheticFallback, setUsingSyntheticFallback] = useState(false);

  const [gtfsRequest, setGtfsRequest] = useState<GtfsJourneyRequest>(DEFAULT_GTFS_REQUEST);
  const [gtfsResult, setGtfsResult] = useState<GtfsJourneyPlanResult | null>(null);
  const [selectedGtfsOptionId, setSelectedGtfsOptionId] = useState<string | null>(null);

  // Synthetic / custom JSON fallback state
  const [syntheticDataset, setSyntheticDataset] = useState<SmartTransitDataset>(
    SYNTHETIC_SAMPLE_DATASET
  );
  const [syntheticRequest, setSyntheticRequest] = useState<JourneyPlanRequest>(
    DEFAULT_SYNTHETIC_REQUEST
  );
  const [syntheticResult, setSyntheticResult] = useState<JourneyPlanResult | null>(() =>
    planJourneys(SYNTHETIC_SAMPLE_DATASET, DEFAULT_SYNTHETIC_REQUEST)
  );
  const [selectedCorridorId, setSelectedCorridorId] = useState<string | null>(() => {
    const initial = planJourneys(SYNTHETIC_SAMPLE_DATASET, DEFAULT_SYNTHETIC_REQUEST);
    return initial.options[0]?.corridor.id ?? null;
  });

  const [isSearching, setIsSearching] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string>('');
  const searchTimerRef = useRef<number | null>(null);

  const executeGtfsPlan = useCallback(
    (
      nextReq: GtfsJourneyRequest,
      index: GtfsIndex,
      withLoading = false,
      announceStatus = true
    ) => {
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
      }

      const run = () => {
        const res = planGtfsJourneys(index, nextReq);
        setGtfsResult(res);
        setSelectedGtfsOptionId(res.options[0]?.id ?? null);
        setIsSearching(false);

        if (announceStatus) {
          if (res.status === 'ok') {
            setLiveStatus(
              `Found ${res.options.length} Delhi bus route ${
                res.options.length === 1 ? 'option' : 'options'
              }.`
            );
          } else if (res.status === 'validation_error') {
            setLiveStatus(res.errorMessage ?? 'Please fix journey inputs.');
          } else {
            setLiveStatus('No matching direct or 1-transfer bus routes found.');
          }
        }
      };

      if (withLoading) {
        setIsSearching(true);
        searchTimerRef.current = window.setTimeout(run, 80);
      } else {
        run();
      }
    },
    []
  );

  const loadOfficialData = useCallback(
    async (forceReload = false) => {
      setGtfsLoading(true);
      setGtfsError(null);
      try {
        const index = await loadGtfsCoreIndex(forceReload);
        setGtfsIndex(index);
        setUsingSyntheticFallback(false);

        const defaultPair = index.samplePairs[0];
        const initialReq: GtfsJourneyRequest = {
          ...DEFAULT_GTFS_REQUEST,
          originStopId: defaultPair?.originStopId ?? index.stops[0]?.stopId ?? '',
          destinationStopId: defaultPair?.destinationStopId ?? index.stops[1]?.stopId ?? '',
        };
        setGtfsRequest(initialReq);
        if (initialReq.originStopId && initialReq.destinationStopId) {
          executeGtfsPlan(initialReq, index, false, false);
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load local GTFS & ticketing dataset.';
        setGtfsError(msg);
      } finally {
        setGtfsLoading(false);
      }
    },
    [executeGtfsPlan]
  );

  useEffect(() => {
    void loadOfficialData(false);
    return () => {
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, [loadOfficialData]);

  // ==================== GTFS HANDLERS ====================
  const handleGtfsRequestChange = (next: GtfsJourneyRequest) => {
    setGtfsRequest(next);
    if (!gtfsIndex) return;

    const autoReplan =
      next.priority !== gtfsRequest.priority ||
      next.agencyFilter !== gtfsRequest.agencyFilter ||
      next.travelDate !== gtfsRequest.travelDate ||
      next.travelTime !== gtfsRequest.travelTime ||
      (next.originStopId !== '' &&
        next.destinationStopId !== '' &&
        (next.originStopId !== gtfsRequest.originStopId ||
          next.destinationStopId !== gtfsRequest.destinationStopId));

    if (autoReplan && next.originStopId && next.destinationStopId) {
      executeGtfsPlan(next, gtfsIndex, false);
    }
  };

  const handleGtfsSubmit = () => {
    if (!gtfsIndex) return;
    executeGtfsPlan(gtfsRequest, gtfsIndex, true);
  };

  const handleGtfsReset = () => {
    setGtfsRequest((prev) => ({
      ...prev,
      originStopId: '',
      destinationStopId: '',
      agencyFilter: 'all',
    }));
    setGtfsResult(null);
    setSelectedGtfsOptionId(null);
    setLiveStatus('Cleared bus journey selection.');
  };

  const handleLoadGtfsSampleQuery = () => {
    if (!gtfsIndex) return;
    const firstPair = gtfsIndex.samplePairs[0];
    const nextReq: GtfsJourneyRequest = {
      ...gtfsRequest,
      originStopId: firstPair?.originStopId ?? gtfsIndex.stops[0]?.stopId ?? '',
      destinationStopId: firstPair?.destinationStopId ?? gtfsIndex.stops[1]?.stopId ?? '',
      agencyFilter: 'all',
    };
    setGtfsRequest(nextReq);
    executeGtfsPlan(nextReq, gtfsIndex, true);
  };

  const handleResetAgencyFilter = () => {
    if (!gtfsIndex) return;
    const nextReq: GtfsJourneyRequest = {
      ...gtfsRequest,
      agencyFilter: 'all',
    };
    setGtfsRequest(nextReq);
    executeGtfsPlan(nextReq, gtfsIndex, false);
  };

  const selectedGtfsOption = useMemo(() => {
    if (!gtfsResult || gtfsResult.status !== 'ok') return null;
    return (
      gtfsResult.options.find((opt) => opt.id === selectedGtfsOptionId) ??
      gtfsResult.options[0] ??
      null
    );
  }, [gtfsResult, selectedGtfsOptionId]);

  // ==================== SYNTHETIC FALLBACK HANDLERS ====================
  const availableSyntheticPairs = useMemo(
    () => getAvailableSamplePairs(syntheticDataset),
    [syntheticDataset]
  );

  const executeSyntheticPlan = useCallback(
    (nextReq: JourneyPlanRequest, activeDataset: SmartTransitDataset, withLoading = false) => {
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
      }
      const run = () => {
        const nextResult = planJourneys(activeDataset, nextReq);
        setSyntheticResult(nextResult);
        setSelectedCorridorId(nextResult.options[0]?.corridor.id ?? null);
        setIsSearching(false);
      };
      if (withLoading) {
        setIsSearching(true);
        searchTimerRef.current = window.setTimeout(run, 120);
      } else {
        run();
      }
    },
    []
  );

  const handleSyntheticRequestChange = (next: JourneyPlanRequest) => {
    setSyntheticRequest(next);
    const changed =
      next.priority !== syntheticRequest.priority ||
      next.modeFilter !== syntheticRequest.modeFilter ||
      next.travelTime !== syntheticRequest.travelTime ||
      next.travelDate !== syntheticRequest.travelDate;
    if (changed && syntheticResult !== null && next.originStopId && next.destinationStopId) {
      executeSyntheticPlan(next, syntheticDataset, false);
    }
  };

  const selectedSyntheticOption = useMemo(() => {
    if (!syntheticResult || syntheticResult.status !== 'ok') return null;
    return (
      syntheticResult.options.find((opt) => opt.corridor.id === selectedCorridorId) ??
      syntheticResult.options[0] ??
      null
    );
  }, [syntheticResult, selectedCorridorId]);

  const isGtfsActive = Boolean(gtfsIndex) && !usingSyntheticFallback;
  const sidebarSourceType =
    gtfsLoading && !gtfsIndex && !usingSyntheticFallback
      ? 'loading'
      : isGtfsActive
        ? 'gtfs_official'
        : syntheticDataset.metadata.sourceType;

  const handleSelectSection = (section: WorkspaceSection) => {
    setActiveSection(section);
    if (section !== 'planner') {
      setLiveStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-teal-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <SidebarNav
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        sourceType={sidebarSourceType}
        stopCount={
          isGtfsActive && gtfsIndex
            ? gtfsIndex.stops.length
            : syntheticDataset.stops.length
        }
        routeCount={
          isGtfsActive && gtfsIndex
            ? gtfsIndex.routes.length
            : syntheticDataset.corridors.length
        }
        matchedRouteCount={
          isGtfsActive && gtfsIndex ? gtfsIndex.demandByRouteId.size : undefined
        }
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onPrimaryAction={() =>
            handleSelectSection(activeSection === 'dataset' ? 'planner' : 'dataset')
          }
        />

        <nav
          aria-label="Mobile section navigation"
          className="lg:hidden bg-white border-b border-slate-200 px-3 py-1.5 grid grid-cols-3 gap-1.5"
        >
          {(
            [
              { id: 'planner', shortLabel: 'Planner', fullLabel: 'Journey Planner', icon: MapIcon },
              { id: 'analytics', shortLabel: 'Analytics', fullLabel: 'Demand Analytics', icon: BarChart3 },
              { id: 'dataset', shortLabel: 'Dataset', fullLabel: 'Dataset & Schema', icon: Database },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectSection(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                  active
                    ? 'bg-teal-50 text-teal-900 border border-teal-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-teal-700' : 'text-slate-500'}`}
                  aria-hidden="true"
                />
                <span className="sm:hidden truncate">{tab.shortLabel}</span>
                <span className="hidden sm:inline truncate">{tab.fullLabel}</span>
              </button>
            );
          })}
        </nav>

        <main
          id="main-content"
          className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 sm:space-y-6"
        >
          <DataBanner
            gtfsIndex={gtfsIndex}
            gtfsLoading={gtfsLoading}
            gtfsError={gtfsError}
            syntheticMetadata={syntheticDataset.metadata}
            usingSyntheticFallback={usingSyntheticFallback}
            onInspectDataset={() => handleSelectSection('dataset')}
            onRetryGtfsLoad={() => void loadOfficialData(true)}
          />

          {activeSection === 'planner' && (
            <div className="space-y-6">
              {gtfsLoading && !gtfsIndex ? (
                <div className="space-y-6">
                  <div className="rounded-xl bg-white border border-slate-200 p-6 animate-pulse space-y-4">
                    <div className="h-6 w-72 rounded bg-slate-200" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="h-11 rounded-lg bg-slate-100" />
                      <div className="h-11 rounded-lg bg-slate-100" />
                      <div className="h-11 rounded-lg bg-slate-100" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    <div className="xl:col-span-7 space-y-3">
                      {[0, 1].map((i) => (
                        <div
                          key={i}
                          className="h-44 rounded-xl bg-white border border-slate-200 animate-pulse"
                        />
                      ))}
                    </div>
                    <div className="xl:col-span-5 h-[400px] rounded-xl bg-white border border-slate-200 animate-pulse" />
                  </div>
                </div>
              ) : gtfsError && !gtfsIndex && !usingSyntheticFallback ? (
                <section className="rounded-xl bg-white border border-slate-200 p-8 text-center space-y-4">
                  <h2 className="text-base font-display font-semibold text-slate-900">
                    Unable to load Delhi GTFS &amp; ticketing files
                  </h2>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">
                    {gtfsError}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => void loadOfficialData(true)}
                      className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                    >
                      Retry loading GTFS dataset
                    </button>
                  </div>
                </section>
              ) : isGtfsActive && gtfsIndex ? (
                <>
                  <JourneySearchForm
                    mode="gtfs"
                    gtfsIndex={gtfsIndex}
                    request={gtfsRequest}
                    isLoading={isSearching}
                    validationError={
                      gtfsResult?.status === 'validation_error'
                        ? gtfsResult.errorMessage
                        : undefined
                    }
                    onChangeRequest={handleGtfsRequestChange}
                    onSubmit={handleGtfsSubmit}
                    onReset={handleGtfsReset}
                  />

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    <div className="xl:col-span-7">
                      <JourneyComparisonList
                        mode="gtfs"
                        gtfsIndex={gtfsIndex}
                        result={gtfsResult}
                        selectedOptionId={selectedGtfsOption?.id ?? null}
                        isLoading={isSearching}
                        statusAnnouncement={liveStatus}
                        onSelectOption={setSelectedGtfsOptionId}
                        onLoadSampleQuery={handleLoadGtfsSampleQuery}
                        onResetAgencyFilter={handleResetAgencyFilter}
                      />
                    </div>
                    <div className="xl:col-span-5 xl:sticky xl:top-22">
                      <TransitMap
                        mode="gtfs"
                        gtfsIndex={gtfsIndex}
                        selectedOption={selectedGtfsOption}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <JourneySearchForm
                    mode="synthetic"
                    stops={syntheticDataset.stops}
                    request={syntheticRequest}
                    availablePairs={availableSyntheticPairs}
                    isLoading={isSearching}
                    validationError={
                      syntheticResult?.status === 'validation_error'
                        ? syntheticResult.errorMessage
                        : undefined
                    }
                    onChangeRequest={handleSyntheticRequestChange}
                    onSubmit={() =>
                      executeSyntheticPlan(syntheticRequest, syntheticDataset, true)
                    }
                    onReset={() => {
                      setSyntheticRequest((prev) => ({
                        ...prev,
                        originStopId: '',
                        destinationStopId: '',
                        modeFilter: 'all',
                      }));
                      setSyntheticResult(null);
                      setSelectedCorridorId(null);
                    }}
                  />

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    <div className="xl:col-span-7">
                      <JourneyComparisonList
                        mode="synthetic"
                        result={syntheticResult}
                        stops={syntheticDataset.stops}
                        sourceType={syntheticDataset.metadata.sourceType}
                        selectedCorridorId={selectedSyntheticOption?.corridor.id ?? null}
                        isLoading={isSearching}
                        onSelectCorridor={setSelectedCorridorId}
                        onLoadSampleQuery={() => {
                          const firstPair = availableSyntheticPairs[0];
                          const nextReq: JourneyPlanRequest = {
                            ...syntheticRequest,
                            originStopId:
                              firstPair?.originStopId ?? syntheticDataset.stops[0]?.id ?? '',
                            destinationStopId:
                              firstPair?.destinationStopId ??
                              syntheticDataset.stops[1]?.id ??
                              '',
                            modeFilter: 'all',
                          };
                          setSyntheticRequest(nextReq);
                          executeSyntheticPlan(nextReq, syntheticDataset, true);
                        }}
                        onResetModeFilter={() => {
                          const nextReq: JourneyPlanRequest = {
                            ...syntheticRequest,
                            modeFilter: 'all',
                          };
                          setSyntheticRequest(nextReq);
                          executeSyntheticPlan(nextReq, syntheticDataset, false);
                        }}
                      />
                    </div>
                    <div className="xl:col-span-5 xl:sticky xl:top-22">
                      <TransitMap
                        mode="synthetic"
                        stops={syntheticDataset.stops}
                        selectedOption={selectedSyntheticOption}
                        sourceType={syntheticDataset.metadata.sourceType}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === 'analytics' &&
            (isGtfsActive && gtfsIndex ? (
              <CrowdingAnalyticsView mode="gtfs" gtfsIndex={gtfsIndex} />
            ) : (
              <CrowdingAnalyticsView mode="synthetic" dataset={syntheticDataset} />
            ))}

          {activeSection === 'dataset' && (
            <DatasetSchemaView
              gtfsIndex={gtfsIndex}
              usingSyntheticFallback={usingSyntheticFallback}
              dataset={syntheticDataset}
              onUseGtfsDataset={() => setUsingSyntheticFallback(false)}
            />
          )}
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
            <p>
              SmartTransit Delhi · Transport Stack Hackathon 2026 (Problem 2: Crowdedness-Aware Delhi Bus Planner)
            </p>
            <p>
              Map tiles &copy; OpenStreetMap contributors via Leaflet · Local GTFS + Oct 2026 ticketing data
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
