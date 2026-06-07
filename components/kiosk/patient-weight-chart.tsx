'use client';

import { useMemo } from 'react';
import { LOINC } from '@/lib/clinical/observations';
import { pointsForCodes, toPoints } from '@/lib/clinical/observationToPoints';
import { useObservations } from '@/hooks/useObservations';
import { FhirTrendChart } from '@/components/trends/FhirTrendChart';
import type { ChartSeriesInput } from '@/components/trends/chart-data';
import { CHART_COLORS } from '@/lib/clinical/trend-chart-tokens';

export function PatientWeightChart({ patientId }: { patientId: string }) {
  const { data, isLoading, isError } = useObservations({
    patientId,
    codes: [{ system: 'http://loinc.org', code: LOINC.bodyWeight }],
    pageSize: 100,
  });

  const series: ChartSeriesInput[] = useMemo(() => {
    const points = pointsForCodes(toPoints(data ?? []), [LOINC.bodyWeight]);
    if (!points.some(p => p.value !== null)) return [];
    return [
      {
        code: LOINC.bodyWeight,
        display: 'Weight',
        color: CHART_COLORS[0]!,
        points,
      },
    ];
  }, [data]);

  if (isLoading) {
    return <div className="h-[200px] w-full rounded-md bg-ink-50 animate-pulse" />;
  }

  if (isError) {
    return <p className="text-[13px] text-ink-500 py-4 text-center">Could not load your weight chart.</p>;
  }

  if (series.length === 0) {
    return null;
  }

  return (
    <FhirTrendChart
      series={series}
      unitLabel="kg"
      showReferenceBand={false}
      height={200}
      showLegend={false}
      animateOnMount
    />
  );
}
