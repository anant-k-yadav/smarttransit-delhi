import type {
  CrowdingCategory,
  DayType,
  DatasetValidationResult,
  SmartTransitDataset,
  TimeSlotId,
  TransitMode,
} from '../data/types';

const VALID_MODES: TransitMode[] = ['metro', 'bus', 'multimodal'];
const VALID_CROWDING: CrowdingCategory[] = ['Low', 'Moderate', 'High', 'Very High'];
const VALID_DAY_TYPES: DayType[] = ['weekday', 'weekend'];
const VALID_TIME_SLOTS: TimeSlotId[] = [
  'early_morning',
  'morning_peak',
  'midday',
  'evening_peak',
  'late_evening',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Runtime validator for official or test SmartTransitDataset JSON payloads.
 * Ensures validated official ticketing results conform strictly to the data contract
 * before replacing the synthetic sample dataset in application state.
 */
export function validateSmartTransitDataset(input: unknown): DatasetValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ['Dataset root must be a valid JSON object.'] };
  }

  if (input.schemaVersion !== '1.0.0') {
    errors.push('Field "schemaVersion" must equal "1.0.0".');
  }

  if (!isRecord(input.metadata)) {
    errors.push('Field "metadata" must be an object.');
  } else {
    if (typeof input.metadata.datasetName !== 'string' || !input.metadata.datasetName.trim()) {
      errors.push('Field "metadata.datasetName" must be a non-empty string.');
    }
    if (
      input.metadata.sourceType !== 'synthetic_sample' &&
      input.metadata.sourceType !== 'official_validated'
    ) {
      errors.push(
        'Field "metadata.sourceType" must be either "synthetic_sample" or "official_validated".'
      );
    }
    if (typeof input.metadata.disclaimer !== 'string' || !input.metadata.disclaimer.trim()) {
      errors.push('Field "metadata.disclaimer" must be a non-empty string.');
    }
  }

  const stopIds = new Set<string>();
  if (!Array.isArray(input.stops) || input.stops.length < 2) {
    errors.push('Field "stops" must be an array with at least 2 transit stops.');
  } else {
    input.stops.forEach((stop, index) => {
      if (!isRecord(stop)) {
        errors.push(`stops[${index}] must be an object.`);
        return;
      }
      if (typeof stop.id !== 'string' || !stop.id.trim()) {
        errors.push(`stops[${index}].id must be a non-empty string.`);
      } else {
        stopIds.add(stop.id);
      }
      if (typeof stop.name !== 'string' || !stop.name.trim()) {
        errors.push(`stops[${index}].name must be a non-empty string.`);
      }
      if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number') {
        errors.push(`stops[${index}] must include numeric "lat" and "lng" coordinates.`);
      }
    });
  }

  const corridorIds = new Set<string>();
  if (!Array.isArray(input.corridors) || input.corridors.length === 0) {
    errors.push('Field "corridors" must be a non-empty array.');
  } else {
    input.corridors.forEach((corridor, index) => {
      if (!isRecord(corridor)) {
        errors.push(`corridors[${index}] must be an object.`);
        return;
      }
      if (typeof corridor.id !== 'string' || !corridor.id.trim()) {
        errors.push(`corridors[${index}].id must be a non-empty string.`);
      } else {
        corridorIds.add(corridor.id);
      }
      if (typeof corridor.name !== 'string' || !corridor.name.trim()) {
        errors.push(`corridors[${index}].name must be a non-empty string.`);
      }
      if (typeof corridor.originStopId !== 'string' || !stopIds.has(corridor.originStopId)) {
        errors.push(`corridors[${index}].originStopId must match a stop in "stops".`);
      }
      if (
        typeof corridor.destinationStopId !== 'string' ||
        !stopIds.has(corridor.destinationStopId)
      ) {
        errors.push(`corridors[${index}].destinationStopId must match a stop in "stops".`);
      }
      if (!VALID_MODES.includes(corridor.primaryMode as TransitMode)) {
        errors.push(
          `corridors[${index}].primaryMode must be one of: ${VALID_MODES.join(', ')}.`
        );
      }
      if (!Array.isArray(corridor.legs) || corridor.legs.length === 0) {
        errors.push(`corridors[${index}].legs must be a non-empty array.`);
      }
    });
  }

  if (!Array.isArray(input.crowdingRecords)) {
    errors.push('Field "crowdingRecords" must be an array.');
  } else {
    input.crowdingRecords.forEach((rec, index) => {
      if (!isRecord(rec)) {
        errors.push(`crowdingRecords[${index}] must be an object.`);
        return;
      }
      if (typeof rec.corridorId !== 'string' || !corridorIds.has(rec.corridorId)) {
        errors.push(`crowdingRecords[${index}].corridorId must match an id in "corridors".`);
      }
      if (!VALID_TIME_SLOTS.includes(rec.timeSlot as TimeSlotId)) {
        errors.push(
          `crowdingRecords[${index}].timeSlot must be one of: ${VALID_TIME_SLOTS.join(', ')}.`
        );
      }
      if (!VALID_DAY_TYPES.includes(rec.dayType as DayType)) {
        errors.push(`crowdingRecords[${index}].dayType must be "weekday" or "weekend".`);
      }
      if (!VALID_CROWDING.includes(rec.expectedCrowding as CrowdingCategory)) {
        errors.push(
          `crowdingRecords[${index}].expectedCrowding must be one of: ${VALID_CROWDING.join(', ')}.`
        );
      }
      if (
        typeof rec.relativeCrowdingIndex !== 'number' ||
        rec.relativeCrowdingIndex < 0 ||
        rec.relativeCrowdingIndex > 100
      ) {
        errors.push(`crowdingRecords[${index}].relativeCrowdingIndex must be between 0 and 100.`);
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    dataset: input as unknown as SmartTransitDataset,
    errors: [],
  };
}

export function parseAndValidateDatasetJson(rawText: string): DatasetValidationResult {
  if (!rawText.trim()) {
    return { valid: false, errors: ['Please paste or upload a JSON dataset before validating.'] };
  }
  try {
    const parsed: unknown = JSON.parse(rawText);
    return validateSmartTransitDataset(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON syntax.';
    return { valid: false, errors: [`JSON syntax error: ${message}`] };
  }
}
