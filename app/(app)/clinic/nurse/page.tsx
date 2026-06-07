import { listAppointmentsForDay } from '@/lib/fhir/appointments';
import { todayDateParam } from '@/lib/clinical/scheduling';
import { workflowForNurseQueue } from '@/lib/clinical/workflow';
import { Card, CardTitle } from '@/components/ui/primitives';
import { AppointmentQueue } from '@/components/scheduling/appointment-queue';
import { Stethoscope } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NurseClinicPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const date = searchParams.date ?? todayDateParam();
  const rows = await listAppointmentsForDay(date);
  const queue = rows.filter(
    r =>
      workflowForNurseQueue().includes(r.workflow)
      && r.appointment.status !== 'fulfilled'
      && r.appointment.status !== 'cancelled',
  );

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-medium mb-1">Nurse Queue</h1>
      <p className="text-sm text-ink-500 mb-4">
        Vitals, anthropometrics, point-of-care tests, and nursing notes. Send to the doctor when complete.
      </p>
      <Card>
        <CardTitle icon={<Stethoscope className="h-4 w-4" />}>Nurse Queue — {date}</CardTitle>
        <form className="mb-3 flex gap-2 items-end" method="get">
          <input type="date" name="date" defaultValue={date} className="px-2 py-1.5 border border-ink-100 rounded-md text-[13px]" />
          <button type="submit" className="px-3 py-1.5 text-[12px] border border-ink-100 rounded-md hover:bg-ink-50">Go</button>
        </form>
        <AppointmentQueue rows={queue} deskRole="nurse" />
      </Card>
    </div>
  );
}
