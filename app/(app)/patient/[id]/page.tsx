import { redirect, notFound } from 'next/navigation';
import { getActingRoleFromCookie } from '@/lib/clinic/server-role';
import { canViewClinicalData, patientDestination } from '@/lib/clinic/access';
import { loadPatientContext } from '@/lib/patient/load-patient-context';

export const dynamic = 'force-dynamic';

/** Nurse chart at patient root; doctors use the unified consult workspace. */
export default async function PatientChartPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { appointment?: string; trends?: string };
}) {
  const ctx = await loadPatientContext(params.id);
  if (!ctx.patient) notFound();

  const role = getActingRoleFromCookie();
  if (!canViewClinicalData(role)) {
    redirect(patientDestination(role, params.id));
  }

  const q = new URLSearchParams();
  const appt = searchParams.appointment?.trim();
  if (appt) q.set('appointment', appt);
  const trends = searchParams.trends?.trim();
  if (trends) q.set('trends', trends);
  const query = q.toString();

  if (role === 'doctor') {
    redirect(`/patient/${params.id}/consult/document${query ? `?${query}` : ''}`);
  }

  redirect(`/patient/${params.id}/nurse${query ? `?${query}` : ''}`);
}
