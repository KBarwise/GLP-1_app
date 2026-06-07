'use client';

import { ListTree, Pill, Activity } from 'lucide-react';
import { EditableProblemList } from '@/components/patient/editable-problem-list';
import { PatientProblemList } from '@/components/patient/patient-problem-list';
import { PatientMedicationsList } from '@/components/patient/patient-medications-list';
import { PatientClinicalSummary } from '@/components/patient/patient-clinical-summary';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { medicationRequestLabel } from '@/lib/clinical/medications';
import type { loadPatientContext } from '@/lib/patient/load-patient-context';
import type { MedicationRequest } from '@/lib/fhir/resources';

function medicationSummary(medications: MedicationRequest[]): string {
  if (medications.length === 0) return 'None on record';
  if (medications.length === 1) return medicationRequestLabel(medications[0]!);
  return `${medications.length} active — ${medicationRequestLabel(medications[0]!)}…`;
}

/** Medications, problem list, and safety signals — compact collapsible blocks for the doctor workspace. */
export function DoctorPatientOverview({
  patientId,
  ctx,
  editableProblemList = true,
}: {
  patientId: string;
  ctx: NonNullable<Awaited<ReturnType<typeof loadPatientContext>>>;
  editableProblemList?: boolean;
}) {
  if (!ctx.patient) return null;

  const activeProblems = ctx.problemList.filter(p => p.clinicalStatus?.coding?.[0]?.code !== 'inactive');
  const hasUrgentSignals = ctx.signals.some(s => s.severity === 'red' || s.severity === 'amber');

  return (
    <div className="grid gap-2 sm:grid-cols-1">
      <CollapsibleSection
        title="Current medications"
        icon={<Pill className="h-4 w-4 text-ink-500" />}
        summary={medicationSummary(ctx.medications)}
        defaultExpanded={ctx.medications.length > 0 && ctx.medications.length <= 2}
      >
        <PatientMedicationsList medications={ctx.medications} embedded />
      </CollapsibleSection>

      <CollapsibleSection
        title="Problem list"
        icon={<ListTree className="h-4 w-4 text-ink-500" />}
        summary={
          activeProblems.length === 0
            ? 'No active problems'
            : `${activeProblems.length} active problem${activeProblems.length === 1 ? '' : 's'}`
        }
        defaultExpanded={activeProblems.length > 0 && activeProblems.length <= 3}
        forceExpanded={false}
      >
        {editableProblemList ? (
          <EditableProblemList patientId={patientId} problems={ctx.problemList} embedded />
        ) : (
          <PatientProblemList disorders={ctx.disorders} embedded />
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Safety signals"
        icon={<Activity className="h-4 w-4 text-ink-500" />}
        summary={
          ctx.signals.length === 0
            ? 'No active signals'
            : `${ctx.signals.length} signal${ctx.signals.length === 1 ? '' : 's'}`
        }
        forceExpanded={hasUrgentSignals}
        defaultExpanded={hasUrgentSignals}
      >
        <PatientClinicalSummary signals={ctx.signals} embedded />
      </CollapsibleSection>
    </div>
  );
}
