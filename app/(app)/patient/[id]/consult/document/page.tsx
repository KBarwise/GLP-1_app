import { notFound } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/primitives';
import { conditionsForPrescriptionScreening } from '@/lib/clinical/screening-conditions';
import { activeMedicationSnomedCodes } from '@/lib/clinical/medications';
import { getIncretinPrescribingBlocks } from '@/lib/clinical/incretin-prescribing-guards';
import { resolveWeightManagementPathway } from '@/lib/clinical/weight-management-pathway';
import { loadPatientContext } from '@/lib/patient/load-patient-context';
import { evaluatePrescriptionScreening } from '@/lib/screening/evaluate-prescription';
import { DoctorChartLayout } from '@/components/patient/doctor-chart-layout';
import { DoctorPatientOverview } from '@/components/patient/doctor-patient-overview';
import { ConsultChart } from '../consult-chart';
import { ClipboardList } from 'lucide-react';

export const dynamic = 'force-dynamic';

/** Unified doctor workspace: intake, meds, problem list, and consultation documentation. */
export default async function ConsultDocumentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { appointment?: string };
}) {
  const ctx = await loadPatientContext(params.id);
  if (!ctx.patient) notFound();

  const screening = await evaluatePrescriptionScreening(
    conditionsForPrescriptionScreening([...ctx.problemList, ...ctx.disorders]),
  );
  const weightPathway = await resolveWeightManagementPathway(ctx.patient, params.id);
  const incretinBlock = getIncretinPrescribingBlocks({
    observations: ctx.observations,
    signals: ctx.signals,
    screening,
    weightPathway,
  });
  const appt = searchParams.appointment?.trim();

  return (
    <DoctorChartLayout patientId={params.id} observations={ctx.observations}>
      <DoctorPatientOverview patientId={params.id} ctx={ctx} />

      <Card className="p-4">
        <CardTitle icon={<ClipboardList className="h-4 w-4" />}>Consultation</CardTitle>
        <p className="text-[12px] text-ink-500 mb-3">
          Document the visit below. Nurse vitals and point-of-care results are in the left panel; use
          Trends beside each section to graph values over time.
        </p>
        <ConsultChart
          key={params.id}
          patientId={params.id}
          appointmentId={appt}
          chartBackHref="/clinic/doctor"
          existingMedicationCodes={[...activeMedicationSnomedCodes(ctx.medications)]}
          activeMedications={ctx.medications}
          screening={screening}
          incretinBlock={incretinBlock}
        />
      </Card>
    </DoctorChartLayout>
  );
}
