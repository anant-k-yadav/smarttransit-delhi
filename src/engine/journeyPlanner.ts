import type {
  CorridorAnalyticsRow,
  CrowdingCategory,
  DayType,
  JourneyOption,
  JourneyPlanRequest,
  JourneyPlanResult,
  RouteCorridor,
  SmartTransitDataset,
  TimeSlotAnalyticsPoint,
  TimeSlotCrowdingRecord,
  TimeSlotId,
  TransitMode,
  TransitStop,
  TravelPriority,
} from '../data/types';

export const TIME_SLOT_META: Record<
  TimeSlotId,
  { label: string; shortLabel: string; rangeLabel: string }
> = {
  early_morning: {
    label: 'Early Morning',
    shortLabel: '05:00–07:59',
    rangeLabel: '05:00 to 07:59',
  },
  morning_peak: {
    label: 'Morning Peak',
    shortLabel: '08:00–10:59',
    rangeLabel: '08:00 to 10:59',
  },
  midday: {
    label: 'Midday Off-Peak',
    shortLabel: '11:00–16:59',
    rangeLabel: '11:00 to 16:59',
  },
  evening_peak: {
    label: 'Evening Peak',
    shortLabel: '17:00–20:59',
    rangeLabel: '17:00 to 20:59',
  },
  late_evening: {
    label: 'Late Evening',
    shortLabel: '21:00–04:59',
    rangeLabel: '21:00 to 04:59',
  },
};

export const TIME_SLOT_ORDER: TimeSlotId[] = [
  'early_morning',
  'morning_peak',
  'midday',
  'evening_peak',
  'late_evening',
];

const CROWDING_WEIGHT: Record<CrowdingCategory, number> = {
  Low: 20,
  Moderate: 48,
  High: 74,
  'Very High': 92,
};

/** Maps HH:mm time strings to discrete transit demand windows. */
export function resolveTimeSlot(travelTime: string): TimeSlotId {
  const match = /^(\d{1,2}):(\d{2})$/.exec(travelTime.trim());
  if (!match) return 'morning_peak';
  const hour = Number(match[1]);
  if (hour >= 5 && hour < 8) return 'early_morning';
  if (hour >= 8 && hour < 11) return 'morning_peak';
  if (hour >= 11 && hour < 17) return 'midday';
  if (hour >= 17 && hour < 21) return 'evening_peak';
  return 'late_evening';
}

/** Maps YYYY-MM-DD date string to weekday or weekend without timezone drift. */
export function resolveDayType(travelDate: string): DayType {
  const parts = travelDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 'weekday';
  const [year, month, day] = parts;
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return utcDay === 0 || utcDay === 6 ? 'weekend' : 'weekday';
}

/** Counts unique transit hubs traversed across all legs of a corridor. */
export function countCorridorStops(corridor: RouteCorridor): number {
  const uniqueStops = new Set<string>();
  for (const leg of corridor.legs) {
    for (const stopId of leg.stopIds) {
      uniqueStops.add(stopId);
    }
  }
  return uniqueStops.size;
}

/** Finds exact time-slot + day-type crowding record, or falls back to weekday if weekend fixture is absent. */
export function findCrowdingRecord(
  records: TimeSlotCrowdingRecord[],
  corridorId: string,
  timeSlot: TimeSlotId,
  dayType: DayType
): TimeSlotCrowdingRecord | null {
  const exact = records.find(
    (r) => r.corridorId === corridorId && r.timeSlot === timeSlot && r.dayType === dayType
  );
  if (exact) return exact;

  // Fallback to weekday record for the same time slot if weekend entry is not present in tiny fixture
  if (dayType === 'weekend') {
    const weekdayMatch = records.find(
      (r) => r.corridorId === corridorId && r.timeSlot === timeSlot && r.dayType === 'weekday'
    );
    if (weekdayMatch) return weekdayMatch;
  }

  return null;
}

/**
 * Computes a lower-is-better priority score for ranking journey options.
 * Never fabricates travel times; uses only crowding index, transfer count, and stop count
 * (plus verifiedTravelTimeMinutes if supplied by an official dataset).
 */
export function computeRecommendationScore(
  corridor: RouteCorridor,
  crowdingRecord: TimeSlotCrowdingRecord | null,
  priority: TravelPriority
): number {
  const crowdingScore = crowdingRecord
    ? crowdingRecord.relativeCrowdingIndex
    : 55; // neutral midpoint when record is unavailable
  const transferPenalty = corridor.transfers * 22;
  const stopCount = countCorridorStops(corridor);
  const verifiedTimeTerm =
    corridor.verifiedTravelTimeMinutes !== null ? corridor.verifiedTravelTimeMinutes * 0.5 : 0;

  switch (priority) {
    case 'least_crowded':
      return crowdingScore * 1.6 + transferPenalty * 0.35 + stopCount * 1.5;
    case 'fewest_transfers':
      return transferPenalty * 2.2 + crowdingScore * 0.45 + stopCount * 2 + verifiedTimeTerm;
    case 'balanced':
    default:
      return crowdingScore * 1.0 + transferPenalty * 0.9 + stopCount * 2 + verifiedTimeTerm;
  }
}

function buildRecommendationReason(
  option: {
    corridor: RouteCorridor;
    expectedCrowding: CrowdingCategory | 'Unavailable';
    relativeCrowdingIndex: number | null;
  },
  priority: TravelPriority,
  isTop: boolean
): string {
  if (!isTop) {
    if (option.corridor.transfers === 0) {
      return 'Direct corridor option with zero transfers';
    }
    return `Requires ${option.corridor.transfers} transfer${option.corridor.transfers > 1 ? 's' : ''}`;
  }

  if (priority === 'least_crowded') {
    return option.expectedCrowding !== 'Unavailable'
      ? `Lowest expected crowding (${option.expectedCrowding}) among matching options`
      : 'Top-ranked low-crowding candidate';
  }
  if (priority === 'fewest_transfers') {
    return option.corridor.transfers === 0
      ? 'Direct zero-transfer corridor with lowest crowding among direct routes'
      : `Minimum transfers (${option.corridor.transfers}) available for this pair`;
  }
  return 'Best balance of expected crowding category and transfer simplicity';
}

/**
 * Pure crowdedness-aware journey recommendation engine.
 * Completely decoupled from React state and presentation components.
 */
export function planJourneys(
  dataset: SmartTransitDataset,
  request: JourneyPlanRequest
): JourneyPlanResult {
  const timeSlot = resolveTimeSlot(request.travelTime);
  const dayType = resolveDayType(request.travelDate);

  if (!request.originStopId || !request.destinationStopId) {
    return {
      status: 'validation_error',
      errorMessage: 'Select both an origin stop and a destination stop to plan a journey.',
      timeSlot,
      dayType,
      options: [],
    };
  }

  if (request.originStopId === request.destinationStopId) {
    return {
      status: 'validation_error',
      errorMessage:
        'Origin and destination must be different transit hubs. Choose another destination to compare routes.',
      timeSlot,
      dayType,
      options: [],
    };
  }

  if (!request.travelDate || !request.travelTime) {
    return {
      status: 'validation_error',
      errorMessage: 'Provide both travel date and departure time to evaluate expected crowding.',
      timeSlot,
      dayType,
      options: [],
    };
  }

  const matchingCorridors = dataset.corridors.filter((corridor) => {
    const matchesEndpoints =
      corridor.originStopId === request.originStopId &&
      corridor.destinationStopId === request.destinationStopId;
    if (!matchesEndpoints) return false;
    if (request.modeFilter === 'all') return true;
    return corridor.primaryMode === request.modeFilter;
  });

  if (matchingCorridors.length === 0) {
    return {
      status: 'empty',
      timeSlot,
      dayType,
      options: [],
    };
  }

  const scored = matchingCorridors.map((corridor) => {
    const crowdingRecord = findCrowdingRecord(
      dataset.crowdingRecords,
      corridor.id,
      timeSlot,
      dayType
    );
    const expectedCrowding: CrowdingCategory | 'Unavailable' = crowdingRecord
      ? crowdingRecord.expectedCrowding
      : 'Unavailable';
    const relativeCrowdingIndex = crowdingRecord
      ? crowdingRecord.relativeCrowdingIndex
      : null;
    const recommendationScore = computeRecommendationScore(
      corridor,
      crowdingRecord,
      request.priority
    );

    return {
      corridor,
      crowdingRecord,
      expectedCrowding,
      relativeCrowdingIndex,
      timeSlot,
      dayType,
      stopCount: countCorridorStops(corridor),
      recommendationScore,
    };
  });

  scored.sort((a, b) => {
    if (a.recommendationScore !== b.recommendationScore) {
      return a.recommendationScore - b.recommendationScore;
    }
    const aWeight =
      a.expectedCrowding === 'Unavailable' ? 999 : CROWDING_WEIGHT[a.expectedCrowding];
    const bWeight =
      b.expectedCrowding === 'Unavailable' ? 999 : CROWDING_WEIGHT[b.expectedCrowding];
    if (aWeight !== bWeight) return aWeight - bWeight;
    return a.corridor.id.localeCompare(b.corridor.id);
  });

  const options: JourneyOption[] = scored.map((item, idx) => ({
    ...item,
    isRecommended: idx === 0,
    recommendationReason: buildRecommendationReason(item, request.priority, idx === 0),
  }));

  return {
    status: 'ok',
    timeSlot,
    dayType,
    options,
  };
}

/** Aggregates time-of-day crowding indices for analytics charts, filtered by dayType and mode. */
export function buildTimeSlotAnalytics(
  dataset: SmartTransitDataset,
  dayType: DayType,
  modeFilter: 'all' | TransitMode
): TimeSlotAnalyticsPoint[] {
  const corridorById = new Map<string, RouteCorridor>(
    dataset.corridors.map((c) => [c.id, c])
  );

  return TIME_SLOT_ORDER.map((slot) => {
    const records = dataset.crowdingRecords.filter((rec) => {
      if (rec.timeSlot !== slot || rec.dayType !== dayType) return false;
      const corridor = corridorById.get(rec.corridorId);
      if (!corridor) return false;
      if (modeFilter !== 'all' && corridor.primaryMode !== modeFilter) return false;
      return true;
    });

    const avgFor = (mode?: TransitMode): number | null => {
      const subset = mode
        ? records.filter((r) => corridorById.get(r.corridorId)?.primaryMode === mode)
        : records;
      if (subset.length === 0) return null;
      const total = subset.reduce((sum, r) => sum + r.relativeCrowdingIndex, 0);
      return Math.round(total / subset.length);
    };

    return {
      timeSlot: slot,
      label: TIME_SLOT_META[slot].label,
      shortLabel: TIME_SLOT_META[slot].shortLabel,
      metroAvgIndex: avgFor('metro'),
      busAvgIndex: avgFor('bus'),
      multimodalAvgIndex: avgFor('multimodal'),
      overallAvgIndex: avgFor(),
      recordCount: records.length,
    };
  });
}

/** Produces a corridor-by-corridor crowding comparison table for a selected time slot & day type. */
export function buildCorridorAnalyticsRows(
  dataset: SmartTransitDataset,
  timeSlot: TimeSlotId,
  dayType: DayType,
  modeFilter: 'all' | TransitMode
): CorridorAnalyticsRow[] {
  const stopMap = new Map<string, TransitStop>(dataset.stops.map((s) => [s.id, s]));

  return dataset.corridors
    .filter((corridor) => modeFilter === 'all' || corridor.primaryMode === modeFilter)
    .map((corridor): CorridorAnalyticsRow => {
      const record = findCrowdingRecord(dataset.crowdingRecords, corridor.id, timeSlot, dayType);
      const expectedCrowding: CrowdingCategory | 'Unavailable' = record
        ? record.expectedCrowding
        : 'Unavailable';
      return {
        corridorId: corridor.id,
        corridorName: corridor.name,
        originName: stopMap.get(corridor.originStopId)?.name ?? corridor.originStopId,
        destinationName:
          stopMap.get(corridor.destinationStopId)?.name ?? corridor.destinationStopId,
        primaryMode: corridor.primaryMode,
        transfers: corridor.transfers,
        expectedCrowding,
        relativeCrowdingIndex: record ? record.relativeCrowdingIndex : null,
        verifiedTicketVolume: record ? record.verifiedTicketVolume : null,
        isSyntheticTestValue: record
          ? record.isSyntheticTestValue
          : dataset.metadata.sourceType === 'synthetic_sample',
      };
    })
    .sort((a, b) => (b.relativeCrowdingIndex ?? -1) - (a.relativeCrowdingIndex ?? -1));
}

/** Returns quick-select origin/destination pairs that exist in the currently loaded dataset. */
export function getAvailableSamplePairs(
  dataset: SmartTransitDataset
): Array<{ originStopId: string; destinationStopId: string; label: string; routeCount: number }> {
  const stopMap = new Map<string, TransitStop>(dataset.stops.map((s) => [s.id, s]));
  const pairCounts = new Map<string, { originStopId: string; destinationStopId: string; count: number }>();

  for (const corridor of dataset.corridors) {
    const key = `${corridor.originStopId}::${corridor.destinationStopId}`;
    const existing = pairCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      pairCounts.set(key, {
        originStopId: corridor.originStopId,
        destinationStopId: corridor.destinationStopId,
        count: 1,
      });
    }
  }

  return Array.from(pairCounts.values()).map((entry) => {
    const origin = stopMap.get(entry.originStopId)?.name ?? entry.originStopId;
    const dest = stopMap.get(entry.destinationStopId)?.name ?? entry.destinationStopId;
    return {
      originStopId: entry.originStopId,
      destinationStopId: entry.destinationStopId,
      label: `${origin} to ${dest}`,
      routeCount: entry.count,
    };
  });
}
