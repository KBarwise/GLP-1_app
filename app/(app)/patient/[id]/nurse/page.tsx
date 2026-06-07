import { notFound } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/primitives';
import { loadPatientContext } from '@/lib/patient/load-patient-context';
import { NurseChart } from './nurse-chart';
import { Stethoscope } from 'lucide-react';
import { isPregnancyApplicable } from '@/lib/clinical/pregnancy';
import { consultMedicationsFromRequests } from '@/lib/clinical/medications';

export const dynamic = 'force-dynamic';

export default async function NursePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { appointment?: string };
}) {
  const ctx = await loadPatientContext(params.id);
  if (!ctx.patient) notFound();

  const pregnancyEligible = isPregnancyApplicable(ctx.patient);
  const appointmentId = searchParams.appointment?.trim() || undefined;
  const initialMedications = consultMedicationsFromRequests(ctx.medications);

  return (
    <div className="max-w-4xl">
      <Card>
        <CardTitle icon={<Stethoscope className="h-4 w-4" />}>Nurse documentation</CardTitle>
        <p className="text-[12px] text-ink-500 mb-4">
          Use Next and Back to move through each section. Vitals, medications, and POC entries autosave
          locally and to FHIR. On the final step, click{' '}
          <span className="font-medium text-ink-700">Complete and send to doctor</span> to finish nursing
          documentation and add the patient to the doctor queue.
        </p>
        <NurseChart
          patientId={params.id}
          appointmentId={appointmentId}
          pregnancyEligible={pregnancyEligible}
          initialMedications={initialMedications}
        />
      </Card>
    </div>
  );
}
