export type DatasetSourceType = 'synthetic_sample' | 'official_validated';

export type TransitMode = 'metro' | 'bus' | 'multimodal';
export type LegMode = 'metro' | 'bus';

export type CrowdingCategory = 'Low' | 'Moderate' | 'High' | 'Very High';

export type DayType = 'weekday' | 'weekend';

export type TimeSlotId =
  | 'early_morning'
  | 'morning_peak'
  | 'midday'
  | 'evening_peak'
  | 'late_evening';

export type TravelPriority = 'balanced' | 'least_crowded' | 'fewest_transfers';

export interface DatasetMetadata {
  datasetName: string;
  sourceType: DatasetSourceType;
  version: string;
  generatedAt: string;
  disclaimer: string;
  fieldsPendingOfficialData: string[];
}

export interface TransitStop {
  id: string;
  name: string;
  code: string;
  area: string;
  /** Approximate reference latitude for test placement or verified GTFS latitude when official data is loaded. */
  lat: number;
  /** Approximate reference longitude for test placement or verified GTFS longitude when official data is loaded. */
  lng: number;
  modes: LegMode[];
  lines: string[];
  coordinateSource: 'approximate_hub_reference' | 'verified_gtfs';
}

export interface RouteLeg {
  legId: string;
  mode: LegMode;
  lineName: string;
  lineColor: string;
  fromStopId: string;
  toStopId: string;
  stopIds: string[];
  geometryType: 'schematic_connector' | 'gps_trace';
  /** Optional verified GPS trace coordinates ([lat, lng]) populated only by validated official datasets. */
  coordinates?: [number, number][];
}

export interface RouteCorridor {
  id: string;
  name: string;
  originStopId: string;
  destinationStopId: string;
  primaryMode: TransitMode;
  transfers: number;
  legs: RouteLeg[];
  /** Populated only when verified travel time estimates are provided in an official dataset. Null in synthetic sample. */
  verifiedTravelTimeMinutes: number | null;
  /** Populated only when verified fare tables are provided in an official dataset. Null in synthetic sample. */
  verifiedFareInr: number | null;
}

export interface TimeSlotCrowdingRecord {
  corridorId: string;
  timeSlot: TimeSlotId;
  dayType: DayType;
  expectedCrowding: CrowdingCategory;
  /** Normalized 0–100 index used for relative comparison and chart scaling. Explicitly synthetic in sample data. */
  relativeCrowdingIndex: number;
  /** Populated only from official ticketing aggregation outputs. Null in synthetic sample. */
  verifiedTicketVolume: number | null;
  isSyntheticTestValue: boolean;
  notes?: string;
}

export interface SmartTransitDataset {
  schemaVersion: '1.0.0';
  metadata: DatasetMetadata;
  stops: TransitStop[];
  corridors: RouteCorridor[];
  crowdingRecords: TimeSlotCrowdingRecord[];
}

export interface JourneyPlanRequest {
  originStopId: string;
  destinationStopId: string;
  travelDate: string; // YYYY-MM-DD
  travelTime: string; // HH:mm
  priority: TravelPriority;
  modeFilter: 'all' | TransitMode;
}

export interface JourneyOption {
  corridor: RouteCorridor;
  crowdingRecord: TimeSlotCrowdingRecord | null;
  expectedCrowding: CrowdingCategory | 'Unavailable';
  relativeCrowdingIndex: number | null;
  timeSlot: TimeSlotId;
  dayType: DayType;
  stopCount: number;
  recommendationScore: number;
  isRecommended: boolean;
  recommendationReason: string;
}

export interface JourneyPlanResult {
  status: 'ok' | 'validation_error' | 'empty';
  errorMessage?: string;
  timeSlot: TimeSlotId;
  dayType: DayType;
  options: JourneyOption[];
}

export interface TimeSlotAnalyticsPoint {
  timeSlot: TimeSlotId;
  label: string;
  shortLabel: string;
  metroAvgIndex: number | null;
  busAvgIndex: number | null;
  multimodalAvgIndex: number | null;
  overallAvgIndex: number | null;
  recordCount: number;
}

export interface CorridorAnalyticsRow {
  corridorId: string;
  corridorName: string;
  originName: string;
  destinationName: string;
  primaryMode: TransitMode;
  transfers: number;
  expectedCrowding: CrowdingCategory | 'Unavailable';
  relativeCrowdingIndex: number | null;
  verifiedTicketVolume: number | null;
  isSyntheticTestValue: boolean;
}

export interface DatasetValidationResult {
  valid: boolean;
  dataset?: SmartTransitDataset;
  errors: string[];
}
