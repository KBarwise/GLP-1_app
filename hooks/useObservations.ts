'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchObservations,
  type FetchObservationsOpts,
  type LoincFilter,
} from '@/lib/fhir/fhirObservations';
import { isLaboratoryLoinc } from '@/lib/clinical/trend-code-sets';
import type { Observation } from '@/lib/fhir/resources';

function observationCategoryLabel(obs: Observation): string | undefined {
  const cat = obs.category?.[0];
  return cat?.coding?.[0]?.display ?? cat?.coding?.[0]?.code ?? cat?.text;
}

export type UseObservationsOpts = FetchObservationsOpts & {
  enabled?: boolean;
};

export function observationsQueryKey(opts: UseObservationsOpts) {
  return [
    'obs',
    opts.patientId,
    opts.category ?? '',
    opts.codes?.map(c => c.code).join(',') ?? '',
    opts.dateFrom ?? '',
    opts.dateTo ?? '',
  ] as const;
}

export function useObservations(opts: UseObservationsOpts) {
  return useQuery<Observation[], Error>({
    queryKey: observationsQueryKey(opts),
    queryFn: () => fetchObservations(opts),
    staleTime: 60_000,
    enabled: opts.enabled !== false && Boolean(opts.patientId),
  });
}

export function useLabCodeCatalog(patientId: string, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['obs-lab-codes', patientId, dateFrom ?? '', dateTo ?? ''],
    queryFn: async () => {
      const obs = await fetchObservations({
        patientId,
        dateFrom,
        dateTo,
        pageSize: 500,
      });
      const map = new Map<string, string>();
      for (const o of obs) {
        if (o.valueQuantity?.value === undefined) continue;
        const code =
          o.code?.coding?.find(c => c.system?.includes('loinc.org'))?.code
          ?? o.code?.coding?.[0]?.code;
        if (!code) continue;
        if (!isLaboratoryLoinc(code, observationCategoryLabel(o))) continue;
        const display =
          o.code?.coding?.find(c => c.code === code)?.display
          ?? o.code?.text
          ?? code;
        map.set(code, display);
      }
      return [...map.entries()]
        .map(([code, display]) => ({ code, display }))
        .sort((a, b) => a.display.localeCompare(b.display));
    },
    staleTime: 60_000,
    enabled: Boolean(patientId),
  });
}

export type { LoincFilter };
