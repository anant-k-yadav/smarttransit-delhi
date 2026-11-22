import type { FormEvent } from 'react';
import { ArrowLeftRight, Clock, Info, RotateCcw, Search } from 'lucide-react';
import type {
  GtfsAgencyFilter,
  GtfsIndex,
  GtfsJourneyPriority,
  GtfsJourneyRequest,
} from '../data/gtfsTypes';
import type {
  JourneyPlanRequest,
  TransitMode,
  TransitStop,
  TravelPriority,
} from '../data/types';
import { TIME_SLOT_META, resolveDayType, resolveTimeSlot } from '../engine/journeyPlanner';
import { StopAutocomplete } from './StopAutocomplete';

interface GtfsFormProps {
  mode: 'gtfs';
  gtfsIndex: GtfsIndex;
  request: GtfsJourneyRequest;
  isLoading: boolean;
  validationError?: string;
  onChangeRequest: (next: GtfsJourneyRequest) => void;
  onSubmit: () => void;
  onReset: () => void;
}

interface SyntheticFormProps {
  mode: 'synthetic';
  stops: TransitStop[];
  request: JourneyPlanRequest;
  availablePairs: Array<{
    originStopId: string;
    destinationStopId: string;
    label: string;
    routeCount: number;
  }>;
  isLoading: boolean;
  validationError?: string;
  onChangeRequest: (next: JourneyPlanRequest) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export type JourneySearchFormProps = GtfsFormProps | SyntheticFormProps;

const GTFS_PRIORITY_OPTIONS: Array<{ value: GtfsJourneyPriority; label: string }> = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'least_crowded', label: 'Lower Demand' },
  { value: 'fewest_transfers', label: 'Fewest Transfers' },
];

const AGENCY_OPTIONS: Array<{ value: GtfsAgencyFilter; label: string }> = [
  { value: 'all', label: 'All Bus Operators' },
  { value: 'DTC', label: 'DTC' },
  { value: 'DIMTS', label: 'DIMTS' },
];

const SYNTHETIC_PRIORITY_OPTIONS: Array<{ value: TravelPriority; label: string }> = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'least_crowded', label: 'Least Crowded' },
  { value: 'fewest_transfers', label: 'Fewest Transfers' },
];

const SYNTHETIC_MODE_OPTIONS: Array<{ value: 'all' | TransitMode; label: string }> = [
  { value: 'all', label: 'All Modes' },
  { value: 'metro', label: 'Metro' },
  { value: 'bus', label: 'Bus' },
  { value: 'multimodal', label: 'Metro + Bus' },
];

export function JourneySearchForm(props: JourneySearchFormProps) {
  const { request, isLoading, validationError, onSubmit, onReset } = props;
  const activeTimeSlot = resolveTimeSlot(request.travelTime);
  const activeDayType = resolveDayType(request.travelDate);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const handleSwapStops = () => {
    if (props.mode === 'gtfs') {
      props.onChangeRequest({
        ...props.request,
        originStopId: props.request.destinationStopId,
        destinationStopId: props.request.originStopId,
      });
    } else {
      props.onChangeRequest({
        ...props.request,
        originStopId: props.request.destinationStopId,
        destinationStopId: props.request.originStopId,
      });
    }
  };

  return (
    <section
      aria-labelledby="journey-form-heading"
      className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 pb-4 border-b border-slate-100">
        <div>
          <h1
            id="journey-form-heading"
            className="text-lg sm:text-2xl font-display font-bold text-slate-900 tracking-tight"
          >
            Crowdedness-Aware Delhi Bus Planner
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            {props.mode === 'gtfs'
              ? 'Plan direct or 1-transfer Delhi bus trips using GTFS schedules and Oct 2026 within-route historical ticketing demand.'
              : 'Compare Delhi transit corridors by synthetic test crowding category, transfer count, and departure window.'}
          </p>
        </div>
        <p className="text-xs font-mono text-slate-500 tabular-nums sm:whitespace-nowrap">
          Window: {TIME_SLOT_META[activeTimeSlot].label} ·{' '}
          {activeDayType === 'weekday' ? 'Weekday' : 'Weekend'}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
        {/* Origin, Swap, Destination, Date, Time */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 items-end">
          <div className="md:col-span-4">
            {props.mode === 'gtfs' ? (
              <StopAutocomplete
                id="origin-stop"
                label="Origin bus stop"
                placeholder="Search 6,862 stops (e.g. Kashmere Gate)"
                stops={props.gtfsIndex.stops}
                stopDegree={props.gtfsIndex.stopDegree}
                selectedStopId={props.request.originStopId}
                onSelectStop={(stopId) =>
                  props.onChangeRequest({ ...props.request, originStopId: stopId })
                }
              />
            ) : (
              <>
                <label
                  htmlFor="origin-stop"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Origin hub
                </label>
                <select
                  id="origin-stop"
                  name="originStopId"
                  value={props.request.originStopId}
                  onChange={(e) =>
                    props.onChangeRequest({ ...props.request, originStopId: e.target.value })
                  }
                  className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
                >
                  <option value="">Select origin stop</option>
                  {props.stops.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name} ({stop.code})
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div className="md:col-span-1 flex justify-start md:justify-center">
            <button
              type="button"
              onClick={handleSwapStops}
              aria-label="Swap origin and destination stops"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="md:col-span-4">
            {props.mode === 'gtfs' ? (
              <StopAutocomplete
                id="destination-stop"
                label="Destination bus stop"
                placeholder="Search 6,862 stops (e.g. Nehru Place)"
                stops={props.gtfsIndex.stops}
                stopDegree={props.gtfsIndex.stopDegree}
                selectedStopId={props.request.destinationStopId}
                onSelectStop={(stopId) =>
                  props.onChangeRequest({ ...props.request, destinationStopId: stopId })
                }
              />
            ) : (
              <>
                <label
                  htmlFor="destination-stop"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Destination hub
                </label>
                <select
                  id="destination-stop"
                  name="destinationStopId"
                  value={props.request.destinationStopId}
                  onChange={(e) =>
                    props.onChangeRequest({
                      ...props.request,
                      destinationStopId: e.target.value,
                    })
                  }
                  className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
                >
                  <option value="">Select destination stop</option>
                  {props.stops.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name} ({stop.code})
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div className="md:col-span-3 grid grid-cols-1 min-[380px]:grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <label
                htmlFor="travel-date"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Date
              </label>
              <input
                id="travel-date"
                type="date"
                value={request.travelDate}
                onChange={(e) => {
                  if (props.mode === 'gtfs') {
                    props.onChangeRequest({ ...props.request, travelDate: e.target.value });
                  } else {
                    props.onChangeRequest({ ...props.request, travelDate: e.target.value });
                  }
                }}
                className="w-full h-11 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 tabular-nums focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="travel-time"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Time
              </label>
              <input
                id="travel-time"
                type="time"
                value={request.travelTime}
                onChange={(e) => {
                  if (props.mode === 'gtfs') {
                    props.onChangeRequest({ ...props.request, travelTime: e.target.value });
                  } else {
                    props.onChangeRequest({ ...props.request, travelTime: e.target.value });
                  }
                }}
                className="w-full h-11 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 tabular-nums focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
              />
            </div>
          </div>
        </div>

        {/* Priority & Operator/Mode Controls + Actions */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap">
            <fieldset>
              <legend className="text-xs font-semibold text-slate-700 mb-1.5">
                Ranking priority
              </legend>
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {props.mode === 'gtfs'
                  ? GTFS_PRIORITY_OPTIONS.map((option) => {
                      const active = props.request.priority === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            props.onChangeRequest({ ...props.request, priority: option.value })
                          }
                          aria-pressed={active}
                          className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700 ${
                            active
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })
                  : SYNTHETIC_PRIORITY_OPTIONS.map((option) => {
                      const active = props.request.priority === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            props.onChangeRequest({ ...props.request, priority: option.value })
                          }
                          aria-pressed={active}
                          className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700 ${
                            active
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold text-slate-700 mb-1.5">
                {props.mode === 'gtfs' ? 'Bus operator' : 'Transit mode'}
              </legend>
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {props.mode === 'gtfs'
                  ? AGENCY_OPTIONS.map((option) => {
                      const active = props.request.agencyFilter === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            props.onChangeRequest({
                              ...props.request,
                              agencyFilter: option.value,
                            })
                          }
                          aria-pressed={active}
                          className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700 ${
                            active
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })
                  : SYNTHETIC_MODE_OPTIONS.map((option) => {
                      const active = props.request.modeFilter === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            props.onChangeRequest({ ...props.request, modeFilter: option.value })
                          }
                          aria-pressed={active}
                          className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700 ${
                            active
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
              </div>
            </fieldset>
          </div>

          <div className="grid grid-cols-3 sm:flex sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={onReset}
              className="col-span-1 inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-3 sm:px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Clear</span>
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="col-span-2 inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-5 rounded-lg bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{isLoading ? 'Evaluating…' : 'Find Journeys'}</span>
            </button>
          </div>
        </div>

        {/* Inline Validation Feedback */}
        {validationError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
          >
            {validationError}
          </div>
        )}

        {/* Valid quick-select corridors & Judge Demo from active dataset */}
        {props.mode === 'gtfs' && props.gtfsIndex.samplePairs.length > 0 && (() => {
          const demoPair =
            props.gtfsIndex.samplePairs.find(
              (p) =>
                p.label.toLowerCase().includes('aiims') &&
                p.label.toLowerCase().includes('nehru place')
            ) ?? props.gtfsIndex.samplePairs[0];
          const isDemoCorridor =
            props.request.originStopId === demoPair.originStopId &&
            props.request.destinationStopId === demoPair.destinationStopId &&
            activeDayType === 'weekday';
          const isDemoMorningPeak = isDemoCorridor && activeTimeSlot === 'morning_peak';
          const isDemoMidday = isDemoCorridor && activeTimeSlot === 'midday';

          return (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                <span className="font-medium text-slate-500">
                  Sample Delhi bus corridors:
                </span>
                {props.gtfsIndex.samplePairs.map((pair) => {
                  const isSelected =
                    props.request.originStopId === pair.originStopId &&
                    props.request.destinationStopId === pair.destinationStopId;
                  return (
                    <button
                      key={`${pair.originStopId}-${pair.destinationStopId}`}
                      type="button"
                      onClick={() =>
                        props.onChangeRequest({
                          ...props.request,
                          originStopId: pair.originStopId,
                          destinationStopId: pair.destinationStopId,
                        })
                      }
                      className={`inline-flex items-center min-h-[32px] py-0.5 text-left underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 rounded ${
                        isSelected
                          ? 'font-semibold text-teal-800'
                          : 'text-slate-600 hover:text-teal-700'
                      }`}
                    >
                      {pair.label} ({pair.directCount} direct)
                    </button>
                  );
                })}
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 px-3.5 py-3 space-y-2">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-teal-950">
                      Judge Demo: Crowdedness-Aware Choice
                    </p>
                    <p className="text-[11px] text-teal-900 mt-0.5">
                      Compare real corridor <span className="font-medium">{demoPair.label}</span> across weekday demand windows:
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-pressed={isDemoMorningPeak}
                      onClick={() =>
                        props.onChangeRequest({
                          ...props.request,
                          originStopId: demoPair.originStopId,
                          destinationStopId: demoPair.destinationStopId,
                          travelDate: '2026-10-15',
                          travelTime: '09:00',
                          agencyFilter: 'all',
                        })
                      }
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                        isDemoMorningPeak
                          ? 'border-teal-700 bg-teal-700 text-white'
                          : 'border-teal-300 bg-white text-teal-900 hover:bg-teal-50'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Weekday Morning Peak (09:00)</span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={isDemoMidday}
                      onClick={() =>
                        props.onChangeRequest({
                          ...props.request,
                          originStopId: demoPair.originStopId,
                          destinationStopId: demoPair.destinationStopId,
                          travelDate: '2026-10-15',
                          travelTime: '13:30',
                          agencyFilter: 'all',
                        })
                      }
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-teal-700 ${
                        isDemoMidday
                          ? 'border-teal-700 bg-teal-700 text-white'
                          : 'border-teal-300 bg-white text-teal-900 hover:bg-teal-50'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Weekday Midday / Off-Peak (13:30)</span>
                    </button>
                  </div>
                </div>

                <p className="flex items-start gap-1.5 text-[11px] leading-4 text-slate-600 pt-1 border-t border-teal-200/70">
                  <Info className="h-3.5 w-3.5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Recommendations use October 2026 historical ticketing-demand estimates joined to static GTFS schedules. They are not live occupancy or live arrival predictions.
                  </span>
                </p>
              </div>
            </div>
          );
        })()}

        {props.mode === 'synthetic' && props.availablePairs.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="font-medium text-slate-500">
              Available corridors in synthetic fixture:
            </span>
            {props.availablePairs.map((pair) => {
              const isSelected =
                props.request.originStopId === pair.originStopId &&
                props.request.destinationStopId === pair.destinationStopId;
              return (
                <button
                  key={`${pair.originStopId}-${pair.destinationStopId}`}
                  type="button"
                  onClick={() =>
                    props.onChangeRequest({
                      ...props.request,
                      originStopId: pair.originStopId,
                      destinationStopId: pair.destinationStopId,
                    })
                  }
                  className={`underline underline-offset-4 transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-teal-700 rounded ${
                    isSelected
                      ? 'font-semibold text-teal-800'
                      : 'text-slate-600 hover:text-teal-700'
                  }`}
                >
                  {pair.label} ({pair.routeCount})
                </button>
              );
            })}
          </div>
        )}
      </form>
    </section>
  );
}
