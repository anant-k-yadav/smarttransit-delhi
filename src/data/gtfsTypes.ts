import type { DayType, TimeSlotId } from './types';

export type DemandBand = 'Low' | 'Moderate' | 'High' | 'Very high';
export type GtfsAgency = 'DTC' | 'DIMTS';
export type GtfsAgencyFilter = 'all' | GtfsAgency;
export type GtfsJourneyPriority = 'balanced' | 'least_crowded' | 'fewest_transfers';

export interface RawGtfsStop {
  stopId: string;
  stopCode: string;
  name: string;
  lat: number;
  lon: number;
}

export interface RawGtfsRoute {
  routeId: string;
  agencyId: GtfsAgency | string;
  shortName: string;
  longName: string;
  description: string;
  routeType: number;
  tripCount: number;
  shapeIds: string[];
}

export interface RawGtfsSegment {
  routeId: string;
  directionId: string;
  fromStopId: string;
  toStopId: string;
  tripObservations: number;
  avgScheduledTravelSeconds: number;
  minScheduledTravelSeconds: number;
  maxScheduledTravelSeconds: number;
  durationNeedsReview: boolean;
}

export interface TicketingTimeWindow {
  dayType: DayType;
  timeSlot: TimeSlotId;
  ticketCount: number;
  ticketedPassengers: number;
  datasetDaysOfType: number;
  avgTicketedPassengersPerDatasetDay: number;
  avgTicketedPassengersPerHourPerDatasetDay: number;
  withinRouteDemandIndex: number;
  withinRouteDemandBand: DemandBand;
}

export interface TicketingRouteDemand {
  ticketingRoute: string;
  gtfsRouteId: string;
  gtfsRouteShortName: string;
  gtfsRouteLongName: string;
  agencyId: string;
  ticketCount: number;
  ticketedPassengers: number;
  timeWindows: TicketingTimeWindow[];
}

export interface RawCoreMetadata {
  purpose: string;
  gtfs: {
    sourceArchive: string;
    feedVersion: string;
    publisher: string;
    serviceDateRange: { start: string; end: string };
    timezone: string;
    agencyCount: number;
    routeCount: number;
    stopCount: number;
    tripCount: number;
    stopTimeRecordCount: number;
    shapeCount: number;
    shapePointCount: number;
    routeAgencies: Record<string, number>;
    stopsWithValidCoordinates: number;
    adjacentRouteSegments: number;
    segmentsFlaggedForDurationReview: number;
    note: string;
  };
  ticketing: {
    name: string;
    sourceFile: string;
    csvMember: string;
    processedAtUTC: string;
    sourceTimestampTimezone: string;
    rawRows: number;
    validRows: number;
    skippedRows: number;
    totalTicketedPassengersOnValidRows: number;
    routeCount: number;
    dateCoverage: string[];
    datasetDayCounts: { weekday: number; weekend: number };
    measuresActualOnboardOccupancy: boolean;
    measuresLiveCrowding: boolean;
    methodology: string;
    limitations: string[];
    routeMatchMethod: string;
    matchedTicketingRoutes: number;
    unmatchedTicketingRoutes: number;
    matchedRoutePercent: number;
  };
  limitations: string[];
}

export interface RawSmartTransitCore {
  schemaVersion: string;
  metadata: RawCoreMetadata;
  timeSlots: Record<TimeSlotId, { start: string; end: string; hours: number }>;
  stops: RawGtfsStop[];
  routes: RawGtfsRoute[];
  routeSegments: RawGtfsSegment[];
  shapes: Record<string, [number, number][]>;
  ticketingDemandMatched: TicketingRouteDemand[];
  ticketingRoutesUnmatched: string[];
}

export interface RawTripSummary {
  tripId: string;
  routeId: string;
  directionId: string;
  headsign: string;
  shapeId: string;
  startStopId: string;
  endStopId: string;
  departureTime: string;
  arrivalTime: string;
  stopCount: number;
}

export interface RawTripsPayload {
  schemaVersion: string;
  trips: RawTripSummary[];
}

export interface RouteChain {
  routeId: string;
  stops: string[];
  segments: RawGtfsSegment[];
  stopIndexMap: Map<string, number>;
}

export interface StopRouteEntry {
  routeId: string;
  index: number;
}

export interface GtfsSamplePair {
  originStopId: string;
  destinationStopId: string;
  label: string;
  directCount: number;
}

export interface GtfsIndex {
  metadata: RawCoreMetadata;
  timeSlots: RawSmartTransitCore['timeSlots'];
  stops: RawGtfsStop[];
  stopById: Map<string, RawGtfsStop>;
  routes: RawGtfsRoute[];
  routeById: Map<string, RawGtfsRoute>;
  demandByRouteId: Map<string, TicketingRouteDemand>;
  unmatchedTicketingRoutes: string[];
  unmatchedGtfsRouteCount: number;
  routeChains: Map<string, RouteChain>;
  stopToRoutes: Map<string, StopRouteEntry[]>;
  stopDegree: Map<string, number>;
  topHubStops: RawGtfsStop[];
  shapes: Record<string, [number, number][]>;
  samplePairs: GtfsSamplePair[];
}

export interface GtfsJourneyRequest {
  originStopId: string;
  destinationStopId: string;
  travelDate: string; // YYYY-MM-DD
  travelTime: string; // HH:mm
  priority: GtfsJourneyPriority;
  agencyFilter: GtfsAgencyFilter;
}

export interface GtfsJourneyLeg {
  legId: string;
  routeId: string;
  shortName: string;
  description: string;
  agencyId: string;
  tripCount: number;
  fromStopId: string;
  toStopId: string;
  stopIds: string[];
  scheduledSeconds: number;
  flaggedSegmentsCount: number;
  shapePoints: [number, number][];
  fullRouteShapePoints: [number, number][];
  shapeSource: 'gtfs_shape' | 'gtfs_stops';
  demandMatch: TicketingRouteDemand | null;
  demandWindow: TicketingTimeWindow | null;
  lowestDemandSlotForRoute: TicketingTimeWindow | null;
}

export interface GtfsJourneyOption {
  id: string;
  title: string;
  transfers: number;
  legs: GtfsJourneyLeg[];
  originStop: RawGtfsStop;
  destinationStop: RawGtfsStop;
  boardStop: RawGtfsStop;
  alightStop: RawGtfsStop;
  transferStop?: RawGtfsStop;
  transferArrivalStop?: RawGtfsStop;
  boardWalkMeters: number;
  transferWalkMeters: number;
  alightWalkMeters: number;
  segmentMinutes: number;
  transferBufferMinutes: number;
  totalEstimatedMinutes: number;
  flaggedSegmentsCount: number;
  stopCount: number;
  demandStatus: 'matched' | 'partial_match' | 'unmatched';
  primaryDemandBand: DemandBand | 'Unmatched';
  primaryWithinRouteIndex: number | null;
  combinedHourlyPax: number | null;
  timeSlot: TimeSlotId;
  dayType: DayType;
  recommendationScore: number;
  isRecommended: boolean;
  recommendationReason: string;
  lowerDemandTimeSuggestion: string | null;
}

export interface GtfsLowerDemandAlternative {
  optionId: string;
  routeLabel: string;
  demandBand: DemandBand;
  reason: string;
}

export interface GtfsJourneyPlanResult {
  status: 'ok' | 'validation_error' | 'empty';
  errorMessage?: string;
  timeSlot: TimeSlotId;
  dayType: DayType;
  options: GtfsJourneyOption[];
  lowerDemandAlternative: GtfsLowerDemandAlternative | null;
}

export interface GtfsTimeSlotComparisonPoint {
  timeSlot: TimeSlotId;
  label: string;
  axisLabel: string;
  shortLabel: string;
  weekdayIndex: number | null;
  weekendIndex: number | null;
  weekdayHourlyPax: number | null;
  weekendHourlyPax: number | null;
  lowCount: number;
  moderateCount: number;
  highCount: number;
  veryHighCount: number;
}

export interface GtfsRouteAnalyticsRow {
  routeId: string;
  shortName: string;
  description: string;
  agencyId: string;
  tripCount: number;
  totalOctPassengers: number;
  totalOctTickets: number;
  windowHourlyPax: number | null;
  windowDailyPax: number | null;
  withinRouteDemandIndex: number | null;
  withinRouteDemandBand: DemandBand | 'Unmatched';
  isMatched: boolean;
}
