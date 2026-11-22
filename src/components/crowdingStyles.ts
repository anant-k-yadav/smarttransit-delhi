import type { DemandBand, GtfsAgencyFilter } from '../data/gtfsTypes';
import type { CrowdingCategory, TransitMode } from '../data/types';

export interface CrowdingVisualMeta {
  label: string;
  shortNote: string;
  textClass: string;
  barClass: string;
  surfaceClass: string;
  badgeClass: string;
  barWidthPct: number;
}

export function getCrowdingVisualMeta(
  category: CrowdingCategory | DemandBand | 'Unavailable' | 'Unmatched',
  index: number | null,
  isHistorical = false
): CrowdingVisualMeta {
  const width = index !== null ? Math.max(8, Math.min(100, Math.round(index))) : 0;

  switch (category) {
    case 'Low':
      return {
        label: isHistorical ? 'Low demand' : 'Low crowding',
        shortNote: isHistorical
          ? 'Low within-route historical demand window'
          : 'Ample standing & seating space (test category)',
        textClass: 'text-emerald-700',
        barClass: 'bg-emerald-600',
        surfaceClass: 'bg-emerald-50/70 border-emerald-200',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        barWidthPct: width || 24,
      };
    case 'Moderate':
      return {
        label: isHistorical ? 'Moderate demand' : 'Moderate crowding',
        shortNote: isHistorical
          ? 'Moderate within-route historical demand window'
          : 'Steady passenger load (test category)',
        textClass: 'text-amber-700',
        barClass: 'bg-amber-500',
        surfaceClass: 'bg-amber-50/70 border-amber-200',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        barWidthPct: width || 50,
      };
    case 'High':
      return {
        label: isHistorical ? 'High demand' : 'High crowding',
        shortNote: isHistorical
          ? 'Busy within-route historical demand window'
          : 'Busy corridor load (test category)',
        textClass: 'text-orange-700',
        barClass: 'bg-orange-600',
        surfaceClass: 'bg-orange-50/70 border-orange-200',
        badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
        barWidthPct: width || 74,
      };
    case 'Very High':
    case 'Very high':
      return {
        label: isHistorical ? 'Very high demand' : 'Very High crowding',
        shortNote: isHistorical
          ? 'Peak within-route historical demand window'
          : 'Peak congestion level (test category)',
        textClass: 'text-red-700',
        barClass: 'bg-red-600',
        surfaceClass: 'bg-red-50/70 border-red-200',
        badgeClass: 'bg-red-50 text-red-800 border-red-200',
        barWidthPct: width || 92,
      };
    case 'Unmatched':
      return {
        label: 'Unmatched route',
        shortNote: 'Exact route code not found in Oct 2026 ticketing data',
        textClass: 'text-slate-600',
        barClass: 'bg-slate-300',
        surfaceClass: 'bg-slate-50 border-slate-200',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        barWidthPct: 0,
      };
    default:
      return {
        label: 'Unavailable',
        shortNote: 'No crowding record in active dataset',
        textClass: 'text-slate-600',
        barClass: 'bg-slate-400',
        surfaceClass: 'bg-slate-50 border-slate-200',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        barWidthPct: 0,
      };
  }
}

export function formatModeLabel(mode: TransitMode | 'all'): string {
  switch (mode) {
    case 'metro':
      return 'Delhi Metro';
    case 'bus':
      return 'DTC Bus';
    case 'multimodal':
      return 'Metro + Bus';
    case 'all':
    default:
      return 'All Modes';
  }
}

export function formatAgencyLabel(agency: GtfsAgencyFilter | string): string {
  switch (agency) {
    case 'DTC':
      return 'DTC Bus';
    case 'DIMTS':
      return 'DIMTS Cluster';
    case 'all':
    default:
      return 'All Bus Operators';
  }
}

export function formatHourlyPax(pax: number, unit = 'pax/hr'): string {
  if (pax > 0 && pax < 0.1) {
    return `<0.1 ${unit}`;
  }
  if (pax === 0) {
    return `0 ${unit}`;
  }
  if (pax < 10) {
    return `~${(Math.round(pax * 10) / 10).toFixed(1).replace(/\.0$/, '')} ${unit}`;
  }
  return `~${Math.round(pax).toLocaleString()} ${unit}`;
}
