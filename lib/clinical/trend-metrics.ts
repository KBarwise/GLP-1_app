import type { LoincFilter } from '@/lib/fhir/fhirObservations';
import { LOINC } from './observations';
import { HEADER_LABS } from './lab-catalog';
import { VITAL_COLOR } from './trend-chart-tokens';

const loinc = (code: string): LoincFilter[number] => ({
  system: 'http://loinc.org',
  code,
});

export type TrendSeriesStyle = {
  code: string;
  display: string;
  color: string;
  strokeDasharray?: string;
};

export type VitalChartGroup = {
  id: string;
  label: string;
  unitLabel: string;
  codes: LoincFilter;
  series: TrendSeriesStyle[];
  targetUnit?: string;
  unitToggle?: { label: string; targetUnit: string };
  criticalLine?: { y: number; label: string };
};

/** OpenCare-style grouped vitals charts */
export const VITAL_CHART_GROUPS: VitalChartGroup[] = [
  {
    id: 'bp-pulse',
    label: 'BP & Pulse',
    unitLabel: 'mmHg / bpm',
    codes: [
      loinc('85354-9'),
      loinc('8480-6'),
      loinc('8462-4'),
      loinc('8867-4'),
    ],
    series: [
      { code: '8480-6', display: 'Systolic', color: VITAL_COLOR.systolic },
      { code: '8462-4', display: 'Diastolic', color: VITAL_COLOR.diastolic, strokeDasharray: '6 4' },
      { code: '8867-4', display: 'Pulse', color: VITAL_COLOR.pulse },
    ],
    criticalLine: { y: 180, label: 'Critical' },
  },
  {
    id: 'spo2-resp',
    label: 'SpO₂ & Resp',
    unitLabel: '% / bpm',
    codes: [loinc('2708-6'), loinc('59408-5'), loinc('9279-1')],
    series: [
      { code: '2708-6', display: 'SpO₂', color: VITAL_COLOR.spo2 },
      { code: '9279-1', display: 'Resp rate', color: VITAL_COLOR.resp },
    ],
    criticalLine: { y: 90, label: 'Critical' },
  },
  {
    id: 'temp',
    label: 'Temperature',
    unitLabel: '°C',
    codes: [loinc('8310-5'), loinc('8331-1')],
    targetUnit: 'Cel',
    unitToggle: { label: '°F', targetUnit: '[degF]' },
    series: [{ code: '8310-5', display: 'Temp °C', color: VITAL_COLOR.temp }],
  },
];

/** @deprecated Use VITAL_CHART_GROUPS */
export type VitalChartDef = VitalChartGroup;
export const VITAL_CHART_DEFS = VITAL_CHART_GROUPS;

export const PRIORITY_LAB_CODES = [
  { code: LOINC.hba1c, display: 'HbA1c', unit: '%' },
  { code: LOINC.bmi, display: 'BMI', unit: 'kg/m2' },
  { code: HEADER_LABS.totalCholesterol.code, display: HEADER_LABS.totalCholesterol.display, unit: 'mg/dL' },
  { code: HEADER_LABS.alt.code, display: HEADER_LABS.alt.display, unit: 'U/L' },
  { code: HEADER_LABS.lipase.code, display: HEADER_LABS.lipase.display, unit: 'U/L' },
  { code: HEADER_LABS.creatinine.code, display: HEADER_LABS.creatinine.display, unit: 'µmol/L' },
] as const;

export const DEFAULT_LAB_SELECTION = [LOINC.hba1c, HEADER_LABS.totalCholesterol.code];

export type DateRangePreset = '24h' | '7d' | '30d' | '6m' | '1y' | 'all';

export const DATE_RANGE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '6m', label: '6m' },
  { id: '1y', label: '1y' },
  { id: 'all', label: 'All' },
];

export function dateRangeBounds(preset: DateRangePreset): { dateFrom?: string; dateTo?: string } {
  if (preset === 'all') return {};
  const to = new Date();
  const from = new Date(to);
  switch (preset) {
    case '24h':
      from.setHours(from.getHours() - 24);
      break;
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '6m':
      from.setMonth(from.getMonth() - 6);
      break;
    case '1y':
      from.setFullYear(from.getFullYear() - 1);
      break;
  }
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}
