'use client';

import { ClinicalTrendsPanel } from '@/components/patient/clinical-trends-panel';

/** @deprecated Use ClinicalTrendsPanel / TabbedTrendsPanel */
export function LabTrendsDashboard({ patientId }: { patientId: string }) {
  return <ClinicalTrendsPanel patientId={patientId} />;
}
