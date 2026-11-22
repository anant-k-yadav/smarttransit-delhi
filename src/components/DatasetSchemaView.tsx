import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
} from 'lucide-react';
import {
  ROUTE_MATCH_CSV_URL,
  VALIDATION_REPORT_URL,
  loadTripsByRoute,
} from '../data/gtfsLoader';
import type { GtfsIndex } from '../data/gtfsTypes';
import type { SmartTransitDataset } from '../data/types';

interface DatasetSchemaViewProps {
  gtfsIndex: GtfsIndex | null;
  usingSyntheticFallback?: boolean;
  dataset?: SmartTransitDataset;
  onUseGtfsDataset?: () => void;
}

export function DatasetSchemaView({
  gtfsIndex,
  usingSyntheticFallback = false,
  onUseGtfsDataset,
}: DatasetSchemaViewProps) {
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsLoadedCount, setTripsLoadedCount] = useState<number | null>(null);
  const [tripsError, setTripsError] = useState<string | null>(null);

  const handleLoadTripSummaries = async () => {
    setTripsLoading(true);
    setTripsError(null);
    try {
      const map = await loadTripsByRoute();
      let total = 0;
      for (const list of map.values()) total += list.length;
      setTripsLoadedCount(total);
    } catch (err) {
      setTripsError(err instanceof Error ? err.message : 'Failed to load trip summaries.');
    } finally {
      setTripsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {gtfsIndex ? (
        <section
          aria-labelledby="gtfs-dataset-heading"
          className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6 space-y-5"
        >
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h1
                id="gtfs-dataset-heading"
                className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight"
              >
                Delhi Bus GTFS &amp; Oct 2026 Ticketing Dataset
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                {gtfsIndex.metadata.purpose}. Loaded locally from static browser assets with zero external APIs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <a
                href={ROUTE_MATCH_CSV_URL}
                download="route_match_report.csv"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Route Match CSV</span>
              </a>
              <a
                href={VALIDATION_REPORT_URL}
                download="validation_report.json"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Validation Report JSON</span>
              </a>
              {usingSyntheticFallback && onUseGtfsDataset && (
                <button
                  type="button"
                  onClick={onUseGtfsDataset}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 transition-colors whitespace-nowrap"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Activate Real GTFS Dataset</span>
                </button>
              )}
            </div>
          </div>

          {/* GTFS & Ticketing Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <h2 className="text-sm font-display font-semibold text-slate-900">
                1. Static Bus GTFS Feed ({gtfsIndex.metadata.gtfs.feedVersion})
              </h2>
              <dl className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 text-xs">
                <div className="min-w-0">
                  <dt className="text-slate-500">Source Archive</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5 truncate">
                    {gtfsIndex.metadata.gtfs.sourceArchive}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Operators</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5">
                    DTC ({gtfsIndex.metadata.gtfs.routeAgencies.DTC}) · DIMTS (
                    {gtfsIndex.metadata.gtfs.routeAgencies.DIMTS})
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Valid Stops</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {gtfsIndex.metadata.gtfs.stopCount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Bus Routes &amp; Shapes</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {gtfsIndex.metadata.gtfs.routeCount.toLocaleString()} routes ·{' '}
                    {gtfsIndex.metadata.gtfs.shapeCount.toLocaleString()} shapes
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Adjacent Segments</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {gtfsIndex.metadata.gtfs.adjacentRouteSegments.toLocaleString()} (
                    {gtfsIndex.metadata.gtfs.segmentsFlaggedForDurationReview} flagged)
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Service Calendar</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {gtfsIndex.metadata.gtfs.serviceDateRange.start} →{' '}
                    {gtfsIndex.metadata.gtfs.serviceDateRange.end}
                  </dd>
                </div>
              </dl>

              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-600">
                  {tripsLoadedCount !== null
                    ? `Verified ${tripsLoadedCount.toLocaleString()} trip summaries loaded from smarttransit_trips.json.`
                    : `Trip summaries file contains ${gtfsIndex.metadata.gtfs.tripCount.toLocaleString()} scheduled trips.`}
                </span>
                {tripsLoadedCount === null && (
                  <button
                    type="button"
                    onClick={handleLoadTripSummaries}
                    disabled={tripsLoading}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {tripsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>{tripsLoading ? 'Verifying trips…' : 'Verify Trips JSON'}</span>
                  </button>
                )}
              </div>
              {tripsError && <p className="text-xs text-red-700">{tripsError}</p>}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <h2 className="text-sm font-display font-semibold text-slate-900">
                2. October 2026 E-Ticketing Demand
              </h2>
              <dl className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 text-xs">
                <div className="min-w-0">
                  <dt className="text-slate-500">Source File</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5">
                    {gtfsIndex.metadata.ticketing.csvMember}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Day Counts</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {gtfsIndex.metadata.ticketing.datasetDayCounts.weekday} weekdays ·{' '}
                    {gtfsIndex.metadata.ticketing.datasetDayCounts.weekend} weekend days
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Valid Ticket Rows</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {gtfsIndex.metadata.ticketing.validRows.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Ticketed Passengers</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {gtfsIndex.metadata.ticketing.totalTicketedPassengersOnValidRows.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Exact GTFS Matches</dt>
                  <dd className="font-mono font-semibold text-emerald-800 mt-0.5 tabular-nums">
                    {gtfsIndex.metadata.ticketing.matchedTicketingRoutes.toLocaleString()} /{' '}
                    {gtfsIndex.metadata.ticketing.routeCount.toLocaleString()} (
                    {gtfsIndex.metadata.ticketing.matchedRoutePercent}%)
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Unmatched Kept Separate</dt>
                  <dd className="font-mono font-semibold text-amber-800 mt-0.5 tabular-nums">
                    {gtfsIndex.metadata.ticketing.unmatchedTicketingRoutes.toLocaleString()} ticketing ·{' '}
                    {gtfsIndex.unmatchedGtfsRouteCount.toLocaleString()} GTFS
                  </dd>
                </div>
              </dl>
              <p className="text-[11px] text-slate-600 pt-2 border-t border-slate-200">
                <strong>Match method:</strong> {gtfsIndex.metadata.ticketing.routeMatchMethod}
              </p>
            </div>
          </div>

          {/* Explicit Limitations */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-950 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
              <span>Important Dataset Limitations &amp; Data Truth Guarantees</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-xs text-amber-950">
              {gtfsIndex.metadata.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <section className="rounded-xl bg-white border border-slate-200 p-6 text-sm text-slate-600">
          Loading Delhi GTFS and historical Oct 2026 ticketing demand metadata…
        </section>
      )}

      {/* Methodology & Data Truth Contracts */}
      <section
        aria-labelledby="readiness-heading"
        className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6"
      >
        <div className="pb-3 border-b border-slate-100">
          <h2
            id="readiness-heading"
            className="text-base font-display font-semibold text-slate-900"
          >
            Methodology &amp; Data Contracts
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            How SmartTransit Delhi evaluates bus routes and historical demand.
          </p>
        </div>

        <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <li className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5">
            <p className="font-semibold text-slate-900">Within-route demand normalization</p>
            <p className="mt-1 text-slate-600">
              {gtfsIndex
                ? gtfsIndex.metadata.ticketing.methodology
                : 'Demand indices are normalized within each route separately (0–100) and never compared across routes as absolute occupancy.'}
            </p>
          </li>
          <li className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5">
            <p className="font-semibold text-slate-900">Schedule-based duration estimates</p>
            <p className="mt-1 text-slate-600">
              Journey durations sum scheduled adjacent-stop travel seconds across GTFS segments (+8 min interchange buffer for 1-transfer options). Segments flagged for review are marked explicitly.
            </p>
          </li>
          <li className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5">
            <p className="font-semibold text-slate-900">No fabricated metro, fare, or live GPS data</p>
            <p className="mt-1 text-slate-600">
              All 2,574 routes in the feed are bus routes (routeType=3). Missing fare tables, real-time vehicle positions, and unmatched ticketing codes are never guessed.
            </p>
          </li>
          <li className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5">
            <p className="font-semibold text-slate-900">100% browser-local execution</p>
            <p className="mt-1 text-slate-600">
              All GTFS graph building, journey search, and OpenStreetMap tile rendering run locally with zero backend database, authentication, or paid API keys.
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}
