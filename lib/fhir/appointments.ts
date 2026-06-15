import { fhir } from './client';
import type { Appointment, Bundle, Patient } from './resources';
import { buildAppointment } from './builders';
import { CLINIC_ROLES, clinicRoleFromAppointment, todayDateParam, type ClinicRole } from '../clinical/scheduling';
import {
  workflowFromAppointment,
  withWorkflow,
  type VisitWorkflow,
} from '../clinical/workflow';
import { fullName } from '@/lib/utils';
import { searchPatients } from './patient-search';

export type AppointmentRow = {
  appointment: Appointment;
  patientId?: string;
  patientName: string;
  patientMrn?: string;
  clinicRole: ClinicRole | null;
  workflow: VisitWorkflow;
};

function localDateParamFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isActiveAppointmentStatus(status: Appointment['status'] | undefined): boolean {
  return status !== 'fulfilled' && status !== 'noshow' && status !== 'cancelled';
}

function appointmentStatusPriority(status: Appointment['status'] | undefined): number {
  if (status === 'arrived') return 3;
  if (status === 'booked') return 2;
  if (status === 'fulfilled') return 1;
  return 0;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getPatientMrn(patient?: Patient): string | undefined {
  if (!patient) return undefined;
  const typedMrn = patient.identifier?.find(id =>
    id.type?.coding?.some(c => c.code === 'MR'),
  )?.value?.trim();
  if (typedMrn) return typedMrn;
  return patient.identifier?.[0]?.value?.trim() || undefined;
}

function dedupeAppointmentRows(rows: AppointmentRow[]): AppointmentRow[] {
  const byKey = new Map<string, AppointmentRow>();
  for (const row of rows) {
    const key = isActiveAppointmentStatus(row.appointment.status)
      ? (row.patientMrn
        ? `mrn:${row.patientMrn}`
        : row.patientId
          ? `patient:${row.patientId}`
          : `name:${normalizeName(row.patientName)}`)
      : (row.patientId
        ? `${row.patientId}|${row.appointment.start}`
        : `${normalizeName(row.patientName)}|${row.appointment.start}`);

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const existingPriority = appointmentStatusPriority(existing.appointment.status);
    const nextPriority = appointmentStatusPriority(row.appointment.status);
    if (nextPriority > existingPriority) byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => (a.appointment.start ?? '').localeCompare(b.appointment.start ?? ''));
}

function splitAppointments(bundle: Bundle): Appointment[] {
  return (bundle.entry ?? [])
    .map(e => e.resource as Appointment | undefined)
    .filter((r): r is Appointment => r?.resourceType === 'Appointment');
}

function patientsFromBundle(bundle: Bundle): Map<string, Patient> {
  const map = new Map<string, Patient>();
  for (const entry of bundle.entry ?? []) {
    const r = entry.resource as { resourceType?: string; id?: string } | undefined;
    if (r?.resourceType === 'Patient' && r.id) map.set(r.id, r as Patient);
  }
  return map;
}

function patientIdFromAppointment(a: Appointment): string | undefined {
  const ref = a.participant?.find(p => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference;
  return ref?.split('/').pop();
}

export function practitionerIdFromAppointment(a: Appointment): string | undefined {
  const ref = a.participant?.find(p => p.actor?.reference?.startsWith('Practitioner/'))?.actor?.reference;
  return ref?.split('/').pop();
}

function appointmentInterval(a: Appointment): { start: Date; end: Date } | null {
  if (!a.start) return null;
  const start = new Date(a.start);
  if (a.end) return { start, end: new Date(a.end) };
  const role = clinicRoleFromAppointment(a.appointmentType);
  const minutes = role ? CLINIC_ROLES[role].minutes : CLINIC_ROLES.nurse.minutes;
  return { start, end: new Date(start.getTime() + minutes * 60_000) };
}

function intervalsOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return a.start < b.end && b.start < a.end;
}

const BLOCKING_APPOINTMENT_STATUSES = new Set<Appointment['status']>([
  'booked',
  'arrived',
  'pending',
  'proposed',
]);

export function toAppointmentRow(a: Appointment, patients: Map<string, Patient>): AppointmentRow {
  const patientId = patientIdFromAppointment(a);
  const patient = patientId ? patients.get(patientId) : undefined;
  return {
    appointment: a,
    patientId,
    patientName: patient ? fullName(patient) : a.participant?.[0]?.actor?.display ?? 'Unknown patient',
    patientMrn: getPatientMrn(patient),
    clinicRole: clinicRoleFromAppointment(a.appointmentType),
    workflow: workflowFromAppointment(a),
  };
}

export async function searchPatientsByName(query: string, count = 25): Promise<Patient[]> {
  return searchPatients(query, count);
}

export async function listAppointmentsForDay(
  date: string,
  clinicRole?: ClinicRole,
): Promise<AppointmentRow[]> {
  const params: Record<string, string | number> = {
    date,
    _count: 200,
    _include: 'Appointment:patient',
    _sort: 'date',
  };
  if (clinicRole) {
    params['appointment-type'] = clinicRole === 'nurse'
      ? 'http://glp1-monitor.local/CodeSystem/appointment-type|nurse-clinic'
      : 'http://glp1-monitor.local/CodeSystem/appointment-type|doctor-clinic';
  }

  try {
    const bundle = await fhir.search<Bundle>('Appointment', params);
    const patients = patientsFromBundle(bundle);
    const rows = splitAppointments(bundle).map(a => toAppointmentRow(a, patients));
    return dedupeAppointmentRows(rows);
  } catch {
    const bundle = await fhir.search<Bundle>('Appointment', {
      date,
      _count: 200,
      _include: 'Appointment:patient',
    });
    const patients = patientsFromBundle(bundle);
    let rows = splitAppointments(bundle).map(a => toAppointmentRow(a, patients));
    if (clinicRole) rows = rows.filter(r => r.clinicRole === clinicRole);
    return dedupeAppointmentRows(rows);
  }
}

export async function findPractitionerSchedulingConflict(args: {
  practitionerId: string;
  start: string;
  end: string;
  date?: string;
}): Promise<AppointmentRow | undefined> {
  const proposed = { start: new Date(args.start), end: new Date(args.end) };
  const date = args.date ?? args.start.slice(0, 10);
  const rows = await listAppointmentsForDay(date);

  return rows.find(r => {
    const appt = r.appointment;
    if (!BLOCKING_APPOINTMENT_STATUSES.has(appt.status)) return false;
    if (practitionerIdFromAppointment(appt) !== args.practitionerId) return false;
    const interval = appointmentInterval(appt);
    if (!interval) return false;
    return intervalsOverlap(proposed, interval);
  });
}

export async function createAppointment(args: {
  patientId: string;
  patientName?: string;
  clinicRole: ClinicRole;
  start: string;
  description?: string;
  practitionerId: string;
  practitionerName?: string;
}): Promise<Appointment> {
  const normalizedStart = new Date(args.start).toISOString();
  const role = CLINIC_ROLES[args.clinicRole];
  const start = new Date(normalizedStart);
  const end = new Date(start.getTime() + role.minutes * 60_000);

  const practitionerConflict = await findPractitionerSchedulingConflict({
    practitionerId: args.practitionerId,
    start: start.toISOString(),
    end: end.toISOString(),
  });

  if (practitionerConflict) {
    const who = practitionerConflict.patientName;
    const when = practitionerConflict.appointment.start
      ? new Date(practitionerConflict.appointment.start).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'that time';
    throw new Error(
      `${args.practitionerName ?? 'This provider'} is already booked at ${when} with ${who}. Choose another time or provider.`,
    );
  }

  const date = localDateParamFromIso(normalizedStart);
  const patient = await fhir.read<Patient>('Patient', args.patientId);
  const mrn = getPatientMrn(patient);
  const existingRows = await listAppointmentsForDay(date);
  const existingActive = existingRows.find(
    r =>
      isActiveAppointmentStatus(r.appointment.status)
      && (
        r.patientId === args.patientId
        || (mrn && r.patientMrn === mrn)
        || (!mrn && !r.patientId && normalizeName(r.patientName) === normalizeName(args.patientName ?? ''))
      ),
  );
  if (existingActive) {
    throw new Error('This patient already has an active appointment on the board for this day.');
  }

  const resource = buildAppointment({ ...args, start: normalizedStart });
  return fhir.create<Appointment>('Appointment', resource);
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: Appointment['status'],
): Promise<Appointment> {
  const current = await fhir.read<Appointment>('Appointment', appointmentId);
  return fhir.update<Appointment>('Appointment', appointmentId, { ...current, status });
}

export async function updateVisitWorkflow(
  appointmentId: string,
  workflow: VisitWorkflow,
  status?: Appointment['status'],
): Promise<Appointment> {
  const current = await fhir.read<Appointment>('Appointment', appointmentId);
  let next = withWorkflow(current, workflow);
  if (status) next = { ...next, status };
  if (workflow === 'completed') next = { ...next, status: 'fulfilled' };
  return fhir.update<Appointment>('Appointment', appointmentId, next);
}

const NURSE_ACTIVE_WORKFLOWS: VisitWorkflow[] = ['waiting-nurse', 'nurse-in-progress', 'return-nurse'];
const DOCTOR_ACTIVE_WORKFLOWS: VisitWorkflow[] = ['ready-for-doctor', 'doctor-in-progress'];

/** Today's nurse visit for a patient still in the nursing stage (for completing documentation). */
export async function findActiveNurseAppointmentForPatient(
  patientId: string,
  date?: string,
): Promise<string | undefined> {
  const rows = await listAppointmentsForDay(date ?? todayDateParam());
  const match = rows.find(
    r => r.patientId === patientId && NURSE_ACTIVE_WORKFLOWS.includes(r.workflow),
  );
  return match?.appointment.id;
}

/** Today's doctor visit still in the consultation stage. */
export async function findActiveDoctorAppointmentForPatient(
  patientId: string,
  date?: string,
): Promise<string | undefined> {
  const rows = await listAppointmentsForDay(date ?? todayDateParam());
  const match = rows.find(
    r => r.patientId === patientId && DOCTOR_ACTIVE_WORKFLOWS.includes(r.workflow),
  );
  return match?.appointment.id;
}

/** Fallback: any active appointment for a patient today (most recent first). */
export async function findAnyActiveAppointmentForPatient(
  patientId: string,
  date?: string,
): Promise<string | undefined> {
  const rows = await listAppointmentsForDay(date ?? todayDateParam());
  const active = rows
    .filter(r =>
      r.patientId === patientId
      && isActiveAppointmentStatus(r.appointment.status),
    )
    .sort((a, b) => (b.appointment.start ?? '').localeCompare(a.appointment.start ?? ''));
  return active[0]?.appointment.id;
}
