import test from 'node:test';
import assert from 'node:assert/strict';
import type { RawSmartTransitCore } from '../data/gtfsTypes';
import { formatHourlyPax } from '../components/crowdingStyles';
import {
  buildGtfsIndex,
  buildGtfsRouteAnalyticsRows,
  buildGtfsTimeSlotAnalytics,
  planGtfsJourneys,
} from './gtfsEngine';

const MINI_GTFS_CORE: RawSmartTransitCore = {
  schemaVersion: 'smarttransit.integrated.v1',
  metadata: {
    purpose: 'Test fixture',
    gtfs: {
      sourceArchive: 'test.zip',
      feedVersion: 'v32',
      publisher: 'DTC / DIMTS',
      serviceDateRange: { start: '2025-01-01', end: '2040-01-01' },
      timezone: 'Asia/Kolkata',
      agencyCount: 2,
      routeCount: 3,
      stopCount: 4,
      tripCount: 40,
      stopTimeRecordCount: 160,
      shapeCount: 2,
      shapePointCount: 6,
      routeAgencies: { DTC: 2, DIMTS: 1 },
      stopsWithValidCoordinates: 4,
      adjacentRouteSegments: 5,
      segmentsFlaggedForDurationReview: 1,
      note: 'Test fixture',
    },
    ticketing: {
      name: 'Test ticketing',
      sourceFile: 'October-Delhi.csv.zip',
      csvMember: 'October-Delhi.csv',
      processedAtUTC: '2026-11-21T00:00:00Z',
      sourceTimestampTimezone: 'Asia/Kolkata (+05:30)',
      rawRows: 100,
      validRows: 100,
      skippedRows: 0,
      totalTicketedPassengersOnValidRows: 5000,
      routeCount: 3,
      dateCoverage: ['2026-10-15'],
      datasetDayCounts: { weekday: 22, weekend: 9 },
      measuresActualOnboardOccupancy: false,
      measuresLiveCrowding: false,
      methodology: 'Within-route normalized',
      limitations: ['Historical demand only'],
      routeMatchMethod: 'Exact match',
      matchedTicketingRoutes: 2,
      unmatchedTicketingRoutes: 1,
      matchedRoutePercent: 66.67,
    },
    limitations: ['Test limitation'],
  },
  timeSlots: {
    early_morning: { start: '05:00', end: '07:59', hours: 3 },
    morning_peak: { start: '08:00', end: '10:59', hours: 3 },
    midday: { start: '11:00', end: '16:59', hours: 6 },
    evening_peak: { start: '17:00', end: '20:59', hours: 4 },
    late_evening: { start: '21:00', end: '04:59', hours: 8 },
  },
  stops: [
    { stopId: 'S1', stopCode: 'C1', name: 'Kashmere Gate', lat: 28.6675, lon: 77.2282 },
    { stopId: 'S2', stopCode: 'C2', name: 'ITO Crossing', lat: 28.6289, lon: 77.2414 },
    { stopId: 'S3', stopCode: 'C3', name: 'Nehru Place', lat: 28.5494, lon: 77.2519 },
    { stopId: 'S4', stopCode: 'C4', name: 'Anand Vihar', lat: 28.6469, lon: 77.316 },
  ],
  routes: [
    {
      routeId: 'R1',
      agencyId: 'DTC',
      shortName: '449UP',
      longName: '449UP',
      description: 'Kashmere Gate to Nehru Place (Busy)',
      routeType: 3,
      tripCount: 20,
      shapeIds: ['SH1'],
    },
    {
      routeId: 'R2',
      agencyId: 'DIMTS',
      shortName: '425UP',
      longName: '425UP',
      description: 'Kashmere Gate to Nehru Place (Calmer)',
      routeType: 3,
      tripCount: 12,
      shapeIds: ['SH1'],
    },
    {
      routeId: 'R3',
      agencyId: 'DTC',
      shortName: 'UNMATCHED_R3',
      longName: 'UNMATCHED_R3',
      description: 'Nehru Place to Anand Vihar',
      routeType: 3,
      tripCount: 8,
      shapeIds: ['SH2'],
    },
  ],
  routeSegments: [
    {
      routeId: 'R1',
      directionId: '',
      fromStopId: 'S1',
      toStopId: 'S2',
      tripObservations: 20,
      avgScheduledTravelSeconds: 600,
      minScheduledTravelSeconds: 600,
      maxScheduledTravelSeconds: 600,
      durationNeedsReview: false,
    },
    {
      routeId: 'R1',
      directionId: '',
      fromStopId: 'S2',
      toStopId: 'S3',
      tripObservations: 20,
      avgScheduledTravelSeconds: 900,
      minScheduledTravelSeconds: 900,
      maxScheduledTravelSeconds: 900,
      durationNeedsReview: false,
    },
    {
      routeId: 'R2',
      directionId: '',
      fromStopId: 'S1',
      toStopId: 'S2',
      tripObservations: 12,
      avgScheduledTravelSeconds: 1800,
      minScheduledTravelSeconds: 1800,
      maxScheduledTravelSeconds: 1800,
      durationNeedsReview: false,
    },
    {
      routeId: 'R2',
      directionId: '',
      fromStopId: 'S2',
      toStopId: 'S3',
      tripObservations: 12,
      avgScheduledTravelSeconds: 1800,
      minScheduledTravelSeconds: 1800,
      maxScheduledTravelSeconds: 1800,
      durationNeedsReview: false,
    },
    {
      routeId: 'R3',
      directionId: '',
      fromStopId: 'S3',
      toStopId: 'S4',
      tripObservations: 8,
      avgScheduledTravelSeconds: 0,
      minScheduledTravelSeconds: 0,
      maxScheduledTravelSeconds: 0,
      durationNeedsReview: true,
    },
  ],
  shapes: {
    SH1: [
      [28.6675, 77.2282],
      [28.6289, 77.2414],
      [28.5494, 77.2519],
    ],
    SH2: [
      [28.5494, 77.2519],
      [28.6469, 77.316],
    ],
  },
  ticketingDemandMatched: [
    {
      ticketingRoute: '449UP',
      gtfsRouteId: 'R1',
      gtfsRouteShortName: '449UP',
      gtfsRouteLongName: '449UP',
      agencyId: 'DTC',
      ticketCount: 2000,
      ticketedPassengers: 2200,
      timeWindows: [
        {
          dayType: 'weekday',
          timeSlot: 'morning_peak',
          ticketCount: 900,
          ticketedPassengers: 1000,
          datasetDaysOfType: 22,
          avgTicketedPassengersPerDatasetDay: 45.45,
          avgTicketedPassengersPerHourPerDatasetDay: 15.15,
          withinRouteDemandIndex: 100,
          withinRouteDemandBand: 'Very high',
        },
        {
          dayType: 'weekday',
          timeSlot: 'midday',
          ticketCount: 400,
          ticketedPassengers: 440,
          datasetDaysOfType: 22,
          avgTicketedPassengersPerDatasetDay: 20,
          avgTicketedPassengersPerHourPerDatasetDay: 3.33,
          withinRouteDemandIndex: 22,
          withinRouteDemandBand: 'Low',
        },
      ],
    },
    {
      ticketingRoute: '425UP',
      gtfsRouteId: 'R2',
      gtfsRouteShortName: '425UP',
      gtfsRouteLongName: '425UP',
      agencyId: 'DIMTS',
      ticketCount: 900,
      ticketedPassengers: 950,
      timeWindows: [
        {
          dayType: 'weekday',
          timeSlot: 'morning_peak',
          ticketCount: 200,
          ticketedPassengers: 210,
          datasetDaysOfType: 22,
          avgTicketedPassengersPerDatasetDay: 9.5,
          avgTicketedPassengersPerHourPerDatasetDay: 3.18,
          withinRouteDemandIndex: 31,
          withinRouteDemandBand: 'Low',
        },
      ],
    },
  ],
  ticketingRoutesUnmatched: ['0118EXT(NS)UP'],
};

test('planGtfsJourneys ranks direct routes, computes schedule estimates, and surfaces lower-demand alternative', () => {
  const index = buildGtfsIndex(MINI_GTFS_CORE);
  const res = planGtfsJourneys(index, {
    originStopId: 'S1',
    destinationStopId: 'S3',
    travelDate: '2026-10-15',
    travelTime: '09:00',
    priority: 'fewest_transfers',
    agencyFilter: 'all',
  });

  assert.equal(res.status, 'ok');
  assert.equal(res.options.length, 2);
  assert.equal(res.options[0].legs[0].shortName, '449UP');
  assert.equal(res.options[0].totalEstimatedMinutes, 25); // (600 + 900) / 60
  assert.equal(res.options[0].primaryDemandBand, 'Very high');
  assert.ok(res.options[0].lowerDemandTimeSuggestion?.includes('Midday'));
  assert.ok(res.lowerDemandAlternative);
  assert.equal(res.lowerDemandAlternative?.routeLabel, '425UP');

  // With least_crowded priority, Low-demand 425UP rises to top
  const calmRes = planGtfsJourneys(index, {
    originStopId: 'S1',
    destinationStopId: 'S3',
    travelDate: '2026-10-15',
    travelTime: '09:00',
    priority: 'least_crowded',
    agencyFilter: 'all',
  });
  assert.equal(calmRes.options[0].legs[0].shortName, '425UP');
});

test('planGtfsJourneys finds 1-transfer journeys and handles unmatched ticketing routes honestly', () => {
  const index = buildGtfsIndex(MINI_GTFS_CORE);
  const res = planGtfsJourneys(index, {
    originStopId: 'S1',
    destinationStopId: 'S4',
    travelDate: '2026-10-15',
    travelTime: '09:00',
    priority: 'balanced',
    agencyFilter: 'all',
  });

  assert.equal(res.status, 'ok');
  assert.ok(res.options.length >= 1);
  const opt = res.options[0];
  assert.equal(opt.transfers, 1);
  assert.equal(opt.transferStop?.stopId, 'S3');
  assert.equal(opt.legs[1].demandMatch, null);
  assert.equal(opt.flaggedSegmentsCount, 1);
});

test('analytics builders aggregate time slots and keep unmatched GTFS routes separated', () => {
  const index = buildGtfsIndex(MINI_GTFS_CORE);
  const slots = buildGtfsTimeSlotAnalytics(index, 'all');
  const amPeak = slots.find((s) => s.timeSlot === 'morning_peak');
  assert.ok(amPeak);
  assert.equal(amPeak?.veryHighCount, 1);
  assert.equal(amPeak?.lowCount, 1);

  const rowsMatchedOnly = buildGtfsRouteAnalyticsRows(
    index,
    'morning_peak',
    'weekday',
    'all',
    '',
    false
  );
  assert.equal(rowsMatchedOnly.length, 2);

  const rowsWithUnmatched = buildGtfsRouteAnalyticsRows(
    index,
    'morning_peak',
    'weekday',
    'all',
    '',
    true
  );
  assert.equal(rowsWithUnmatched.length, 3);
  const unmatchedRow = rowsWithUnmatched.find((r) => r.routeId === 'R3');
  assert.equal(unmatchedRow?.withinRouteDemandBand, 'Unmatched');
});

test('formatHourlyPax and combinedHourlyPax preserve sub-0.1 pax/hr without rounding to zero', () => {
  assert.equal(formatHourlyPax(0.04), '<0.1 pax/hr');
  assert.equal(formatHourlyPax(0.09, 'ticketed pax/hr (Oct 2026)'), '<0.1 ticketed pax/hr (Oct 2026)');
  assert.equal(formatHourlyPax(0), '0 pax/hr');
  assert.equal(formatHourlyPax(3.18), '~3.2 pax/hr');
  assert.equal(formatHourlyPax(15.15), '~15 pax/hr');

  const lowPaxCore: RawSmartTransitCore = structuredClone(MINI_GTFS_CORE);
  lowPaxCore.ticketingDemandMatched[1].timeWindows[0].avgTicketedPassengersPerHourPerDatasetDay = 0.04;
  const index = buildGtfsIndex(lowPaxCore);
  const res = planGtfsJourneys(index, {
    originStopId: 'S1',
    destinationStopId: 'S3',
    travelDate: '2026-10-15',
    travelTime: '09:00',
    priority: 'least_crowded',
    agencyFilter: 'all',
  });
  assert.equal(res.status, 'ok');
  const route425 = res.options.find((o) => o.legs[0].shortName === '425UP');
  assert.ok(route425);
  assert.equal(route425.combinedHourlyPax, 0.04);
  assert.equal(formatHourlyPax(route425.combinedHourlyPax!), '<0.1 pax/hr');
});
