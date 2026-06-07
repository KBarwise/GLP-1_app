'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/primitives';
import { pointsForCodes, toPoints, type TrendPoint } from '@/lib/clinical/observationToPoints';
import { codedObservationValue, observationLoincCode } from '@/lib/clinical/observations';
import { CHART_COLORS, COLOR_DESTRUCTIVE } from '@/lib/clinical/trend-chart-tokens';
import { dateRangeBounds, type DateRangePreset } from '@/lib/clinical/trend-metrics';
import { useObservations } from '@/hooks/useObservations';
import type { Observation } from '@/lib/fhir/resources';
import { DateRangePicker } from './DateRangePicker';
import { FhirTrendChart } from './FhirTrendChart';
import type { ChartSeriesInput } from './chart-data';

function trendArrow(points: TrendPoint[]): { symbol: string; destructive: boolean } {
  const inRange = points.filter(p => p.value !== null && !p.outOfRange);
  const latest = points[points.length - 1];
  const destructive = Boolean(latest?.outOfRange);
  if (inRange.length < 2) return { symbol: '→', destructive };
  const a = inRange[inRange.length - 2]!.value!;
  const b = inRange[inRange.length - 1]!.value!;
  if (b > a) return { symbol: '↑', destructive };
  if (b < a) return { symbol: '↓', destructive };
  return { symbol: '→', destructive };
}

function exportCsv(series: ChartSeriesInput[], filename: string) {
  const rows: string[] = ['date,code,display,value,unit,refLow,refHigh,interpretation,outOfRange,observationId'];
  for (const s of series) {
    for (const p of s.points) {
      if (p.value === null) continue;
      rows.push(
        [
          format(p.t, "yyyy-MM-dd'T'HH:mm:ss"),
          p.code,
          `"${p.display.replace(/"/g, '""')}"`,
          p.value,
          p.unit,
          p.refLow ?? '',
          p.refHigh ?? '',
          p.interpretation ?? '',
          p.outOfRange,
          p.observationId,
        ].join(','),
      );
    }
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function codedTimeline(
  observations: Observation[],
  codes: string[],
  codeOptions: Array<{ code: string; display: string }>,
) {
  const set = new Set(codes);
  const rows: Array<{ code: string; display: string; when: string; value: string; t: number }> = [];
  for (const obs of observations) {
    const code = observationLoincCode(obs);
    if (!code || !set.has(code)) continue;
    if (obs.valueQuantity?.value !== undefined) continue;
    const value = codedObservationValue(obs) ?? obs.valueString;
    if (!value) continue;
    const iso = obs.effectiveDateTime ?? obs.issued;
    const t = iso ? Date.parse(iso) : 0;
    const display = codeOptions.find(c => c.code === code)?.display ?? code;
    rows.push({
      code,
      display,
      when: iso ? format(new Date(iso), 'MMM d, yyyy HH:mm') : '—',
      value,
      t: Number.isFinite(t) ? t : 0,
    });
  }
  return rows
    .sort((a, b) => b.t - a.t)
    .map(({ code, display, when, value }) => ({ code, display, when, value }));
}

export function MeasureTrendsTab({
  patientId,
  codeOptions,
  defaultSelected,
  exportPrefix,
  emptyMessage = 'Select at least one measure to plot.',
  compact = false,
}: {
  patientId: string;
  codeOptions: Array<{ code: string; display: string }>;
  defaultSelected: string[];
  exportPrefix: string;
  emptyMessage?: string;
  compact?: boolean;
}) {
  const chartHeight = compact ? 260 : 320;
  const [range, setRange] = useState<DateRangePreset>('all');
  const { dateFrom, dateTo } = useMemo(() => dateRangeBounds(range), [range]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelected));

  const selectedCodes = useMemo(() => [...selected], [selected]);
  const codesFilter = selectedCodes.map(code => ({
    system: 'http://loinc.org' as const,
    code,
  }));

  const { data, isLoading, isError, error, refetch } = useObservations({
    patientId,
    codes: codesFilter.length ? codesFilter : undefined,
    dateFrom,
    dateTo,
    pageSize: 500,
    enabled: selectedCodes.length > 0,
  });

  const series: ChartSeriesInput[] = useMemo(() => {
    const allPoints = toPoints(data ?? []);
    return selectedCodes.map((code, i) => {
      const opt = codeOptions.find(c => c.code === code);
      return {
        code,
        display: opt?.display ?? code,
        color: CHART_COLORS[i % CHART_COLORS.length]!,
        points: pointsForCodes(allPoints, [code]),
      };
    });
  }, [data, selectedCodes, codeOptions]);

  const codedRows = useMemo(
    () => codedTimeline(data ?? [], selectedCodes, codeOptions),
    [data, selectedCodes, codeOptions],
  );

  const chartSeries = useMemo(
    () => series.filter(s => s.points.some(p => p.value !== null)),
    [series],
  );
  const hasChartData = chartSeries.length > 0;

  function toggleCode(code: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRangePicker value={range} onChange={setRange} />
        <button
          type="button"
          disabled={!hasChartData}
          onClick={() => exportCsv(chartSeries, `${exportPrefix}-${patientId}-${range}.csv`)}
          className="px-3 py-1.5 text-[12px] border border-ink-100 rounded-md hover:bg-ink-50 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      <div>
        <div className="text-[11px] font-medium text-ink-600 mb-1.5">Select measures to plot</div>
        <div className={`flex flex-wrap gap-1.5 overflow-auto ${compact ? "max-h-24" : "max-h-36"}`}>
          {codeOptions.map(c => {
            const on = selected.has(c.code);
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleCode(c.code)}
                className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                  on
                    ? 'bg-info-soft text-info border-info/30 font-medium'
                    : 'bg-ink-50 border-ink-100 text-ink-600 hover:border-ink-200'
                }`}
              >
                {c.display}
              </button>
            );
          })}
        </div>
      </div>

      {hasChartData && (
        <ul className="flex flex-wrap gap-3 text-[12px]">
          {chartSeries.map(s => {
            const arrow = trendArrow(s.points);
            return (
              <li key={s.code} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span>{s.display}</span>
                <span
                  className={`tnum font-medium ${arrow.destructive ? 'text-danger' : 'text-ink-600'}`}
                  style={arrow.destructive ? { color: COLOR_DESTRUCTIVE } : undefined}
                >
                  {arrow.symbol}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        {selectedCodes.length === 0 && (
          <p className="text-[12px] text-ink-500 py-8 text-center">{emptyMessage}</p>
        )}
        {selectedCodes.length > 0 && isLoading && (
          <div className="w-full rounded-md bg-ink-50 animate-pulse" style={{ height: chartHeight }} />
        )}
        {selectedCodes.length > 0 && isError && (
          <div className="text-[12px] py-8 text-center space-y-2">
            <p className="text-danger">{error?.message ?? 'Failed to load observations'}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-3 py-1.5 text-[12px] border border-ink-100 rounded-md hover:bg-ink-50"
            >
              Retry
            </button>
          </div>
        )}
        {selectedCodes.length > 0 && !isLoading && !isError && !hasChartData && codedRows.length === 0 && (
          <p className="text-[12px] text-ink-500 py-8 text-center">
            No trend data for the selected measures in this time range.
          </p>
        )}
        {selectedCodes.length > 0 && !isLoading && !isError && hasChartData && (
          <FhirTrendChart
            key={`${exportPrefix}-${range}-${selectedCodes.join(',')}`}
            series={chartSeries}
            unitLabel={chartSeries.length === 1 ? (chartSeries[0]?.points[0]?.unit ?? '') : 'mixed'}
            showReferenceBand={chartSeries.length === 1}
            height={chartHeight}
            showLegend
            animateOnMount
          />
        )}
      </Card>

      {codedRows.length > 0 && (
        <Card>
          <h3 className="text-[12px] font-medium text-ink-700 mb-2">Categorical results (timeline)</h3>
          <p className="text-[11px] text-ink-500 mb-3">
            Text-based point-of-care results appear here when they cannot be plotted as numeric lines.
          </p>
          <ul className="divide-y divide-ink-50 text-[12px]">
            {codedRows.slice(0, 24).map((row, i) => (
              <li key={`${row.code}-${row.when}-${i}`} className="py-2 flex justify-between gap-3">
                <span className="text-ink-600">
                  {row.display}
                  <span className="text-ink-400 ml-1.5">{row.when}</span>
                </span>
                <span className="font-medium shrink-0">{row.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
