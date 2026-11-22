import type {
  DemandBand,
  GtfsAgencyFilter,
  GtfsIndex,
  GtfsJourneyLeg,
  GtfsJourneyOption,
  GtfsJourneyPlanResult,
  GtfsJourneyPriority,
  GtfsJourneyRequest,
  GtfsLowerDemandAlternative,
  GtfsRouteAnalyticsRow,
  GtfsSamplePair,
  GtfsTimeSlotComparisonPoint,
  RawGtfsRoute,
  RawGtfsSegment,
  RawGtfsStop,
  RawSmartTransitCore,
  RouteChain,
  StopRouteEntry,
  TicketingRouteDemand,
  TicketingTimeWindow,
} from '../data/gtfsTypes';
import type { DayType, TimeSlotId } from '../data/types';
import {
  TIME_SLOT_META,
  TIME_SLOT_ORDER,
  resolveDayType,
  resolveTimeSlot,
} from './journeyPlanner';

const DEMAND_BAND_RANK: Record<DemandBand, number> = {
  Low: 1,
  Moderate: 2,
  High: 3,
  'Very high': 4,
};

const TRANSFER_BUFFER_MINUTES = 8;

const CURATED_DELHI_PAIR_CANDIDATES: Array<{
  originStopId: string;
  destinationStopId: string;
  label: string;
}> = [
  {
    originStopId: '4822',
    destinationStopId: '7587',
    label: 'ISBT Kashmere Gate → Azadpur Terminal',
  },
  {
    originStopId: '365',
    destinationStopId: '4822',
    label: 'Shivaji Stadium (CP) → ISBT Kashmere Gate',
  },
  {
    originStopId: '2839',
    destinationStopId: '2560',
    label: 'AIIMS Ring Road → Nehru Place Terminal',
  },
  {
    originStopId: '1574',
    destinationStopId: '2559',
    label: 'New Delhi Rly Stn Gate 2 → Nehru Place',
  },
  {
    originStopId: '7571',
    destinationStopId: '1574',
    label: 'Kashmere Gate → New Delhi Rly Stn',
  },
  {
    originStopId: '2270',
    destinationStopId: '4822',
    label: 'Karol Bagh Metro → ISBT Kashmere Gate',
  },
  {
    originStopId: '115',
    destinationStopId: '8256',
    label: 'ISBT Nityanand Marg → Anand Vihar ISBT',
  },
];

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildRouteChain(routeId: string, segs: RawGtfsSegment[]): RouteChain {
  const inDeg = new Map<string, number>();
  const nextMap = new Map<string, RawGtfsSegment>();

  for (const seg of segs) {
    if (!inDeg.has(seg.fromStopId)) {
      inDeg.set(seg.fromStopId, 0);
    }
    inDeg.set(seg.toStopId, (inDeg.get(seg.toStopId) ?? 0) + 1);
    const existing = nextMap.get(seg.fromStopId);
    if (!existing || seg.tripObservations > existing.tripObservations) {
      nextMap.set(seg.fromStopId, seg);
    }
  }

  let startStopId: string | null = null;
  let bestStartObs = -1;
  for (const [sid, deg] of inDeg.entries()) {
    if (deg === 0) {
      const edge = nextMap.get(sid);
      const obs = edge?.tripObservations ?? 0;
      if (obs > bestStartObs) {
        bestStartObs = obs;
        startStopId = sid;
      }
    }
  }
  if (!startStopId && segs.length > 0) {
    startStopId = segs[0].fromStopId;
  }

  const stops: string[] = [];
  const segments: RawGtfsSegment[] = [];
  const stopIndexMap = new Map<string, number>();

  if (startStopId) {
    const visited = new Set<string>([startStopId]);
    stops.push(startStopId);
    stopIndexMap.set(startStopId, 0);

    let curr = startStopId;
    while (nextMap.has(curr)) {
      const edge = nextMap.get(curr)!;
      if (visited.has(edge.toStopId)) break;
      visited.add(edge.toStopId);
      segments.push(edge);
      stopIndexMap.set(edge.toStopId, stops.length);
      stops.push(edge.toStopId);
      curr = edge.toStopId;
    }
  }

  return { routeId, stops, segments, stopIndexMap };
}

export function buildGtfsIndex(core: RawSmartTransitCore): GtfsIndex {
  const stopById = new Map<string, RawGtfsStop>(core.stops.map((s) => [s.stopId, s]));
  const routeById = new Map<string, RawGtfsRoute>(core.routes.map((r) => [r.routeId, r]));
  const demandByRouteId = new Map<string, TicketingRouteDemand>(
    core.ticketingDemandMatched.map((d) => [d.gtfsRouteId, d])
  );

  const segsByRoute = new Map<string, RawGtfsSegment[]>();
  for (const seg of core.routeSegments) {
    let list = segsByRoute.get(seg.routeId);
    if (!list) {
      list = [];
      segsByRoute.set(seg.routeId, list);
    }
    list.push(seg);
  }

  const routeChains = new Map<string, RouteChain>();
  const stopToRoutes = new Map<string, StopRouteEntry[]>();
  const stopDegree = new Map<string, number>();

  for (const [routeId, segs] of segsByRoute.entries()) {
    const chain = buildRouteChain(routeId, segs);
    if (chain.stops.length < 2) continue;
    routeChains.set(routeId, chain);

    for (let i = 0; i < chain.stops.length; i++) {
      const sid = chain.stops[i];
      let entries = stopToRoutes.get(sid);
      if (!entries) {
        entries = [];
        stopToRoutes.set(sid, entries);
      }
      entries.push({ routeId, index: i });
      stopDegree.set(sid, (stopDegree.get(sid) ?? 0) + 1);
    }
  }

  const topHubStops = [...stopDegree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([sid]) => stopById.get(sid))
    .filter((s): s is RawGtfsStop => Boolean(s));

  // Verify curated sample pairs against actual graph
  const samplePairs: GtfsSamplePair[] = [];
  for (const cand of CURATED_DELHI_PAIR_CANDIDATES) {
    if (!stopById.has(cand.originStopId) || !stopById.has(cand.destinationStopId)) continue;
    const fromEntries = stopToRoutes.get(cand.originStopId) ?? [];
    const toMap = new Map((stopToRoutes.get(cand.destinationStopId) ?? []).map((e) => [e.routeId, e.index]));
    let directCount = 0;
    for (const fe of fromEntries) {
      const ti = toMap.get(fe.routeId);
      if (ti !== undefined && ti > fe.index) {
        directCount++;
      }
    }
    if (directCount > 0) {
      samplePairs.push({ ...cand, directCount });
    }
  }

  // Fallback dynamic pair discovery if running on a small synthetic GTFS subset
  if (samplePairs.length === 0) {
    for (const [routeId, chain] of routeChains.entries()) {
      if (chain.stops.length >= 3) {
        const originStopId = chain.stops[0];
        const destinationStopId = chain.stops[chain.stops.length - 1];
        const oName = stopById.get(originStopId)?.name ?? originStopId;
        const dName = stopById.get(destinationStopId)?.name ?? destinationStopId;
        samplePairs.push({
          originStopId,
          destinationStopId,
          label: `${oName} → ${dName}`,
          directCount: 1,
        });
        if (samplePairs.length >= 4 || !routeId) break;
      }
    }
  }

  return {
    metadata: core.metadata,
    timeSlots: core.timeSlots,
    stops: core.stops,
    stopById,
    routes: core.routes,
    routeById,
    demandByRouteId,
    unmatchedTicketingRoutes: core.ticketingRoutesUnmatched,
    unmatchedGtfsRouteCount: Math.max(0, core.routes.length - demandByRouteId.size),
    routeChains,
    stopToRoutes,
    stopDegree,
    topHubStops,
    shapes: core.shapes,
    samplePairs,
  };
}

function getDemandWindow(
  demandMatch: TicketingRouteDemand | null,
  dayType: DayType,
  timeSlot: TimeSlotId
): TicketingTimeWindow | null {
  if (!demandMatch) return null;
  return (
    demandMatch.timeWindows.find(
      (tw) => tw.dayType === dayType && tw.timeSlot === timeSlot
    ) ?? null
  );
}

function getLowestDemandWindowForDayType(
  demandMatch: TicketingRouteDemand | null,
  dayType: DayType
): TicketingTimeWindow | null {
  if (!demandMatch) return null;
  const windows = demandMatch.timeWindows.filter((tw) => tw.dayType === dayType);
  if (windows.length === 0) return null;
  return [...windows].sort(
    (a, b) => a.withinRouteDemandIndex - b.withinRouteDemandIndex
  )[0];
}

export function sliceShapeForLeg(
  fullShape: [number, number][],
  stopCoords: [number, number][]
): { points: [number, number][]; source: 'gtfs_shape' | 'gtfs_stops' } {
  if (stopCoords.length < 2) {
    return { points: stopCoords, source: 'gtfs_stops' };
  }
  if (!fullShape || fullShape.length < 2) {
    return { points: stopCoords, source: 'gtfs_stops' };
  }

  const startCoord = stopCoords[0];
  const endCoord = stopCoords[stopCoords.length - 1];

  let startIdx = 0;
  let bestStartDist = Infinity;
  let endIdx = fullShape.length - 1;
  let bestEndDist = Infinity;

  for (let i = 0; i < fullShape.length; i++) {
    const pt = fullShape[i];
    const ds = distanceMeters(startCoord[0], startCoord[1], pt[0], pt[1]);
    if (ds < bestStartDist) {
      bestStartDist = ds;
      startIdx = i;
    }
    const de = distanceMeters(endCoord[0], endCoord[1], pt[0], pt[1]);
    if (de < bestEndDist) {
      bestEndDist = de;
      endIdx = i;
    }
  }

  // Only use the sliced GTFS shape if direction aligns cleanly and endpoints are reasonably near
  if (startIdx < endIdx && bestStartDist < 2000 && bestEndDist < 2000) {
    const sliced = fullShape.slice(startIdx, endIdx + 1);
    return {
      points: [startCoord, ...sliced, endCoord],
      source: 'gtfs_shape',
    };
  }

  return { points: stopCoords, source: 'gtfs_stops' };
}

function buildLeg(
  index: GtfsIndex,
  route: RawGtfsRoute,
  chain: RouteChain,
  fromIdx: number,
  toIdx: number,
  dayType: DayType,
  timeSlot: TimeSlotId,
  legSuffix: string
): GtfsJourneyLeg {
  const stopIds = chain.stops.slice(fromIdx, toIdx + 1);
  let scheduledSeconds = 0;
  let flaggedSegmentsCount = 0;

  for (let i = fromIdx; i < toIdx; i++) {
    const seg = chain.segments[i];
    if (!seg) continue;
    if (seg.durationNeedsReview || seg.avgScheduledTravelSeconds <= 0) {
      flaggedSegmentsCount++;
      scheduledSeconds += 90; // conservative fallback for sorting only; flagged in UI
    } else {
      scheduledSeconds += seg.avgScheduledTravelSeconds;
    }
  }

  const stopCoords: [number, number][] = stopIds
    .map((sid) => index.stopById.get(sid))
    .filter((s): s is RawGtfsStop => Boolean(s))
    .map((s) => [s.lat, s.lon] as [number, number]);

  const shapeId = route.shapeIds?.[0];
  const fullRouteShapePoints = shapeId && index.shapes[shapeId] ? index.shapes[shapeId] : [];
  const sliced = sliceShapeForLeg(fullRouteShapePoints, stopCoords);

  const demandMatch = index.demandByRouteId.get(route.routeId) ?? null;
  const demandWindow = getDemandWindow(demandMatch, dayType, timeSlot);
  const lowestDemandSlotForRoute = getLowestDemandWindowForDayType(demandMatch, dayType);

  return {
    legId: `${route.routeId}-${legSuffix}`,
    routeId: route.routeId,
    shortName: route.shortName,
    description: route.description || route.longName,
    agencyId: route.agencyId,
    tripCount: route.tripCount,
    fromStopId: chain.stops[fromIdx],
    toStopId: chain.stops[toIdx],
    stopIds,
    scheduledSeconds,
    flaggedSegmentsCount,
    shapePoints: sliced.points,
    fullRouteShapePoints,
    shapeSource: sliced.source,
    demandMatch,
    demandWindow,
    lowestDemandSlotForRoute,
  };
}

function findNearbyStops(
  index: GtfsIndex,
  targetStop: RawGtfsStop,
  maxRadiusMeters: number,
  maxResults = 6
): Array<{ stop: RawGtfsStop; distMeters: number }> {
  const results: Array<{ stop: RawGtfsStop; distMeters: number }> = [
    { stop: targetStop, distMeters: 0 },
  ];

  // Fast bounding box pre-filter (~0.0025 deg ~ 275m)
  const degPad = maxRadiusMeters / 100000 + 0.001;
  for (const s of index.stops) {
    if (s.stopId === targetStop.stopId) continue;
    if (
      Math.abs(s.lat - targetStop.lat) > degPad ||
      Math.abs(s.lon - targetStop.lon) > degPad
    ) {
      continue;
    }
    const d = distanceMeters(targetStop.lat, targetStop.lon, s.lat, s.lon);
    if (d <= maxRadiusMeters) {
      results.push({ stop: s, distMeters: Math.round(d) });
    }
  }

  return results.sort((a, b) => a.distMeters - b.distMeters).slice(0, maxResults);
}

function passesAgencyFilter(route: RawGtfsRoute, filter: GtfsAgencyFilter): boolean {
  if (filter === 'all') return true;
  return route.agencyId === filter;
}

function computeDemandSummary(legs: GtfsJourneyLeg[]): {
  status: 'matched' | 'partial_match' | 'unmatched';
  primaryBand: DemandBand | 'Unmatched';
  primaryWithinRouteIndex: number | null;
  combinedHourlyPax: number | null;
} {
  const matchedWindows = legs
    .map((l) => l.demandWindow)
    .filter((w): w is TicketingTimeWindow => w !== null);

  if (matchedWindows.length === 0) {
    return {
      status: 'unmatched',
      primaryBand: 'Unmatched',
      primaryWithinRouteIndex: null,
      combinedHourlyPax: null,
    };
  }

  // Worst demand band across legs (honest indicator without summing/averaging across different routes' normalized indices)
  let worstBand: DemandBand = matchedWindows[0].withinRouteDemandBand;
  let worstRank = DEMAND_BAND_RANK[worstBand];
  let primaryIndex = matchedWindows[0].withinRouteDemandIndex;

  for (const w of matchedWindows) {
    const r = DEMAND_BAND_RANK[w.withinRouteDemandBand];
    if (r > worstRank || (r === worstRank && w.withinRouteDemandIndex > primaryIndex)) {
      worstRank = r;
      worstBand = w.withinRouteDemandBand;
      primaryIndex = w.withinRouteDemandIndex;
    }
  }

  const maxHourlyPax = Math.max(
    ...matchedWindows.map((w) => w.avgTicketedPassengersPerHourPerDatasetDay)
  );

  return {
    status: matchedWindows.length === legs.length ? 'matched' : 'partial_match',
    primaryBand: worstBand,
    primaryWithinRouteIndex: matchedWindows.length === 1 ? primaryIndex : null,
    combinedHourlyPax:
      maxHourlyPax > 0 && maxHourlyPax < 0.01
        ? maxHourlyPax
        : Math.round(maxHourlyPax * 100) / 100,
  };
}

function computeOptionScore(
  option: Omit<GtfsJourneyOption, 'recommendationScore' | 'isRecommended' | 'recommendationReason'>,
  priority: GtfsJourneyPriority
): number {
  const transferPenalty = option.transfers * 28;
  const walkPenalty = (option.boardWalkMeters + option.transferWalkMeters + option.alightWalkMeters) * 0.04;

  // Within-route band penalty (neutral 2.5 if unmatched so unmatched is never treated as "Low")
  const bandScore =
    option.primaryDemandBand === 'Unmatched'
      ? 2.5
      : DEMAND_BAND_RANK[option.primaryDemandBand];
  const withinIdx = option.primaryWithinRouteIndex ?? 55;
  const hourlyIntensity = option.combinedHourlyPax ?? 40;

  switch (priority) {
    case 'least_crowded':
      return (
        bandScore * 35 +
        withinIdx * 0.45 +
        Math.min(80, hourlyIntensity * 0.2) +
        option.totalEstimatedMinutes * 0.4 +
        transferPenalty * 0.6 +
        walkPenalty
      );
    case 'fewest_transfers':
      return (
        option.transfers * 120 +
        option.totalEstimatedMinutes * 1.0 +
        bandScore * 8 +
        walkPenalty
      );
    case 'balanced':
    default:
      return (
        option.totalEstimatedMinutes * 1.0 +
        transferPenalty +
        bandScore * 12 +
        withinIdx * 0.15 +
        walkPenalty
      );
  }
}

function buildRecommendationReason(
  option: Omit<GtfsJourneyOption, 'recommendationScore' | 'isRecommended' | 'recommendationReason'>,
  priority: GtfsJourneyPriority,
  isTop: boolean
): string {
  const demandPhrase =
    option.primaryDemandBand === 'Unmatched'
      ? 'unmatched in Oct 2026 ticketing feed'
      : `${option.primaryDemandBand} within-route historical demand`;

  if (!isTop) {
    if (option.transfers === 0) {
      return `Direct route (~${option.totalEstimatedMinutes} min schedule-based estimate) · ${demandPhrase}`;
    }
    return `1-transfer option via ${option.transferStop?.name ?? 'interchange'} · ${demandPhrase}`;
  }

  if (priority === 'least_crowded') {
    return option.primaryDemandBand !== 'Unmatched'
      ? `Lowest within-route historical demand (${option.primaryDemandBand}) with ~${option.totalEstimatedMinutes} min scheduled travel`
      : 'Top-ranked option for current filters (ticketing match unavailable on direct matches)';
  }
  if (priority === 'fewest_transfers') {
    return option.transfers === 0
      ? `Fastest direct bus (~${option.totalEstimatedMinutes} min schedule-based estimate) with 0 transfers`
      : `Minimum 1-transfer path (~${option.totalEstimatedMinutes} min schedule-based estimate)`;
  }
  return option.transfers === 0
    ? `Recommended direct balance of ~${option.totalEstimatedMinutes} min scheduled time and ${demandPhrase}`
    : `Recommended 1-transfer route (~${option.totalEstimatedMinutes} min scheduled time) · ${demandPhrase}`;
}

function buildLowerDemandTimeSuggestion(
  legs: GtfsJourneyLeg[],
  currentSlot: TimeSlotId
): string | null {
  const firstMatchedLeg = legs.find((l) => l.demandWindow && l.lowestDemandSlotForRoute);
  if (!firstMatchedLeg || !firstMatchedLeg.demandWindow || !firstMatchedLeg.lowestDemandSlotForRoute) {
    return null;
  }

  const current = firstMatchedLeg.demandWindow;
  const best = firstMatchedLeg.lowestDemandSlotForRoute;
  if (
    best.timeSlot === currentSlot ||
    DEMAND_BAND_RANK[current.withinRouteDemandBand] <= DEMAND_BAND_RANK['Moderate'] &&
      current.withinRouteDemandIndex - best.withinRouteDemandIndex < 20
  ) {
    return null;
  }

  const slotMeta = TIME_SLOT_META[best.timeSlot];
  return `Off-peak timing tip for route ${firstMatchedLeg.shortName}: ${slotMeta.label} (${slotMeta.shortLabel}) has ${best.withinRouteDemandBand} within-route demand (${Math.round(best.withinRouteDemandIndex)}/100 of route peak vs ${Math.round(current.withinRouteDemandIndex)}/100 now).`;
}

export function planGtfsJourneys(
  index: GtfsIndex,
  request: GtfsJourneyRequest
): GtfsJourneyPlanResult {
  const timeSlot = resolveTimeSlot(request.travelTime);
  const dayType = resolveDayType(request.travelDate);

  if (!request.originStopId || !request.destinationStopId) {
    return {
      status: 'validation_error',
      errorMessage: 'Select both an origin bus stop and a destination bus stop to plan a journey.',
      timeSlot,
      dayType,
      options: [],
      lowerDemandAlternative: null,
    };
  }

  if (request.originStopId === request.destinationStopId) {
    return {
      status: 'validation_error',
      errorMessage: 'Origin and destination stops must be different. Choose another destination.',
      timeSlot,
      dayType,
      options: [],
      lowerDemandAlternative: null,
    };
  }

  if (!request.travelDate || !request.travelTime) {
    return {
      status: 'validation_error',
      errorMessage: 'Provide both travel date and departure time.',
      timeSlot,
      dayType,
      options: [],
      lowerDemandAlternative: null,
    };
  }

  const originStop = index.stopById.get(request.originStopId);
  const destinationStop = index.stopById.get(request.destinationStopId);
  if (!originStop || !destinationStop) {
    return {
      status: 'validation_error',
      errorMessage: 'Selected stop could not be found in the loaded GTFS feed.',
      timeSlot,
      dayType,
      options: [],
      lowerDemandAlternative: null,
    };
  }

  // Exact stop + nearby terminal bays within 220m (always keeping exact match dist=0 first)
  const originCandidates = findNearbyStops(index, originStop, 220, 5);
  const destCandidates = findNearbyStops(index, destinationStop, 220, 5);

  const candidates: Array<
    Omit<GtfsJourneyOption, 'recommendationScore' | 'isRecommended' | 'recommendationReason'>
  > = [];
  const seenRouteKeys = new Set<string>();

  // 1) Direct (0-transfer) bus routes
  for (const oc of originCandidates) {
    const fromEntries = index.stopToRoutes.get(oc.stop.stopId) ?? [];
    for (const dc of destCandidates) {
      if (oc.stop.stopId === dc.stop.stopId) continue;
      const toEntries = index.stopToRoutes.get(dc.stop.stopId) ?? [];
      const toMap = new Map(toEntries.map((e) => [e.routeId, e.index]));

      for (const fe of fromEntries) {
        const ti = toMap.get(fe.routeId);
        if (ti === undefined || ti <= fe.index) continue;
        if (seenRouteKeys.has(`direct:${fe.routeId}`)) continue;

        const route = index.routeById.get(fe.routeId);
        const chain = index.routeChains.get(fe.routeId);
        if (!route || !chain || !passesAgencyFilter(route, request.agencyFilter)) continue;

        seenRouteKeys.add(`direct:${fe.routeId}`);
        const leg = buildLeg(index, route, chain, fe.index, ti, dayType, timeSlot, 'leg1');
        const segmentMinutes = Math.max(1, Math.round(leg.scheduledSeconds / 60));
        const demand = computeDemandSummary([leg]);

        candidates.push({
          id: `opt-direct-${route.routeId}`,
          title: `Route ${route.shortName} · Direct (${route.agencyId})`,
          transfers: 0,
          legs: [leg],
          originStop,
          destinationStop,
          boardStop: oc.stop,
          alightStop: dc.stop,
          boardWalkMeters: oc.distMeters,
          transferWalkMeters: 0,
          alightWalkMeters: dc.distMeters,
          segmentMinutes,
          transferBufferMinutes: 0,
          totalEstimatedMinutes: segmentMinutes,
          flaggedSegmentsCount: leg.flaggedSegmentsCount,
          stopCount: leg.stopIds.length,
          demandStatus: demand.status,
          primaryDemandBand: demand.primaryBand,
          primaryWithinRouteIndex: demand.primaryWithinRouteIndex,
          combinedHourlyPax: demand.combinedHourlyPax,
          timeSlot,
          dayType,
          lowerDemandTimeSuggestion: buildLowerDemandTimeSuggestion([leg], timeSlot),
        });
      }
    }
  }

  // 2) 1-transfer bus routes (search if direct options < 8 so commuters always have alternatives)
  if (candidates.length < 8) {
    const directRouteIds = new Set(candidates.flatMap((c) => c.legs.map((l) => l.routeId)));
    const directBaselineDist = distanceMeters(
      originStop.lat,
      originStop.lon,
      destinationStop.lat,
      destinationStop.lon
    );

    const exactToRoutes = new Map<string, { stop: RawGtfsStop; dist: number; index: number }>();
    for (const dc of destCandidates.slice(0, 3)) {
      for (const te of index.stopToRoutes.get(dc.stop.stopId) ?? []) {
        if (directRouteIds.has(te.routeId)) continue;
        const existing = exactToRoutes.get(te.routeId);
        if (!existing || dc.distMeters < existing.dist) {
          exactToRoutes.set(te.routeId, {
            stop: dc.stop,
            dist: dc.distMeters,
            index: te.index,
          });
        }
      }
    }

    let transferFound = 0;
    const MAX_TRANSFER_CANDIDATES = 28;

    for (const oc of originCandidates.slice(0, 3)) {
      if (transferFound >= MAX_TRANSFER_CANDIDATES) break;
      const fromEntries = (index.stopToRoutes.get(oc.stop.stopId) ?? []).slice(0, 30);

      for (const fe of fromEntries) {
        if (transferFound >= MAX_TRANSFER_CANDIDATES) break;
        if (directRouteIds.has(fe.routeId)) continue;
        const route1 = index.routeById.get(fe.routeId);
        const chain1 = index.routeChains.get(fe.routeId);
        if (!route1 || !chain1 || !passesAgencyFilter(route1, request.agencyFilter)) continue;

        // Walk forward along route1 (skip very first hop and cap extreme detours)
        const maxHop1 = Math.min(chain1.stops.length - 1, fe.index + 38);
        for (let k = fe.index + 1; k <= maxHop1; k++) {
          if (transferFound >= MAX_TRANSFER_CANDIDATES) break;
          const midStopId = chain1.stops[k];
          if (midStopId === request.originStopId || midStopId === request.destinationStopId) continue;

          const midStop = index.stopById.get(midStopId);
          if (!midStop) continue;

          // Prune severe geometric backtracks (> 3.2x straight line + 3km)
          const viaDist =
            distanceMeters(originStop.lat, originStop.lon, midStop.lat, midStop.lon) +
            distanceMeters(midStop.lat, midStop.lon, destinationStop.lat, destinationStop.lon);
          if (directBaselineDist > 1000 && viaDist > directBaselineDist * 3.2 + 3000) continue;

          const midEntries = index.stopToRoutes.get(midStopId) ?? [];
          for (const me of midEntries) {
            if (me.routeId === fe.routeId) continue;
            const destHit = exactToRoutes.get(me.routeId);
            if (!destHit || destHit.index <= me.index) continue;

            const pairKey = `1x:${fe.routeId}>${me.routeId}`;
            if (seenRouteKeys.has(pairKey)) continue;

            const route2 = index.routeById.get(me.routeId);
            const chain2 = index.routeChains.get(me.routeId);
            if (!route2 || !chain2 || !passesAgencyFilter(route2, request.agencyFilter)) continue;

            seenRouteKeys.add(pairKey);
            const leg1 = buildLeg(index, route1, chain1, fe.index, k, dayType, timeSlot, 'leg1');
            const leg2 = buildLeg(
              index,
              route2,
              chain2,
              me.index,
              destHit.index,
              dayType,
              timeSlot,
              'leg2'
            );

            const segmentMinutes = Math.max(
              2,
              Math.round((leg1.scheduledSeconds + leg2.scheduledSeconds) / 60)
            );
            const totalEstimatedMinutes = segmentMinutes + TRANSFER_BUFFER_MINUTES;
            const demand = computeDemandSummary([leg1, leg2]);

            candidates.push({
              id: `opt-transfer-${route1.routeId}-${route2.routeId}`,
              title: `Routes ${route1.shortName} → ${route2.shortName}`,
              transfers: 1,
              legs: [leg1, leg2],
              originStop,
              destinationStop,
              boardStop: oc.stop,
              alightStop: destHit.stop,
              transferStop: midStop,
              transferArrivalStop: midStop,
              boardWalkMeters: oc.distMeters,
              transferWalkMeters: 0,
              alightWalkMeters: destHit.dist,
              segmentMinutes,
              transferBufferMinutes: TRANSFER_BUFFER_MINUTES,
              totalEstimatedMinutes,
              flaggedSegmentsCount: leg1.flaggedSegmentsCount + leg2.flaggedSegmentsCount,
              stopCount: leg1.stopIds.length + leg2.stopIds.length - 1,
              demandStatus: demand.status,
              primaryDemandBand: demand.primaryBand,
              primaryWithinRouteIndex: demand.primaryWithinRouteIndex,
              combinedHourlyPax: demand.combinedHourlyPax,
              timeSlot,
              dayType,
              lowerDemandTimeSuggestion: buildLowerDemandTimeSuggestion([leg1, leg2], timeSlot),
            });

            transferFound++;
            break; // one transfer point per (route1, route2) pair
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    return {
      status: 'empty',
      timeSlot,
      dayType,
      options: [],
      lowerDemandAlternative: null,
    };
  }

  const scored = candidates.map((cand) => ({
    ...cand,
    recommendationScore: computeOptionScore(cand, request.priority),
  }));

  scored.sort((a, b) => {
    if (a.recommendationScore !== b.recommendationScore) {
      return a.recommendationScore - b.recommendationScore;
    }
    if (a.transfers !== b.transfers) return a.transfers - b.transfers;
    return a.totalEstimatedMinutes - b.totalEstimatedMinutes;
  });

  // Cap displayed options to top 10 clearest distinct alternatives (always keeping best matched low-demand alternative if present)
  const topSlice = scored.slice(0, 10);
  if (topSlice.length === 10) {
    const lowDemandExtra = scored
      .slice(10)
      .find(
        (c) =>
          c.primaryDemandBand === 'Low' || c.primaryDemandBand === 'Moderate'
      );
    if (lowDemandExtra) {
      topSlice[9] = lowDemandExtra;
    }
  }

  const options: GtfsJourneyOption[] = topSlice.map((item, idx) => ({
    ...item,
    isRecommended: idx === 0,
    recommendationReason: buildRecommendationReason(item, request.priority, idx === 0),
  }));

  // Find a lower-demand alternative route among returned options if top option is High / Very high / Unmatched
  let lowerDemandAlternative: GtfsLowerDemandAlternative | null = null;
  const topOption = options[0];
  if (topOption && options.length > 1) {
    const topBandRank =
      topOption.primaryDemandBand === 'Unmatched'
        ? 99
        : DEMAND_BAND_RANK[topOption.primaryDemandBand];

    const calmer = options
      .slice(1)
      .filter((opt) => opt.primaryDemandBand !== 'Unmatched')
      .sort((a, b) => {
        const ra = DEMAND_BAND_RANK[a.primaryDemandBand as DemandBand];
        const rb = DEMAND_BAND_RANK[b.primaryDemandBand as DemandBand];
        if (ra !== rb) return ra - rb;
        return a.totalEstimatedMinutes - b.totalEstimatedMinutes;
      })[0];

    if (
      calmer &&
      calmer.primaryDemandBand !== 'Unmatched' &&
      DEMAND_BAND_RANK[calmer.primaryDemandBand] < topBandRank
    ) {
      const routeLabel = calmer.legs.map((l) => l.shortName).join(' → ');
      lowerDemandAlternative = {
        optionId: calmer.id,
        routeLabel,
        demandBand: calmer.primaryDemandBand,
        reason: `Route ${routeLabel} is in a ${calmer.primaryDemandBand} within-route historical demand window (~${calmer.totalEstimatedMinutes} min scheduled estimate) compared to ${topOption.primaryDemandBand} on the top-ranked option.`,
      };
    }
  }

  return {
    status: 'ok',
    timeSlot,
    dayType,
    options,
    lowerDemandAlternative,
  };
}

/**
 * Builds peak vs off-peak time-slot profiles across Weekday and Weekend
 * for either all matched routes or a single selected route.
 */
export function buildGtfsTimeSlotAnalytics(
  index: GtfsIndex,
  agencyFilter: GtfsAgencyFilter,
  selectedRouteId?: string
): GtfsTimeSlotComparisonPoint[] {
  const matched = [...index.demandByRouteId.values()].filter((rec) => {
    if (selectedRouteId && rec.gtfsRouteId !== selectedRouteId) return false;
    if (agencyFilter !== 'all' && rec.agencyId !== agencyFilter) return false;
    return true;
  });

  const axisLabels: Record<TimeSlotId, string> = {
    early_morning: 'Early',
    morning_peak: 'AM Peak',
    midday: 'Midday',
    evening_peak: 'PM Peak',
    late_evening: 'Late',
  };

  return TIME_SLOT_ORDER.map((slot) => {
    const weekdayWindows: TicketingTimeWindow[] = [];
    const weekendWindows: TicketingTimeWindow[] = [];

    for (const rec of matched) {
      for (const tw of rec.timeWindows) {
        if (tw.timeSlot !== slot) continue;
        if (tw.dayType === 'weekday') weekdayWindows.push(tw);
        else weekendWindows.push(tw);
      }
    }

    const avgIndex = (list: TicketingTimeWindow[]): number | null => {
      if (list.length === 0) return null;
      const sum = list.reduce((acc, w) => acc + w.withinRouteDemandIndex, 0);
      return Math.round((sum / list.length) * 10) / 10;
    };

    const avgHourly = (list: TicketingTimeWindow[]): number | null => {
      if (list.length === 0) return null;
      const sum = list.reduce((acc, w) => acc + w.avgTicketedPassengersPerHourPerDatasetDay, 0);
      return Math.round((sum / list.length) * 10) / 10;
    };

    let lowCount = 0;
    let moderateCount = 0;
    let highCount = 0;
    let veryHighCount = 0;
    for (const w of weekdayWindows) {
      if (w.withinRouteDemandBand === 'Low') lowCount++;
      else if (w.withinRouteDemandBand === 'Moderate') moderateCount++;
      else if (w.withinRouteDemandBand === 'High') highCount++;
      else if (w.withinRouteDemandBand === 'Very high') veryHighCount++;
    }

    return {
      timeSlot: slot,
      label: TIME_SLOT_META[slot].label,
      axisLabel: axisLabels[slot],
      shortLabel: TIME_SLOT_META[slot].shortLabel,
      weekdayIndex: avgIndex(weekdayWindows),
      weekendIndex: avgIndex(weekendWindows),
      weekdayHourlyPax: avgHourly(weekdayWindows),
      weekendHourlyPax: avgHourly(weekendWindows),
      lowCount,
      moderateCount,
      highCount,
      veryHighCount,
    };
  });
}

/**
 * Builds searchable route rows for the Analytics table, ordered by actual historical
 * ticketed passenger volume (never comparing within-route indices across routes as absolute crowding).
 */
export function buildGtfsRouteAnalyticsRows(
  index: GtfsIndex,
  timeSlot: TimeSlotId,
  dayType: DayType,
  agencyFilter: GtfsAgencyFilter,
  searchQuery: string,
  includeUnmatched = false
): GtfsRouteAnalyticsRow[] {
  const q = searchQuery.trim().toLowerCase();
  const rows: GtfsRouteAnalyticsRow[] = [];

  for (const route of index.routes) {
    if (!passesAgencyFilter(route, agencyFilter)) continue;
    const demand = index.demandByRouteId.get(route.routeId) ?? null;
    if (!includeUnmatched && !demand) continue;

    if (q) {
      const matchText = `${route.shortName} ${route.description} ${route.agencyId}`.toLowerCase();
      if (!matchText.includes(q)) continue;
    }

    const window = getDemandWindow(demand, dayType, timeSlot);
    rows.push({
      routeId: route.routeId,
      shortName: route.shortName,
      description: route.description || route.longName,
      agencyId: route.agencyId,
      tripCount: route.tripCount,
      totalOctPassengers: demand?.ticketedPassengers ?? 0,
      totalOctTickets: demand?.ticketCount ?? 0,
      windowHourlyPax: window
        ? Math.round(window.avgTicketedPassengersPerHourPerDatasetDay * 10) / 10
        : null,
      windowDailyPax: window
        ? Math.round(window.avgTicketedPassengersPerDatasetDay * 10) / 10
        : null,
      withinRouteDemandIndex: window ? Math.round(window.withinRouteDemandIndex * 10) / 10 : null,
      withinRouteDemandBand: window ? window.withinRouteDemandBand : 'Unmatched',
      isMatched: demand !== null,
    });
  }

  rows.sort((a, b) => {
    if (a.isMatched !== b.isMatched) return a.isMatched ? -1 : 1;
    const pa = a.windowHourlyPax ?? -1;
    const pb = b.windowHourlyPax ?? -1;
    if (pb !== pa) return pb - pa;
    return b.totalOctPassengers - a.totalOctPassengers;
  });

  return rows;
}
