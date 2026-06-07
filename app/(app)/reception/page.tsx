import { listAppointmentsForDay } from '@/lib/fhir/appointments';
import { todayDateParam } from '@/lib/clinical/scheduling';
import { workflowForBilling, workflowForReceptionCheckout, type VisitWorkflow } from '@/lib/clinical/workflow';
import { Card, CardTitle } from '@/components/ui/primitives';
import { BillingPatientList } from '@/components/reception/billing-patient-list';
import { AppointmentQueue } from '@/components/scheduling/appointment-queue';
import { KioskIntakePanel } from '@/components/reception/kiosk-intake-panel';
import { ReturningSymptomPanel } from '@/components/reception/returning-symptom-panel';
import Link from 'next/link';
import { CalendarCheck, CalendarPlus, CreditCard, Receipt } from 'lucide-react';

export const dynamic = 'force-dynamic';

function matchesWorkflow(row: { workflow: VisitWorkflow }, allowed: VisitWorkflow[]) {
  return allowed.includes(row.workflow);
}

export default async function ReceptionPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const date = searchParams.date ?? todayDateParam();
  let rows: Awaited<ReturnType<typeof listAppointmentsForDay>> = [];
  let appointmentsError: string | null = null;

  try {
    rows = await listAppointmentsForDay(date);
  } catch (e) {
    appointmentsError = (e as Error).message;
  }

  const checkout = rows.filter(
    r =>
      matchesWorkflow(r, workflowForReceptionCheckout())
      && r.appointment.status !== 'fulfilled'
      && r.appointment.status !== 'noshow'
      && r.appointment.status !== 'cancelled',
  );
  const billing = rows.filter(
    r =>
      matchesWorkflow(r, workflowForBilling())
      && r.appointment.status !== 'fulfilled'
      && r.appointment.status !== 'noshow'
      && r.appointment.status !== 'cancelled',
  );
  const board = rows.filter(
    r =>
      r.appointment.status !== 'fulfilled'
      && r.appointment.status !== 'noshow'
      && r.appointment.status !== 'cancelled'
      && !matchesWorkflow(r, workflowForReceptionCheckout()),
  );

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-medium mb-1">Reception desk</h1>
      <p className="text-sm text-ink-500 mb-4">
        Check in patients, complete checkout, and use{' '}
        <Link href="/reception/book" className="text-info hover:underline">
          Book appointment
        </Link>{' '}
        in the menu to schedule visits.
      </p>

      {appointmentsError && (
        <p className="text-[13px] text-danger mb-4 rounded-md border border-danger/30 bg-danger-soft/40 px-3 py-2">
          Could not load today&apos;s appointments: {appointmentsError}
        </p>
      )}

      <ReturningSymptomPanel />
      <KioskIntakePanel />

      <Card className="mb-6">
        <CardTitle icon={<CalendarCheck className="h-4 w-4" />}>Today — {date}</CardTitle>
        <form className="mb-3 flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-[11px] text-ink-500 mb-1">Board date</label>
            <input type="date" name="date" defaultValue={date} className="px-2 py-1.5 border border-ink-100 rounded-md text-[13px]" />
          </div>
          <button type="submit" className="px-3 py-1.5 text-[12px] border border-ink-100 rounded-md hover:bg-ink-50">Go</button>
          <Link
            href={`/reception/book?date=${date}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-ink-900 text-white rounded-md hover:bg-ink-700 ml-auto"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Book appointment
          </Link>
        </form>
        <p className="text-[12px] text-ink-500">
          {board.filter(r => r.workflow === 'scheduled').length} awaiting check-in ·{' '}
          {billing.length} for billing · {checkout.length} at checkout
        </p>
      </Card>

      <Card className="mb-4">
        <CardTitle>Appointment board</CardTitle>
        <AppointmentQueue rows={board} deskRole="reception" />
      </Card>

      <Card className="mb-4">
        <CardTitle icon={<Receipt className="h-4 w-4" />}>Billing</CardTitle>
        <p className="text-[12px] text-ink-500 mb-3">
          Patients who finished the doctor visit and are ready for payment ({billing.length} today).
        </p>
        <BillingPatientList rows={billing} />
      </Card>

      {checkout.length > 0 && (
        <Card>
          <CardTitle icon={<CreditCard className="h-4 w-4" />}>Checkout & follow-up</CardTitle>
          <p className="text-[12px] text-ink-500 mb-3">
            Patients sent from the doctor for payment or follow-up scheduling.
          </p>
          <AppointmentQueue rows={checkout} deskRole="reception" />
        </Card>
      )}
    </div>
  );
}
