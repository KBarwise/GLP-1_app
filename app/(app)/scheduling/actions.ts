'use server';

import { revalidatePath } from 'next/cache';
import {
  createAppointment,
  findActiveDoctorAppointmentForPatient,
  findActiveNurseAppointmentForPatient,
  updateAppointmentStatus,
  updateVisitWorkflow,
} from '@/lib/fhir/appointments';
import { canViewClinicalData } from '@/lib/clinic/access';
import { getActingRoleFromCookie } from '@/lib/clinic/server-role';
import type { ClinicRole } from '@/lib/clinical/scheduling';
import type { VisitWorkflow } from '@/lib/clinical/workflow';
import type { Appointment } from '@/lib/fhir/resources';
import { formatFhirActionError } from '@/lib/fhir/error-message';

function revalidateScheduling() {
  revalidatePath('/reception');
  revalidatePath('/clinic/nurse');
  revalidatePath('/clinic/doctor');
  revalidatePath('/reception/book');
}

export type BookAppointmentResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; error: string };

export async function bookAppointment(args: {
  patientId: string;
  patientName?: string;
  clinicRole: ClinicRole;
  start: string;
  description?: string;
  practitionerId: string;
  practitionerName?: string;
}): Promise<BookAppointmentResult> {
  if (!args.practitionerId?.trim()) {
    return { ok: false, error: 'Select a provider for this appointment.' };
  }

  const startDate = new Date(args.start);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, error: 'Enter a valid date and time.' };
  }

  try {
    const created = await createAppointment({
      ...args,
      start: startDate.toISOString(),
    });
    revalidateScheduling();
    return { ok: true, appointment: created };
  } catch (err) {
    return {
      ok: false,
      error: formatFhirActionError(err, 'Could not book this appointment. Check patient, provider, and time.'),
    };
  }
}

export async function setAppointmentStatus(
  appointmentId: string,
  status: Appointment['status'],
): Promise<Appointment> {
  const updated = await updateAppointmentStatus(appointmentId, status);
  revalidateScheduling();
  return updated;
}

export async function advanceVisitWorkflow(
  appointmentId: string,
  workflow: VisitWorkflow,
  status?: Appointment['status'],
): Promise<Appointment> {
  const updated = await updateVisitWorkflow(appointmentId, workflow, status);
  revalidateScheduling();
  return updated;
}

/** Reception check-in: patient arrived and enters nurse queue. */
export async function checkInPatient(appointmentId: string): Promise<Appointment> {
  return advanceVisitWorkflow(appointmentId, 'waiting-nurse', 'arrived');
}

/** Nurse finished documentation — patient appears in the doctor queue. */
export async function completeNurseVisit(args: {
  patientId: string;
  appointmentId?: string;
}): Promise<Appointment> {
  if (!canViewClinicalData(getActingRoleFromCookie())) {
    throw new Error('You do not have permission to complete nurse documentation.');
  }

  let appointmentId = args.appointmentId?.trim();
  if (!appointmentId) {
    appointmentId = await findActiveNurseAppointmentForPatient(args.patientId);
  }
  if (!appointmentId) {
    throw new Error(
      'No active nurse visit found for today. Open documentation from the nurse queue using Start.',
    );
  }

  return advanceVisitWorkflow(appointmentId, 'ready-for-doctor');
}

function assertDoctorRole(): void {
  const role = getActingRoleFromCookie();
  if (role !== 'doctor' && role !== 'admin') {
    throw new Error('Only a doctor can complete or route a consultation.');
  }
}

/** Doctor finished consult — patient leaves doctor queue and appears at reception for checkout. */
export async function sendPatientToReceptionCheckout(args: {
  patientId: string;
  appointmentId?: string;
}): Promise<Appointment> {
  assertDoctorRole();

  let appointmentId = args.appointmentId?.trim();
  if (!appointmentId) {
    appointmentId = await findActiveDoctorAppointmentForPatient(args.patientId);
  }
  if (!appointmentId) {
    throw new Error(
      'No active consultation found for today. Open the visit from the doctor queue using Start.',
    );
  }

  return advanceVisitWorkflow(appointmentId, 'ready-checkout');
}

/** Return to nursing without closing the consultation (draft may be resumed later). */
export async function sendPatientBackToNurse(args: {
  patientId: string;
  appointmentId?: string;
}): Promise<Appointment> {
  assertDoctorRole();

  let appointmentId = args.appointmentId?.trim();
  if (!appointmentId) {
    appointmentId = await findActiveDoctorAppointmentForPatient(args.patientId);
  }
  if (!appointmentId) {
    throw new Error(
      'No active consultation found for today. Open the visit from the doctor queue using Start.',
    );
  }

  return advanceVisitWorkflow(appointmentId, 'return-nurse');
}
