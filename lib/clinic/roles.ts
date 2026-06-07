export type ActingRole = 'admin' | 'reception' | 'nurse' | 'doctor' | 'patient';

export const ACTING_ROLES: Array<{ id: ActingRole; label: string; description: string }> = [
  { id: 'admin', label: 'Admin', description: 'Clinic settings, providers, terminology' },
  { id: 'reception', label: 'Reception', description: 'Registration, check-in, scheduling' },
  { id: 'nurse', label: 'Nurse', description: 'Vitals, POC tests, nursing notes' },
  { id: 'doctor', label: 'Doctor', description: 'Review, consultation, orders' },
  { id: 'patient', label: 'Patient (kiosk)', description: 'Pre-screening check-in only' },
];

export { DEFAULT_CLINIC_NAME } from './branding';

export const STORAGE_KEYS = {
  role: 'glp1-acting-role',
  clinicName: 'glp1-clinic-name',
  sidebarCollapsed: 'glp1-sidebar-collapsed',
} as const;
