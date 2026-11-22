import test from 'node:test';
import assert from 'node:assert/strict';
import { SYNTHETIC_SAMPLE_DATASET } from '../data/syntheticSample';
import {
  buildCorridorAnalyticsRows,
  buildTimeSlotAnalytics,
  planJourneys,
  resolveDayType,
  resolveTimeSlot,
} from './journeyPlanner';
import { parseAndValidateDatasetJson, validateSmartTransitDataset } from './datasetValidator';

test('resolveTimeSlot maps 24h strings accurately to demand windows', () => {
  assert.equal(resolveTimeSlot('06:30'), 'early_morning');
  assert.equal(resolveTimeSlot('09:00'), 'morning_peak');
  assert.equal(resolveTimeSlot('14:15'), 'midday');
  assert.equal(resolveTimeSlot('18:45'), 'evening_peak');
  assert.equal(resolveTimeSlot('22:10'), 'late_evening');
});

test('resolveDayType distinguishes weekdays from weekends without timezone drift', () => {
  // 2026-11-20 is Friday (weekday); 2026-11-21 is Saturday (weekend)
  assert.equal(resolveDayType('2026-11-20'), 'weekday');
  assert.equal(resolveDayType('2026-11-21'), 'weekend');
  assert.equal(resolveDayType('2026-11-22'), 'weekend');
});

test('planJourneys rejects identical origin and destination with a clear validation error', () => {
  const result = planJourneys(SYNTHETIC_SAMPLE_DATASET, {
    originStopId: 'stop-rajiv-chowk',
    destinationStopId: 'stop-rajiv-chowk',
    travelDate: '2026-11-20',
    travelTime: '09:00',
    priority: 'balanced',
    modeFilter: 'all',
  });

  assert.equal(result.status, 'validation_error');
  assert.equal(result.options.length, 0);
  assert.ok(result.errorMessage && result.errorMessage.includes('different'));
});

test('planJourneys reorders Rajiv Chowk -> Hauz Khas based on travel priority', () => {
  const leastCrowded = planJourneys(SYNTHETIC_SAMPLE_DATASET, {
    originStopId: 'stop-rajiv-chowk',
    destinationStopId: 'stop-hauz-khas',
    travelDate: '2026-11-20',
    travelTime: '09:00',
    priority: 'least_crowded',
    modeFilter: 'all',
  });

  assert.equal(leastCrowded.status, 'ok');
  assert.equal(leastCrowded.options.length, 3);
  assert.equal(leastCrowded.options[0].corridor.id, 'cor-rck-hks-multi');
  assert.equal(leastCrowded.options[0].expectedCrowding, 'Moderate');
  assert.equal(leastCrowded.options[0].isRecommended, true);

  const fewestTransfers = planJourneys(SYNTHETIC_SAMPLE_DATASET, {
    originStopId: 'stop-rajiv-chowk',
    destinationStopId: 'stop-hauz-khas',
    travelDate: '2026-11-20',
    travelTime: '09:00',
    priority: 'fewest_transfers',
    modeFilter: 'all',
  });

  assert.equal(fewestTransfers.status, 'ok');
  assert.equal(fewestTransfers.options[0].corridor.transfers, 0);
  // Direct bus (index 68) beats direct metro (index 88) among 0-transfer options
  assert.equal(fewestTransfers.options[0].corridor.id, 'cor-rck-hks-bus');
});

test('planJourneys updates expected crowding across time slots', () => {
  const peak = planJourneys(SYNTHETIC_SAMPLE_DATASET, {
    originStopId: 'stop-rajiv-chowk',
    destinationStopId: 'stop-hauz-khas',
    travelDate: '2026-11-20',
    travelTime: '09:00',
    priority: 'balanced',
    modeFilter: 'metro',
  });

  const midday = planJourneys(SYNTHETIC_SAMPLE_DATASET, {
    originStopId: 'stop-rajiv-chowk',
    destinationStopId: 'stop-hauz-khas',
    travelDate: '2026-11-20',
    travelTime: '14:00',
    priority: 'balanced',
    modeFilter: 'metro',
  });

  assert.equal(peak.options[0].expectedCrowding, 'Very High');
  assert.equal(midday.options[0].expectedCrowding, 'Moderate');
  assert.ok(
    (peak.options[0].relativeCrowdingIndex ?? 0) >
      (midday.options[0].relativeCrowdingIndex ?? 100)
  );
});

test('planJourneys returns empty state for stop pairs without matching synthetic corridors', () => {
  const empty = planJourneys(SYNTHETIC_SAMPLE_DATASET, {
    originStopId: 'stop-anand-vihar',
    destinationStopId: 'stop-hauz-khas',
    travelDate: '2026-11-20',
    travelTime: '09:00',
    priority: 'balanced',
    modeFilter: 'all',
  });

  assert.equal(empty.status, 'empty');
  assert.equal(empty.options.length, 0);
});

test('analytics builders produce deterministic time-slot and corridor summaries', () => {
  const slots = buildTimeSlotAnalytics(SYNTHETIC_SAMPLE_DATASET, 'weekday', 'all');
  assert.equal(slots.length, 5);
  const morningPeak = slots.find((s) => s.timeSlot === 'morning_peak');
  assert.ok(morningPeak && morningPeak.overallAvgIndex !== null && morningPeak.recordCount > 0);

  const rows = buildCorridorAnalyticsRows(
    SYNTHETIC_SAMPLE_DATASET,
    'morning_peak',
    'weekday',
    'bus'
  );
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.primaryMode === 'bus'));
});

test('datasetValidator accepts valid datasets and rejects malformed payloads', () => {
  const validResult = validateSmartTransitDataset(SYNTHETIC_SAMPLE_DATASET);
  assert.equal(validResult.valid, true);
  assert.equal(validResult.errors.length, 0);

  const invalidJson = parseAndValidateDatasetJson('{ bad json');
  assert.equal(invalidJson.valid, false);
  assert.ok(invalidJson.errors[0].includes('JSON syntax error'));

  const missingFields = validateSmartTransitDataset({
    schemaVersion: '2.0.0',
    stops: [],
    corridors: [],
    crowdingRecords: [],
  });
  assert.equal(missingFields.valid, false);
  assert.ok(missingFields.errors.length >= 3);
});
