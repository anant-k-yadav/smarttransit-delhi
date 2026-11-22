import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { GtfsIndex } from '../data/gtfsTypes';
import type { DatasetMetadata } from '../data/types';

interface DataBannerProps {
  gtfsIndex: GtfsIndex | null;
  gtfsLoading: boolean;
  gtfsError: string | null;
  syntheticMetadata: DatasetMetadata;
  usingSyntheticFallback: boolean;
  onInspectDataset: () => void;
  onRetryGtfsLoad: () => void;
}

export function DataBanner({
  gtfsIndex,
  gtfsLoading,
  gtfsError,
  syntheticMetadata,
  usingSyntheticFallback,
  onInspectDataset,
  onRetryGtfsLoad,
}: DataBannerProps) {
  if (gtfsLoading && !gtfsIndex) {
    return (
      <section
        aria-label="Dataset loading notice"
        className="rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-3 flex items-center gap-2.5 text-teal-950"
      >
        <Loader2 className="h-4 w-4 animate-spin text-teal-700 shrink-0" aria-hidden="true" />
        <p className="text-xs sm:text-sm leading-5">
          <span className="font-semibold">
            Loading Delhi GTFS and historical Oct 2026 ticketing demand locally…
          </span>
        </p>
      </section>
    );
  }

  if (gtfsError && !gtfsIndex && !usingSyntheticFallback) {
    return (
      <section
        aria-label="Dataset load error notice"
        className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-red-950"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
          <div className="text-xs sm:text-sm leading-5">
            <span className="font-semibold">Could not load local GTFS + ticketing data:</span>{' '}
            <span className="text-red-900">{gtfsError}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetryGtfsLoad}
          className="self-start sm:self-center text-xs font-semibold underline underline-offset-4 whitespace-nowrap shrink-0 text-red-900 hover:text-red-700"
        >
          Retry load
        </button>
      </section>
    );
  }

  if (gtfsIndex && !usingSyntheticFallback) {
    return (
      <section
        aria-label="Active dataset provenance notice"
        className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-emerald-950"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <CheckCircle2
            className="h-4 w-4 mt-0.5 shrink-0 text-emerald-700"
            aria-hidden="true"
          />
          <div className="text-xs sm:text-sm leading-5">
            <span className="font-semibold">
              Delhi GTFS + Oct 2026 · {gtfsIndex.stops.length.toLocaleString()} stops ·{' '}
              {gtfsIndex.routes.length.toLocaleString()} bus routes ·{' '}
              {gtfsIndex.demandByRouteId.size.toLocaleString()} exact ticketing matches.
            </span>{' '}
            <span className="text-emerald-900">
              Historical demand &amp; schedule-based estimates only (not live bus GPS or onboard occupancy).
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onInspectDataset}
          className="self-start sm:self-center text-xs font-semibold underline underline-offset-4 whitespace-nowrap shrink-0 text-emerald-900 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 rounded"
        >
          Dataset &amp; limitations
        </button>
      </section>
    );
  }

  const isSynthetic = syntheticMetadata.sourceType === 'synthetic_sample';
  return (
    <section
      aria-label="Active dataset provenance notice"
      className={`rounded-lg border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
        isSynthetic
          ? 'bg-amber-50/70 border-amber-200 text-amber-950'
          : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {isSynthetic ? (
          <AlertTriangle
            className="h-4 w-4 mt-0.5 shrink-0 text-amber-700"
            aria-hidden="true"
          />
        ) : (
          <CheckCircle2
            className="h-4 w-4 mt-0.5 shrink-0 text-emerald-700"
            aria-hidden="true"
          />
        )}
        <div className="text-xs sm:text-sm leading-5">
          <span className="font-semibold">
            {isSynthetic
              ? 'Synthetic Development Fallback Active — For Testing Only.'
              : `Validated Dataset Loaded: ${syntheticMetadata.datasetName}.`}
          </span>{' '}
          <span className={isSynthetic ? 'text-amber-900' : 'text-emerald-900'}>
            {syntheticMetadata.disclaimer}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onInspectDataset}
        className={`self-start sm:self-center text-xs font-semibold underline underline-offset-4 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 rounded ${
          isSynthetic
            ? 'text-amber-900 hover:text-amber-700 focus-visible:outline-amber-700'
            : 'text-emerald-900 hover:text-emerald-700 focus-visible:outline-emerald-700'
        }`}
      >
        {gtfsIndex ? 'Switch back to real GTFS data' : 'Inspect dataset details'}
      </button>
    </section>
  );
}
