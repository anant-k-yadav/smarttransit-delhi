import { buildGtfsIndex } from '../engine/gtfsEngine';
import type {
  GtfsIndex,
  RawSmartTransitCore,
  RawTripSummary,
  RawTripsPayload,
} from './gtfsTypes';

export interface ValidationReportSummary {
  gtfs: RawSmartTransitCore['metadata']['gtfs'];
  ticketing: RawSmartTransitCore['metadata']['ticketing'];
  routeMatchExamples?: Array<{
    ticketingRoute: string;
    gtfsRouteId: string;
    gtfsRouteShortName: string;
    agencyId: string;
  }>;
  unmatchedExamples?: string[];
}

export const CORE_DATASET_URL = '/assets/aistudio/smarttransit_core_3790cc11.json';
export const TRIPS_DATASET_URL = '/assets/aistudio/smarttransit_trips_8127e806.json';
export const VALIDATION_REPORT_URL = '/assets/aistudio/validation_report_4f63e1bb.json';
export const ROUTE_MATCH_CSV_URL = '/assets/aistudio/route_match_report_347455e3.csv';

let cachedCoreIndexPromise: Promise<GtfsIndex> | null = null;
let cachedTripsByRoutePromise: Promise<Map<string, RawTripSummary[]>> | null = null;

export async function loadGtfsCoreIndex(forceReload = false): Promise<GtfsIndex> {
  if (cachedCoreIndexPromise && !forceReload) {
    return cachedCoreIndexPromise;
  }

  cachedCoreIndexPromise = (async () => {
    const response = await fetch(CORE_DATASET_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to load Delhi GTFS + ticketing dataset (HTTP ${response.status}).`
      );
    }
    const raw = (await response.json()) as RawSmartTransitCore;
    if (
      !raw ||
      !Array.isArray(raw.stops) ||
      !Array.isArray(raw.routes) ||
      !Array.isArray(raw.routeSegments) ||
      !Array.isArray(raw.ticketingDemandMatched)
    ) {
      throw new Error('Loaded GTFS core JSON does not match expected smarttransit_core schema.');
    }
    return buildGtfsIndex(raw);
  })();

  try {
    return await cachedCoreIndexPromise;
  } catch (err) {
    cachedCoreIndexPromise = null;
    throw err;
  }
}

export async function loadValidationReport(): Promise<ValidationReportSummary> {
  const response = await fetch(VALIDATION_REPORT_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to load validation report (HTTP ${response.status}).`);
  }
  return (await response.json()) as ValidationReportSummary;
}

export async function loadTripsByRoute(): Promise<Map<string, RawTripSummary[]>> {
  if (cachedTripsByRoutePromise) {
    return cachedTripsByRoutePromise;
  }

  cachedTripsByRoutePromise = (async () => {
    const response = await fetch(TRIPS_DATASET_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to load GTFS trip summaries (HTTP ${response.status}).`);
    }
    const payload = (await response.json()) as RawTripsPayload;
    const byRoute = new Map<string, RawTripSummary[]>();
    for (const trip of payload.trips ?? []) {
      let list = byRoute.get(trip.routeId);
      if (!list) {
        list = [];
        byRoute.set(trip.routeId, list);
      }
      list.push(trip);
    }
    for (const list of byRoute.values()) {
      list.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    }
    return byRoute;
  })();

  try {
    return await cachedTripsByRoutePromise;
  } catch (err) {
    cachedTripsByRoutePromise = null;
    throw err;
  }
}
