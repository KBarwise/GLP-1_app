import {
  LOINC,
  metricDelta,
  observationsByLoinc,
  type MetricDelta,
} from '@/lib/clinical/observations';
import type { Observation } from '@/lib/fhir/resources';

export type WeightEntry = {
  date: string;
  valueKg: number;
  observationId?: string;
};

export type WeightLossSummary = {
  currentKg?: number;
  startingKg?: number;
  totalChangeKg?: number;
  totalChangePct?: number;
  entryCount: number;
  sinceLast?: MetricDelta;
  entries: WeightEntry[];
};

export function buildWeightLossSummary(observations: Observation[]): WeightLossSummary {
  const sorted = observationsByLoinc(observations, LOINC.bodyWeight);
  const entries: WeightEntry[] = sorted
    .map(o => ({
      date: (o.effectiveDateTime ?? o.issued ?? '').slice(0, 10),
      valueKg: o.valueQuantity!.value!,
      observationId: o.id,
    }))
    .filter(e => e.date && Number.isFinite(e.valueKg));

  if (entries.length === 0) {
    return { entryCount: 0, entries: [] };
  }

  const currentKg = entries[0]!.valueKg;
  const startingKg = entries[entries.length - 1]!.valueKg;
  const totalChangeKg = currentKg - startingKg;
  const totalChangePct =
    startingKg !== 0 ? (totalChangeKg / Math.abs(startingKg)) * 100 : undefined;

  return {
    currentKg,
    startingKg: entries.length > 1 ? startingKg : undefined,
    totalChangeKg: entries.length > 1 ? totalChangeKg : undefined,
    totalChangePct: entries.length > 1 ? totalChangePct : undefined,
    entryCount: entries.length,
    sinceLast: metricDelta(observations, LOINC.bodyWeight),
    entries,
  };
}

export function formatKg(value: number): string {
  return value.toFixed(1);
}

export function formatWeightChange(kg?: number, pct?: number): string {
  if (kg === undefined) return '—';
  const sign = kg > 0 ? '+' : '';
  const kgPart = `${sign}${kg.toFixed(1)} kg`;
  if (pct === undefined) return kgPart;
  const pctSign = pct > 0 ? '+' : '';
  return `${kgPart} (${pctSign}${pct.toFixed(1)}%)`;
}
