import { NurseIntakeSidebar } from '@/components/patient/nurse-intake-sidebar';
import type { Observation } from '@/lib/fhir/resources';

/** Doctor consult: compact intake column + main clinical / documentation column. */
export function DoctorChartLayout({
  patientId,
  observations,
  children,
}: {
  patientId: string;
  observations: Observation[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] xl:items-start">
      <aside className="min-w-0 xl:sticky xl:top-[7rem] xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
        <NurseIntakeSidebar patientId={patientId} observations={observations} />
      </aside>
      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  );
}
