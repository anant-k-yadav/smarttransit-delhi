import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Info,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  GtfsIndex,
  GtfsJourneyOption,
  GtfsJourneyPlanResult,
} from '../data/gtfsTypes';
import type {
  DatasetSourceType,
  JourneyOption,
  JourneyPlanResult,
  TransitStop,
} from '../data/types';
import { TIME_SLOT_META } from '../engine/journeyPlanner';
import { formatHourlyPax, formatModeLabel, getCrowdingVisualMeta } from './crowdingStyles';

interface GtfsComparisonProps {
  mode: 'gtfs';
  gtfsIndex: GtfsIndex;
  result: GtfsJourneyPlanResult | null;
  selectedOptionId: string | null;
  isLoading: boolean;
  statusAnnouncement?: string;
  onSelectOption: (optionId: string) => void;
  onLoadSampleQuery: () => void;
  onResetAgencyFilter: () => void;
}

interface SyntheticComparisonProps {
  mode: 'synthetic';
  result: JourneyPlanResult | null;
  stops: TransitStop[];
  sourceType: DatasetSourceType;
  selectedCorridorId: string | null;
  isLoading: boolean;
  onSelectCorridor: (corridorId: string) => void;
  onLoadSampleQuery: () => void;
  onResetModeFilter: () => void;
}

export type JourneyComparisonListProps = GtfsComparisonProps | SyntheticComparisonProps;

export function JourneyComparisonList(props: JourneyComparisonListProps) {
  const [expandedOptionIds, setExpandedOptionIds] = useState<Record<string, boolean>>({});

  const toggleStopsExpanded = (id: string) => {
    setExpandedOptionIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (props.isLoading) {
    return (
      <section
        aria-label="Loading journey options"
        aria-busy="true"
        className="space-y-3"
      >
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className="rounded-xl bg-white border border-slate-200 p-5 animate-pulse"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="h-5 w-52 rounded bg-slate-200" />
              <div className="h-5 w-28 rounded bg-slate-200" />
            </div>
            <div className="mt-3 h-4 w-72 rounded bg-slate-100" />
            <div className="mt-4 h-2 w-full rounded bg-slate-100" />
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="h-4 w-44 rounded bg-slate-100" />
              <div className="h-4 w-24 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (!props.result) {
    return (
      <section
        aria-label="Journey planner empty state"
        className="rounded-xl bg-white border border-slate-200 p-8 text-center"
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Compass className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-base font-display font-semibold text-slate-900">
          Ready to compare Delhi bus routes
        </h2>
        <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
          Select an origin bus stop, destination stop, and departure time above to evaluate scheduled duration, transfers, and Oct 2026 historical demand windows.
        </p>
        <button
          type="button"
          onClick={props.onLoadSampleQuery}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          Load sample Delhi corridor
        </button>
      </section>
    );
  }

  if (props.result.status === 'validation_error') {
    return (
      <section
        aria-label="Journey validation state"
        className="rounded-xl bg-white border border-slate-200 p-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-base font-display font-semibold text-slate-900">
              Complete journey inputs to compare routes
            </h2>
            <p className="mt-1 text-sm text-slate-600">{props.result.errorMessage}</p>
          </div>
        </div>
      </section>
    );
  }

  if (props.result.status === 'empty' || props.result.options.length === 0) {
    return (
      <section
        aria-label="No matching routes found"
        className="rounded-xl bg-white border border-slate-200 p-8 text-center"
      >
        <h2 className="text-base font-display font-semibold text-slate-900">
          No direct or 1-transfer bus routes found
        </h2>
        <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
          {props.mode === 'gtfs'
            ? 'No direct or single-transfer bus path connects these exact stops under the current operator filter. Try switching to All Bus Operators or loading a sample corridor.'
            : 'The current synthetic test fixture does not include a route for this stop pair and mode filter.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={
              props.mode === 'gtfs' ? props.onResetAgencyFilter : props.onResetModeFilter
            }
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            {props.mode === 'gtfs' ? 'Show All Bus Operators' : 'Show All Modes'}
          </button>
          <button
            type="button"
            onClick={props.onLoadSampleQuery}
            className="inline-flex items-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 transition-colors focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            Load Sample Delhi Corridor
          </button>
        </div>
      </section>
    );
  }

  // ==================== REAL GTFS + TICKETING RENDERING ====================
  if (props.mode === 'gtfs') {
    const { result, gtfsIndex, selectedOptionId, onSelectOption } = props;
    const slotMeta = TIME_SLOT_META[result.timeSlot];

    return (
      <section aria-labelledby="journey-results-heading" className="space-y-4">
        {props.statusAnnouncement && (
          <div className="sr-only" role="status" aria-live="polite">
            {props.statusAnnouncement}
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <h2
            id="journey-results-heading"
            className="text-base font-display font-semibold text-slate-900"
          >
            Bus Route Options ({result.options.length}{' '}
            {result.options.length === 1 ? 'route' : 'routes'})
          </h2>
          <p className="text-xs text-slate-500 tabular-nums">
            {slotMeta.label} ({slotMeta.shortLabel}) ·{' '}
            {result.dayType === 'weekday' ? 'Weekday' : 'Weekend'} · Schedule &amp; Oct 2026 demand estimates
          </p>
        </div>

        {/* Lower-demand alternative callout */}
        {result.lowerDemandAlternative && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Sparkles
                className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="text-xs leading-5 text-emerald-950">
                <p className="font-semibold">
                  Lower-demand alternative available: Route {result.lowerDemandAlternative.routeLabel}
                </p>
                <p className="text-emerald-900 mt-0.5">
                  {result.lowerDemandAlternative.reason}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectOption(result.lowerDemandAlternative!.optionId)}
              className="self-start sm:self-center shrink-0 inline-flex min-h-[36px] items-center rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100/70 transition-colors whitespace-nowrap"
            >
              Inspect alternative
            </button>
          </div>
        )}

        <div className="space-y-3" role="list" aria-label="Recommended bus journey options">
          {result.options.map((option: GtfsJourneyOption, index: number) => {
            const isSelected = selectedOptionId === option.id;
            const visual = getCrowdingVisualMeta(
              option.primaryDemandBand,
              option.primaryWithinRouteIndex,
              true
            );
            const isExpanded = Boolean(expandedOptionIds[option.id]);

            return (
              <article
                key={option.id}
                role="listitem"
                className={`rounded-xl bg-white border transition-colors ${
                  isSelected
                    ? 'border-teal-700 ring-1 ring-teal-700'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-4 sm:p-5">
                  {/* Top metadata kicker */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-slate-700">Option {index + 1}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        <span className="tabular-nums">~{option.totalEstimatedMinutes} min</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {option.transfers === 0
                          ? 'Direct (0 transfers)'
                          : `1 transfer via ${option.transferStop?.name ?? 'interchange'}`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{option.stopCount} stops</span>
                    </div>

                    {option.isRecommended && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>Recommended</span>
                      </span>
                    )}
                  </div>

                  {/* Primary title & historical demand readout */}
                  <div className="mt-2.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-display font-bold text-slate-900">
                        {option.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {option.recommendationReason}
                      </p>
                      {(option.boardWalkMeters > 0 || option.alightWalkMeters > 0) && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {option.boardWalkMeters > 0 &&
                            `Board at nearby bay ${option.boardStop.name} (~${option.boardWalkMeters}m). `}
                          {option.alightWalkMeters > 0 &&
                            `Alight at nearby bay ${option.alightStop.name} (~${option.alightWalkMeters}m).`}
                        </p>
                      )}
                    </div>

                    <div className="sm:text-right shrink-0 space-y-0.5 pt-1 sm:pt-0 border-t border-slate-100 sm:border-t-0">
                      <div
                        className={`inline-flex items-center gap-1.5 text-sm font-semibold ${visual.textClass}`}
                      >
                        <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{visual.label}</span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {option.primaryDemandBand === 'Unmatched'
                          ? 'No Oct 2026 ticketing match'
                          : option.primaryWithinRouteIndex !== null
                            ? `Within-route index: ${Math.round(option.primaryWithinRouteIndex)}/100`
                            : 'Multi-leg demand (see legs below)'}
                      </p>
                      {option.combinedHourlyPax !== null && (
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {formatHourlyPax(option.combinedHourlyPax, 'ticketed pax/hr (Oct 2026)')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Within-route demand progress bar */}
                  {option.primaryDemandBand !== 'Unmatched' && (
                    <div className="mt-3">
                      <div
                        className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
                        role="progressbar"
                        aria-label={`Within-route historical demand for ${option.title}: ${visual.label}`}
                        aria-valuenow={Math.round(option.primaryWithinRouteIndex ?? visual.barWidthPct)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${visual.barClass}`}
                          style={{ width: `${visual.barWidthPct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Historical demand estimate (Oct 2026) · Normalized within each route only (not live occupancy)
                      </p>
                    </div>
                  )}

                  {/* Off-peak timing suggestion on same route */}
                  {option.lowerDemandTimeSuggestion && (
                    <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex items-start gap-2 text-xs text-slate-700">
                      <Info className="h-3.5 w-3.5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{option.lowerDemandTimeSuggestion}</span>
                    </div>
                  )}

                  {/* Leg-by-leg breakdown */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2.5">
                    {option.legs.map((leg, legIdx) => {
                      const fromName =
                        gtfsIndex.stopById.get(leg.fromStopId)?.name ?? leg.fromStopId;
                      const toName =
                        gtfsIndex.stopById.get(leg.toStopId)?.name ?? leg.toStopId;
                      const legMin = Math.max(1, Math.round(leg.scheduledSeconds / 60));
                      const legDemand = leg.demandWindow;
                      const legColor = legIdx === 0 ? '#0F766E' : '#2563EB';

                      return (
                        <div
                          key={leg.legId}
                          className="rounded-lg bg-slate-50/70 border border-slate-100 px-3 py-2.5 space-y-2 text-xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <span
                                className="h-2.5 w-2.5 rounded-xs shrink-0"
                                style={{ backgroundColor: legColor }}
                                aria-hidden="true"
                              />
                              <span className="font-semibold text-slate-900">
                                {leg.shortName}
                              </span>
                              <span className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                                {leg.agencyId}
                              </span>
                              <span className="text-slate-600 break-words">
                                {leg.description}
                              </span>
                            </div>

                            <span className="font-mono text-[11px] text-slate-600 tabular-nums sm:shrink-0">
                              ~{legMin} min · {leg.stopIds.length} stops · {leg.tripCount} daily trips
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-[11px] text-slate-600">
                            <span className="inline-flex flex-wrap items-center gap-1 min-w-0">
                              <span>{fromName}</span>
                              <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span>{toName}</span>
                            </span>

                            <span className="font-medium sm:shrink-0">
                              {legDemand ? (
                                <span
                                  className={
                                    getCrowdingVisualMeta(
                                      legDemand.withinRouteDemandBand,
                                      legDemand.withinRouteDemandIndex,
                                      true
                                    ).textClass
                                  }
                                >
                                  {legDemand.withinRouteDemandBand} (
                                  {Math.round(legDemand.withinRouteDemandIndex)}/100 ·{' '}
                                  {formatHourlyPax(legDemand.avgTicketedPassengersPerHourPerDatasetDay)})
                                </span>
                              ) : (
                                <span className="text-slate-500">
                                  Unmatched in ticketing dataset
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Expandable full stop list */}
                  {isExpanded && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2.5 text-xs">
                      {option.legs.map((leg, lIdx) => (
                        <div key={`${leg.legId}-stops`}>
                          <p className="font-semibold text-slate-800 mb-1">
                            Leg {lIdx + 1}: Route {leg.shortName} ({leg.stopIds.length} stops)
                          </p>
                          <ol className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                            {leg.stopIds.map((sid, sIdx) => {
                              const sName = gtfsIndex.stopById.get(sid)?.name ?? sid;
                              return (
                                <li key={`${sid}-${sIdx}`} className="inline-flex items-center gap-1">
                                  <span
                                    className={
                                      sIdx === 0 || sIdx === leg.stopIds.length - 1
                                        ? 'font-semibold text-slate-900'
                                        : ''
                                    }
                                  >
                                    {sName}
                                  </span>
                                  {sIdx < leg.stopIds.length - 1 && (
                                    <span aria-hidden="true" className="text-slate-400">
                                      →
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer metrics & actions */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 tabular-nums">
                      <span>
                        Schedule-based estimate:{' '}
                        <strong className="font-medium text-slate-800">
                          ~{option.totalEstimatedMinutes} min
                        </strong>
                        {option.transfers > 0 && (
                          <span className="text-slate-500">
                            {' '}
                            ({option.segmentMinutes}m ride + {option.transferBufferMinutes}m transfer buffer)
                          </span>
                        )}
                      </span>
                      {option.flaggedSegmentsCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          {option.flaggedSegmentsCount} GTFS segment flagged for review
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleStopsExpanded(option.id)}
                        className="inline-flex min-h-[36px] items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Hide stops</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{option.stopCount} stops</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectOption(option.id)}
                        aria-pressed={isSelected}
                        className={`inline-flex min-h-[36px] items-center px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700 ${
                          isSelected
                            ? 'bg-teal-50 text-teal-900 border border-teal-200'
                            : 'text-teal-700 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? 'Highlighted on map' : 'Inspect on map'}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  // ==================== SYNTHETIC FALLBACK RENDERING ====================
  const { result, stops, sourceType, selectedCorridorId, onSelectCorridor } = props;
  const stopById = new Map(stops.map((s) => [s.id, s]));
  const slotMeta = TIME_SLOT_META[result.timeSlot];

  return (
    <section aria-labelledby="journey-results-heading" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <h2
          id="journey-results-heading"
          className="text-base font-display font-semibold text-slate-900"
        >
          Journey Comparison ({result.options.length}{' '}
          {result.options.length === 1 ? 'option' : 'options'})
        </h2>
        <p className="text-xs text-slate-500 tabular-nums">
          {slotMeta.label} ({slotMeta.shortLabel}) ·{' '}
          {result.dayType === 'weekday' ? 'Weekday' : 'Weekend'} ·{' '}
          {sourceType === 'synthetic_sample' ? 'Synthetic test fixture' : 'Validated dataset'}
        </p>
      </div>

      <div className="space-y-3" role="list" aria-label="Recommended journey options">
        {result.options.map((option: JourneyOption, index: number) => {
          const isSelected = selectedCorridorId === option.corridor.id;
          const visual = getCrowdingVisualMeta(
            option.expectedCrowding,
            option.relativeCrowdingIndex
          );

          return (
            <article
              key={option.corridor.id}
              role="listitem"
              className={`rounded-xl bg-white border transition-colors ${
                isSelected
                  ? 'border-teal-700 ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Option {index + 1}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatModeLabel(option.corridor.primaryMode)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {option.corridor.transfers === 0
                        ? 'Direct (0 transfers)'
                        : `${option.corridor.transfers} transfer${option.corridor.transfers > 1 ? 's' : ''}`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{option.stopCount} stops</span>
                  </div>
                  {option.isRecommended && (
                    <span className="font-semibold text-teal-800">
                      Top Ranked for Current Priority
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-display font-bold text-slate-900">
                      {option.corridor.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {option.recommendationReason}
                    </p>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <div
                      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${visual.textClass}`}
                    >
                      <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{visual.label}</span>
                    </div>
                    <p className="text-xs font-mono text-slate-500 tabular-nums mt-0.5">
                      {option.relativeCrowdingIndex !== null
                        ? `${option.crowdingRecord?.isSyntheticTestValue ? 'Test index' : 'Demand index'}: ${option.relativeCrowdingIndex}/100`
                        : 'Index unavailable'}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5">
                  <div
                    className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
                    role="progressbar"
                    aria-label={`Expected crowding level for ${option.corridor.name}: ${visual.label}`}
                    aria-valuenow={option.relativeCrowdingIndex ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${visual.barClass}`}
                      style={{ width: `${visual.barWidthPct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2">
                  {option.corridor.legs.map((leg) => {
                    const fromName = stopById.get(leg.fromStopId)?.name ?? leg.fromStopId;
                    const toName = stopById.get(leg.toStopId)?.name ?? leg.toStopId;
                    return (
                      <div
                        key={leg.legId}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: leg.lineColor }}
                            aria-hidden="true"
                          />
                          <span className="font-medium text-slate-900">{leg.lineName}</span>
                          <span aria-hidden="true" className="text-slate-300">
                            /
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <span>{fromName}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span>{toName}</span>
                          </span>
                        </div>
                        <span className="text-slate-500">
                          {leg.geometryType === 'gps_trace'
                            ? 'Verified GPS geometry'
                            : 'Schematic connector'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 tabular-nums">
                    <span>
                      Travel time:{' '}
                      <strong className="font-medium text-slate-800">
                        {option.corridor.verifiedTravelTimeMinutes !== null
                          ? `${option.corridor.verifiedTravelTimeMinutes} min`
                          : 'Pending official data'}
                      </strong>
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span>
                      Ticket volume:{' '}
                      <strong className="font-medium text-slate-800">
                        {option.crowdingRecord?.verifiedTicketVolume !== null &&
                        option.crowdingRecord?.verifiedTicketVolume !== undefined
                          ? option.crowdingRecord.verifiedTicketVolume.toLocaleString()
                          : 'Pending official data'}
                      </strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectCorridor(option.corridor.id)}
                    aria-pressed={isSelected}
                    className={`self-start sm:self-auto px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700 ${
                      isSelected
                        ? 'bg-teal-50 text-teal-900'
                        : 'text-teal-700 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? 'Highlighted on map' : 'Inspect on map'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
