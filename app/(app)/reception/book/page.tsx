import Link from 'next/link';
import { listAppointmentsForDay } from '@/lib/fhir/appointments';
import { fhir } from '@/lib/fhir/client';
import { listPractitioners } from '@/lib/fhir/practitioners';
import type { Patient } from '@/lib/fhir/resources';
import { todayDateParam } from '@/lib/clinical/scheduling';
import { Card, CardTitle } from '@/components/ui/primitives';
import { BookAppointmentForm } from '@/components/scheduling/book-appointment-form';
import { fullName } from '@/lib/utils';
import { CalendarPlus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BookAppointmentPage({
  searchParams,
}: {
  searchParams: { date?: string; patientId?: string; patientName?: string };
}) {
  const date = searchParams.date ?? todayDateParam();
  const bookPatientId = searchParams.patientId?.trim();
  let bookPatientName = searchParams.patientName?.trim();

  if (bookPatientId && !bookPatientName) {
    try {
      const patient = await fhir.read<Patient>('Patient', bookPatientId);
      bookPatientName = fullName(patient);
    } catch {
      bookPatientName = 'Patient';
    }
  }

  const initialBookPatient = bookPatientId
    ? { id: bookPatientId, name: bookPatientName ?? 'Patient' }
    : undefined;

  const [rows, providers] = await Promise.all([
    listAppointmentsForDay(date),
    listPractitioners(),
  ]);

  const scheduledToday = rows.filter(
    r => r.workflow === 'scheduled' && r.appointment.status !== 'noshow',
  ).length;

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium mb-1">Book Appointment</h1>
          <p className="text-sm text-ink-500">
            Patient, provider, and time — each provider can only have one visit at a time.
            After booking, check in from the reception desk.
          </p>
        </div>
        <Link
          href={`/reception?date=${date}`}
          className="shrink-0 text-[12px] text-info hover:underline"
        >
          ← Reception desk
        </Link>
      </div>

      <Card className="mb-4">
        <CardTitle icon={<CalendarPlus className="h-4 w-4" />}>New appointment</CardTitle>
        <BookAppointmentForm
          key={bookPatientId ?? 'book-new'}
          defaultDate={date}
          initialPatient={initialBookPatient}
          providers={providers}
          afterBookPath="/reception"
        />
      </Card>

      <p className="text-[12px] text-ink-500">
        {scheduledToday} appointment{scheduledToday === 1 ? '' : 's'} awaiting check-in on{' '}
        {date}.{' '}
        <Link href={`/reception?date=${date}`} className="text-info hover:underline">
          View appointment board
        </Link>
      </p>
    </div>
  );
}
