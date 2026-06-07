import { NurseIntakeSummary } from '@/components/patient/nurse-intake-summary';
import { DoctorPatientOverview } from '@/components/patient/doctor-patient-overview';
import type { loadPatientContext } from '@/lib/patient/load-patient-context';

/** Clinical chart: nurse intake summary, medications, problem list, and safety signals. */
export function PatientClinicalChart({
  patientId,
  ctx,
}: {
  patientId: string;
  ctx: NonNullable<Awaited<ReturnType<typeof loadPatientContext>>>;
}) {
  return (
    <>
      <NurseIntakeSummary observations={ctx.observations} />
      <DoctorPatientOverview patientId={patientId} ctx={ctx} />
    </>
  );
}
