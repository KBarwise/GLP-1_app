'use client';

import { ClinicalTrendsPanel } from '@/components/patient/clinical-trends-panel';

/** @deprecated Use ClinicalTrendsPanel / TabbedTrendsPanel */
export function VitalsTrendsDashboard({ patientId }: { patientId: string }) {
  return <ClinicalTrendsPanel patientId={patientId} />;
}
