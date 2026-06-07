'use client';

import { Suspense } from 'react';
import { TabbedTrendsPanel } from '@/components/trends/TabbedTrendsPanel';

/** Tabbed FHIR observation trends (vitals, POC, laboratory). */
export function ClinicalTrendsPanel({ patientId }: { patientId: string }) {
  return (
    <Suspense
      fallback={<p className="text-[12px] text-ink-500 py-6">Loading trends…</p>}
    >
      <TabbedTrendsPanel patientId={patientId} />
    </Suspense>
  );
}
