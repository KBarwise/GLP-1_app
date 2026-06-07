import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DoctorTrendsOverlay } from '@/components/patient/doctor-trends-overlay';
import { PatientHeader } from '@/components/patient/patient-header';
import { PatientNav } from '@/components/patient/patient-nav';
import { canViewClinicalData } from '@/lib/clinic/access';
import { getActingRoleFromCookie } from '@/lib/clinic/server-role';
import { loadPatientContext } from '@/lib/patient/load-patient-context';

export const dynamic = 'force-dynamic';

export default async function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const ctx = await loadPatientContext(params.id);
  if (!ctx.patient) notFound();

  const role = getActingRoleFromCookie();
  const showClinicalHeader = canViewClinicalData(role);
  const contentWidth = role === 'doctor' ? 'max-w-7xl' : 'max-w-5xl';

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-30 bg-[var(--bg)]/95 backdrop-blur-sm border-b border-ink-100 shadow-sm">
        <div className="h-1 bg-accent" aria-hidden />
        <div className={`mx-auto ${contentWidth} px-4 sm:px-6 pt-3 pb-2 space-y-0`}>
          {showClinicalHeader && (
            <PatientHeader
              patient={ctx.patient}
              patientId={params.id}
              observations={ctx.observations}
              medications={ctx.medications}
              riskScore={ctx.riskScore}
              riskTone={ctx.riskTone}
              showScreeningLink={role !== 'doctor'}
            />
          )}
          <PatientNav patientId={params.id} embedded />
        </div>
      </div>
      <div className={`mx-auto ${contentWidth} px-4 sm:px-6 py-3`}>{children}</div>
      {role === 'doctor' && (
        <Suspense fallback={null}>
          <DoctorTrendsOverlay patientId={params.id} />
        </Suspense>
      )}
    </div>
  );
}
