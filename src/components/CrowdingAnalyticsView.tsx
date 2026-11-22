import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info, Search } from 'lucide-react';
import type { GtfsAgencyFilter, GtfsIndex } from '../data/gtfsTypes';
import type { DayType, SmartTransitDataset, TimeSlotId, TransitMode } from '../data/types';
import {
  buildGtfsRouteAnalyticsRows,
  buildGtfsTimeSlotAnalytics,
} from '../engine/gtfsEngine';
import {
  TIME_SLOT_META,
  TIME_SLOT_ORDER,
  buildCorridorAnalyticsRows,
  buildTimeSlotAnalytics,
} from '../engine/journeyPlanner';
import { formatAgencyLabel, formatModeLabel, getCrowdingVisualMeta } from './crowdingStyles';

interface GtfsAnalyticsProps {
  mode: 'gtfs';
  gtfsIndex: GtfsIndex;
}

interface SyntheticAnalyticsProps {
  mode: 'synthetic';
  dataset: SmartTransitDataset;
}

export type CrowdingAnalyticsViewProps = GtfsAnalyticsProps | SyntheticAnalyticsProps;

const AGENCY_OPTIONS: Array<{ value: GtfsAgencyFilter; label: string }> = [
  { value: 'all', label: 'All Bus Operators' },
  { value: 'DTC', label: 'DTC' },
  { value: 'DIMTS', label: 'DIMTS' },
];

const SYNTHETIC_MODE_OPTIONS: Array<{ value: 'all' | TransitMode; label: string }> = [
  { value: 'all', label: 'All Modes' },
  { value: 'metro', label: 'Metro' },
  { value: 'bus', label: 'Bus' },
  { value: 'multimodal', label: 'Metro + Bus' },
];

export function CrowdingAnalyticsView(props: CrowdingAnalyticsViewProps) {
  const [dayType, setDayType] = useState<DayType>('weekday');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotId>('morning_peak');
  const [agencyFilter, setAgencyFilter] = useState<GtfsAgencyFilter>('all');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [chartMetric, setChartMetric] = useState<'index' | 'hourly_pax'>('index');
  const [routeSearch, setRouteSearch] = useState('');
  const [showUnmatchedGtfs, setShowUnmatchedGtfs] = useState(false);
  const [unmatchedSearch, setUnmatchedSearch] = useState('');

  // Synthetic fallback state
  const [syntheticModeFilter, setSyntheticModeFilter] = useState<'all' | TransitMode>('all');

  if (props.mode === 'gtfs') {
    const { gtfsIndex } = props;

    const topSelectableRoutes = useMemo(() => {
      return [...gtfsIndex.demandByRouteId.values()]
        .filter((r) => agencyFilter === 'all' || r.agencyId === agencyFilter)
        .sort((a, b) => b.ticketedPassengers - a.ticketedPassengers)
        .slice(0, 60);
    }, [gtfsIndex, agencyFilter]);

    const timeSlotSeries = useMemo(
      () =>
        buildGtfsTimeSlotAnalytics(
          gtfsIndex,
          agencyFilter,
          selectedRouteId || undefined
        ),
      [gtfsIndex, agencyFilter, selectedRouteId]
    );

    const routeRows = useMemo(
      () =>
        buildGtfsRouteAnalyticsRows(
          gtfsIndex,
          selectedSlot,
          dayType,
          agencyFilter,
          routeSearch,
          showUnmatchedGtfs
        ),
      [gtfsIndex, selectedSlot, dayType, agencyFilter, routeSearch, showUnmatchedGtfs]
    );

    const filteredUnmatchedTicketing = useMemo(() => {
      const q = unmatchedSearch.trim().toLowerCase();
      if (!q) return gtfsIndex.unmatchedTicketingRoutes;
      return gtfsIndex.unmatchedTicketingRoutes.filter((code) =>
        code.toLowerCase().includes(q)
      );
    }, [gtfsIndex, unmatchedSearch]);

    const selectedRouteObj = selectedRouteId
      ? gtfsIndex.routeById.get(selectedRouteId) ?? null
      : null;

    const amPeak = timeSlotSeries.find((p) => p.timeSlot === 'morning_peak');
    const midday = timeSlotSeries.find((p) => p.timeSlot === 'midday');
    const peakVsMiddayDrop =
      amPeak && midday && amPeak.weekdayHourlyPax && midday.weekdayHourlyPax
        ? Math.round(
            ((amPeak.weekdayHourlyPax - midday.weekdayHourlyPax) / amPeak.weekdayHourlyPax) *
              100
          )
        : null;

    return (
      <div className="space-y-6">
        {/* Header + Controls */}
        <section
          aria-labelledby="analytics-heading"
          className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6 space-y-5"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1
                id="analytics-heading"
                className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight"
              >
                Delhi Bus Historical Demand Analytics
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                October 2026 e-ticketing summaries joined to GTFS v32 by exact route code ({gtfsIndex.demandByRouteId.size.toLocaleString()} matched routes).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div
                className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
                role="group"
                aria-label="Bus operator filter"
              >
                {AGENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setAgencyFilter(opt.value);
                      setSelectedRouteId('');
                    }}
                    aria-pressed={agencyFilter === opt.value}
                    className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-teal-700 ${
                      agencyFilter === opt.value
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KPI Summary Strip */}
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
            <div>
              <dt className="text-xs font-medium text-slate-500">Exact route matches</dt>
              <dd className="mt-1 text-lg font-display font-bold text-slate-900 tabular-nums">
                {gtfsIndex.demandByRouteId.size.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {gtfsIndex.routes.length.toLocaleString()} GTFS
                </span>
              </dd>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {gtfsIndex.metadata.ticketing.matchedRoutePercent}% of ticketing routes
              </p>
            </div>

            <div>
              <dt className="text-xs font-medium text-slate-500">Oct 2026 ticketed pax</dt>
              <dd className="mt-1 text-lg font-display font-bold text-slate-900 tabular-nums">
                {gtfsIndex.metadata.ticketing.totalTicketedPassengersOnValidRows.toLocaleString()}
              </dd>
              <p className="text-[11px] text-slate-500 mt-0.5">
                22 weekdays · 9 weekend days
              </p>
            </div>

            <div>
              <dt className="text-xs font-medium text-slate-500">
                Weekday AM Peak vs Midday
              </dt>
              <dd className="mt-1 text-lg font-display font-bold text-teal-800 tabular-nums">
                {peakVsMiddayDrop !== null ? `${peakVsMiddayDrop}% lower midday` : '—'}
              </dd>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {amPeak?.weekdayHourlyPax ?? '—'} vs {midday?.weekdayHourlyPax ?? '—'} pax/hr avg
              </p>
            </div>

            <div>
              <dt className="text-xs font-medium text-slate-500">Unmatched routes</dt>
              <dd className="mt-1 text-lg font-display font-bold text-slate-900 tabular-nums">
                {gtfsIndex.unmatchedTicketingRoutes.length.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">ticketing</span>
              </dd>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                + {gtfsIndex.unmatchedGtfsRouteCount.toLocaleString()} GTFS without tickets
              </p>
            </div>
          </dl>
        </section>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          {/* Chart 1: Peak vs Off-Peak (Weekday vs Weekend) */}
          <section
            aria-labelledby="timeslot-chart-heading"
            className="min-w-0 rounded-xl bg-white border border-slate-200 p-4 sm:p-6 flex flex-col"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="min-w-0">
                <h2
                  id="timeslot-chart-heading"
                  className="text-base font-display font-semibold text-slate-900"
                >
                  Peak vs Off-Peak: Weekday vs Weekend
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedRouteObj
                    ? `Route ${selectedRouteObj.shortName} (${selectedRouteObj.description})`
                    : `Mean across matched ${formatAgencyLabel(agencyFilter)} routes`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Inspect a specific route"
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  className="h-9 w-full sm:w-auto sm:max-w-[210px] rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-teal-700 focus:outline-2 focus-visible:outline-teal-700"
                >
                  <option value="">All Matched Routes (Mean)</option>
                  {topSelectableRoutes.map((r) => (
                    <option key={r.gtfsRouteId} value={r.gtfsRouteId}>
                      {r.gtfsRouteShortName} ({r.ticketedPassengers.toLocaleString()} pax)
                    </option>
                  ))}
                </select>

                <div
                  className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-md"
                  role="group"
                  aria-label="Chart metric toggle"
                >
                  <button
                    type="button"
                    onClick={() => setChartMetric('index')}
                    className={`px-2 py-1 text-[11px] font-medium rounded ${
                      chartMetric === 'index'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Index (0–100)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric('hourly_pax')}
                    className={`px-2 py-1 text-[11px] font-medium rounded ${
                      chartMetric === 'hourly_pax'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pax / Hr
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 h-[290px] w-full" data-testid="timeslot-crowding-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={timeSlotSeries}
                  margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="axisLabel"
                    interval={0}
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={chartMetric === 'index' ? [0, 100] : [0, 'auto']}
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.label
                        ? `${payload[0].payload.label} (${payload[0].payload.shortLabel})`
                        : ''
                    }
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: '8px' }} />
                  <Bar
                    dataKey={chartMetric === 'index' ? 'weekdayIndex' : 'weekdayHourlyPax'}
                    name={
                      chartMetric === 'index'
                        ? 'Weekday (Within-route index)'
                        : 'Weekday (Avg pax/hr)'
                    }
                    fill="#0F766E"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey={chartMetric === 'index' ? 'weekendIndex' : 'weekendHourlyPax'}
                    name={
                      chartMetric === 'index'
                        ? 'Weekend (Within-route index)'
                        : 'Weekend (Avg pax/hr)'
                    }
                    fill="#64748B"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              Historical demand estimate from Oct 2026 ticketing. Within-route index compares each route against its own peak window (100 = that route's busiest hourly rate).
            </p>
          </section>

          {/* Chart 2: Demand Band Distribution Across Time Slots */}
          <section
            aria-labelledby="band-chart-heading"
            className="min-w-0 rounded-xl bg-white border border-slate-200 p-4 sm:p-6 flex flex-col"
          >
            <div className="pb-4 border-b border-slate-100">
              <h2
                id="band-chart-heading"
                className="text-base font-display font-semibold text-slate-900"
              >
                Route Demand Band Breakdown (Weekday)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                How {selectedRouteObj ? 'this route' : `all matched ${formatAgencyLabel(agencyFilter)} routes`} fall into Low, Moderate, High, and Very high within-route bands
              </p>
            </div>

            <div className="mt-4 h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={timeSlotSeries}
                  margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="axisLabel"
                    interval={0}
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.label ?? ''
                    }
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: '8px' }} />
                  <Bar dataKey="lowCount" stackId="bands" name="Low" fill="#10B981" />
                  <Bar dataKey="moderateCount" stackId="bands" name="Moderate" fill="#F59E0B" />
                  <Bar dataKey="highCount" stackId="bands" name="High" fill="#EA580C" />
                  <Bar
                    dataKey="veryHighCount"
                    stackId="bands"
                    name="Very high"
                    fill="#DC2626"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              Each route's band is determined relative to its own peak demand window. Midday and Late Evening shift the majority of routes into Low/Moderate bands.
            </p>
          </section>
        </div>

        {/* Route Historical Volume & Demand Table */}
        <section
          aria-labelledby="route-table-heading"
          className="rounded-xl bg-white border border-slate-200 overflow-hidden"
        >
          <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h2
                id="route-table-heading"
                className="text-base font-display font-semibold text-slate-900"
              >
                Route Ticketing Demand ({TIME_SLOT_META[selectedSlot].label} ·{' '}
                {dayType === 'weekday' ? 'Weekday' : 'Weekend'})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ranked by historical Oct 2026 ticketed passengers/hour (not by normalized within-route index).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-auto">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                  placeholder="Filter route or stop..."
                  aria-label="Filter routes by code or description"
                  className="h-9 w-full sm:w-48 rounded-md border border-slate-300 bg-white pl-8 pr-2.5 text-xs text-slate-900 focus:border-teal-700 focus:outline-2 focus-visible:outline-teal-700"
                />
              </div>

              <div
                className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-md"
                role="group"
                aria-label="Table day type"
              >
                {(['weekday', 'weekend'] as DayType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDayType(type)}
                    aria-pressed={dayType === type}
                    className={`min-h-[32px] px-2.5 py-1 text-xs font-medium rounded ${
                      dayType === type
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {type === 'weekday' ? 'Weekday' : 'Weekend'}
                  </button>
                ))}
              </div>

              <select
                aria-label="Select time slot for route table"
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value as TimeSlotId)}
                className="h-9 w-full sm:w-auto rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-teal-700"
              >
                {TIME_SLOT_ORDER.map((slot) => (
                  <option key={slot} value={slot}>
                    {TIME_SLOT_META[slot].label}
                  </option>
                ))}
              </select>

              <label className="inline-flex min-h-[36px] items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUnmatchedGtfs}
                  onChange={(e) => setShowUnmatchedGtfs(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                />
                <span>Include unmatched GTFS routes</span>
              </label>
            </div>
          </div>

          <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-xs text-slate-600">
            <Info className="h-3.5 w-3.5 text-teal-700 shrink-0" aria-hidden="true" />
            <span>
              <strong>Truthfulness note:</strong> Within-route indices (0–100) are normalized inside each route separately and are never compared across routes as absolute crowding. Use Avg Pax/Hr or Oct 2026 Total Passengers for cross-route volume scale.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th scope="col" className="py-3 px-4 sm:px-5">Route</th>
                  <th scope="col" className="py-3 px-4">GTFS Description</th>
                  <th scope="col" className="py-3 px-4">Operator</th>
                  <th scope="col" className="py-3 px-4">Within-Route Band</th>
                  <th scope="col" className="py-3 px-4 text-right">Within-Route Index</th>
                  <th scope="col" className="py-3 px-4 text-right">Window Pax / Hr</th>
                  <th scope="col" className="py-3 px-4 sm:px-5 text-right">Oct 2026 Total Pax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {routeRows.slice(0, 40).map((row) => {
                  const visual = getCrowdingVisualMeta(
                    row.withinRouteDemandBand,
                    row.withinRouteDemandIndex,
                    true
                  );
                  return (
                    <tr key={row.routeId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 sm:px-5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {row.shortName}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                        {row.description}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {row.agencyId}
                      </td>
                      <td className={`py-3 px-4 font-semibold whitespace-nowrap ${visual.textClass}`}>
                        {row.isMatched ? row.withinRouteDemandBand : 'Unmatched'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {row.withinRouteDemandIndex !== null
                          ? `${row.withinRouteDemandIndex}/100`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                        {row.windowHourlyPax !== null
                          ? row.windowHourlyPax.toLocaleString()
                          : 'Unmatched'}
                      </td>
                      <td className="py-3 px-4 sm:px-5 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {row.isMatched
                          ? row.totalOctPassengers.toLocaleString()
                          : 'No ticketing match'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span>
              Showing {Math.min(40, routeRows.length)} of {routeRows.length.toLocaleString()} matching routes
            </span>
            <span>Source: Oct 2026 Delhi e-ticketing + static GTFS v32</span>
          </div>
        </section>

        {/* Unmatched Ticketing Routes Transparency Explorer */}
        <section
          aria-labelledby="unmatched-routes-heading"
          className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2
                id="unmatched-routes-heading"
                className="text-base font-display font-semibold text-slate-900"
              >
                Unmatched Ticketing Route Codes ({gtfsIndex.unmatchedTicketingRoutes.length})
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                These Oct 2026 ticketing route codes have no exact case-insensitive match in GTFS <code className="font-mono">route_short_name</code>. They are kept separate rather than fuzzy-guessed.
              </p>
            </div>
            <input
              type="text"
              value={unmatchedSearch}
              onChange={(e) => setUnmatchedSearch(e.target.value)}
              placeholder="Search unmatched code..."
              aria-label="Search unmatched ticketing route codes"
              className="h-9 w-full sm:w-52 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-teal-700"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
            {filteredUnmatchedTicketing.slice(0, 80).map((code) => (
              <span
                key={code}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700"
              >
                {code}
              </span>
            ))}
            {filteredUnmatchedTicketing.length > 80 && (
              <span className="px-2 py-0.5 text-xs text-slate-500">
                +{filteredUnmatchedTicketing.length - 80} more…
              </span>
            )}
            {filteredUnmatchedTicketing.length === 0 && (
              <span className="text-xs text-slate-500">
                No unmatched route codes match "{unmatchedSearch}".
              </span>
            )}
          </div>
        </section>
      </div>
    );
  }

  // ==================== SYNTHETIC FALLBACK VIEW ====================
  const { dataset } = props;
  const isSynthetic = dataset.metadata.sourceType === 'synthetic_sample';
  const timeSlotSeries = buildTimeSlotAnalytics(dataset, dayType, syntheticModeFilter);
  const corridorRows = buildCorridorAnalyticsRows(
    dataset,
    selectedSlot,
    dayType,
    syntheticModeFilter
  );
  const timeSlotChartData = timeSlotSeries.map((point) => ({
    ...point,
    axisLabel:
      point.timeSlot === 'early_morning'
        ? 'Early'
        : point.timeSlot === 'morning_peak'
          ? 'AM Peak'
          : point.timeSlot === 'midday'
            ? 'Midday'
            : point.timeSlot === 'evening_peak'
              ? 'PM Peak'
              : 'Late',
  }));
  const hasChartData = timeSlotSeries.some((point) => point.recordCount > 0);
  const corridorChartData = corridorRows
    .filter((row) => row.relativeCrowdingIndex !== null)
    .map((row) => ({
      name: `${row.originName} to ${row.destinationName}`,
      shortName: `${row.originName.split(' ')[0]}–${row.destinationName.split(' ')[0]}`,
      index: row.relativeCrowdingIndex ?? 0,
    }));

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight">
              Crowding Analytics (Synthetic Fallback)
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Visualizing synthetic sample test indices across demand windows and corridors.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['weekday', 'weekend'] as DayType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDayType(type)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                    dayType === type ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {type === 'weekday' ? 'Weekday' : 'Weekend'}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {SYNTHETIC_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSyntheticModeFilter(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                    syntheticModeFilter === opt.value
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-xl bg-white border border-slate-200 p-5">
          <h2 className="text-base font-display font-semibold text-slate-900 pb-3 border-b border-slate-100">
            Crowding Index by Time Window ({formatModeLabel(syntheticModeFilter)})
          </h2>
          <div className="mt-4 h-[280px]">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeSlotChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="axisLabel" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="metroAvgIndex" name="Metro" fill="#2563EB" />
                  <Bar dataKey="busAvgIndex" name="DTC Bus" fill="#0D9488" />
                  <Bar dataKey="multimodalAvgIndex" name="Metro + Bus" fill="#CA8A04" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No records for selected filters.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-display font-semibold text-slate-900">
              Corridor Load Comparison
            </h2>
            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value as TimeSlotId)}
              className="h-8 rounded border border-slate-300 px-2 text-xs"
            >
              {TIME_SLOT_ORDER.map((slot) => (
                <option key={slot} value={slot}>
                  {TIME_SLOT_META[slot].label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={corridorChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="shortName" width={140} />
                <Tooltip />
                <Bar
                  dataKey="index"
                  name={isSynthetic ? 'Test Index' : 'Index'}
                  fill="#0F766E"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
