/** Local appointment type codes stored in FHIR Appointment.appointmentType */

export const APPOINTMENT_TYPE_SYSTEM = 'http://glp1-monitor.local/CodeSystem/appointment-type';

export type ClinicRole = 'nurse' | 'doctor';

export const CLINIC_ROLES: Record<ClinicRole, { code: string; display: string; minutes: number }> = {
  nurse: { code: 'nurse-clinic', display: 'Nurse clinic', minutes: 30 },
  doctor: { code: 'doctor-clinic', display: 'Doctor consultation', minutes: 45 },
};

/** Map legacy clinic role codes and care-module appointment types to nurse/doctor queue. */
export function clinicRoleFromAppointment(appointmentType?: { coding?: Array<{ code?: string }> }): ClinicRole | null {
  const code = appointmentType?.coding?.[0]?.code;
  if (!code) return null;
  if (code === CLINIC_ROLES.nurse.code || code === 'nursing-vitals') return 'nurse';
  if (code === CLINIC_ROLES.doctor.code) return 'doctor';
  if (code === 'primary-care' || code === 'antenatal' || code === 'gynaecology' || code === 'lab-request') {
    return 'doctor';
  }
  return null;
}

export type AppointmentStatus =
  | 'booked'
  | 'arrived'
  | 'fulfilled'
  | 'cancelled'
  | 'noshow';

export const RECEPTION_STATUSES: AppointmentStatus[] = ['booked', 'arrived', 'noshow'];
export const CLINIC_QUEUE_STATUSES: AppointmentStatus[] = ['arrived', 'booked'];

export function todayDateParam(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatTime(iso?: string): string {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(11, 16);
  }
}
