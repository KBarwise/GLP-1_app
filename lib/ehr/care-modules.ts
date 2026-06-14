import type { ActingRole } from '@/lib/clinic/roles';
import { CLINIC_ROLES, type ClinicRole } from '@/lib/clinical/scheduling';
import type { Appointment } from '@/lib/fhir/resources';

/** Stored on Appointment.extension when booked with a care module. */
export const CARE_MODULE_EXTENSION_URL =
  'http://codemuse.local/StructureDefinition/care-module';

export type CareModuleId =
  | 'primary-care'
  | 'nursing-vitals'
  | 'antenatal'
  | 'gynaecology'
  | 'lab-request';

export type CareModuleWriteProfile = 'observations' | 'encounter-bundle' | 'service-request';

export type CareModuleDef = {
  id: CareModuleId;
  label: string;
  shortLabel: string;
  description: string;
  /** openEHR template id on EHRbase (ADL 1.4 definition name). */
  templateId: string;
  roles: ActingRole[];
  writeProfile: CareModuleWriteProfile;
  /** Maps to nurse/doctor queue workflow when booking. */
  queueRole: ClinicRole;
  appointmentTypeCode: string;
  appointmentTypeDisplay: string;
  durationMinutes: number;
};

export const CARE_MODULES: Record<CareModuleId, CareModuleDef> = {
  'primary-care': {
    id: 'primary-care',
    label: 'Primary care (SOAP)',
    shortLabel: 'Primary care',
    description: 'SOAP consultation note — Keisha template',
    templateId: 'SOAP - Keisha v3.3',
    roles: ['doctor'],
    writeProfile: 'encounter-bundle',
    queueRole: 'doctor',
    appointmentTypeCode: 'primary-care',
    appointmentTypeDisplay: 'Primary care consultation',
    durationMinutes: 45,
  },
  'nursing-vitals': {
    id: 'nursing-vitals',
    label: 'Nursing vital signs',
    shortLabel: 'Nursing vitals',
    description: 'Vitals, anthropometrics, and nursing documentation',
    templateId: 'Nursing Vital Signs - Keisha v3',
    roles: ['nurse'],
    writeProfile: 'observations',
    queueRole: 'nurse',
    appointmentTypeCode: 'nursing-vitals',
    appointmentTypeDisplay: 'Nursing vital signs',
    durationMinutes: 30,
  },
  antenatal: {
    id: 'antenatal',
    label: 'Antenatal care (ANC)',
    shortLabel: 'Antenatal',
    description: 'Antenatal encounter documentation',
    templateId: 'ANC Encounter v 0.3',
    roles: ['doctor', 'nurse'],
    writeProfile: 'encounter-bundle',
    queueRole: 'doctor',
    appointmentTypeCode: 'antenatal',
    appointmentTypeDisplay: 'Antenatal visit',
    durationMinutes: 45,
  },
  gynaecology: {
    id: 'gynaecology',
    label: 'Gynaecology (GOPD)',
    shortLabel: 'Gynaecology',
    description: 'Gynaecology outpatient documentation',
    templateId: 'GOPD - Keisha v1.5',
    roles: ['doctor'],
    writeProfile: 'encounter-bundle',
    queueRole: 'doctor',
    appointmentTypeCode: 'gynaecology',
    appointmentTypeDisplay: 'Gynaecology consultation',
    durationMinutes: 45,
  },
  'lab-request': {
    id: 'lab-request',
    label: 'Laboratory request',
    shortLabel: 'Lab request',
    description: 'Blood laboratory test orders',
    templateId: 'JDP - Generic blood laboratory report.v0',
    roles: ['doctor', 'nurse'],
    writeProfile: 'service-request',
    queueRole: 'doctor',
    appointmentTypeCode: 'lab-request',
    appointmentTypeDisplay: 'Laboratory request',
    durationMinutes: 20,
  },
};

export const CARE_MODULE_LIST: CareModuleDef[] = Object.values(CARE_MODULES);

export function isCareModuleId(value: string): value is CareModuleId {
  return value in CARE_MODULES;
}

export function getCareModule(id: CareModuleId): CareModuleDef {
  return CARE_MODULES[id];
}

export function getCareModuleTemplateId(id: CareModuleId): string {
  return CARE_MODULES[id].templateId;
}

/** Legacy nurse/doctor clinic roles map to default care modules. */
export function careModuleForClinicRole(role: ClinicRole): CareModuleId {
  return role === 'nurse' ? 'nursing-vitals' : 'primary-care';
}

export function defaultCareModuleForActingRole(role: ActingRole): CareModuleId | null {
  if (role === 'nurse') return 'nursing-vitals';
  if (role === 'doctor') return 'primary-care';
  return null;
}

export function careModuleAllowsRole(moduleId: CareModuleId, role: ActingRole): boolean {
  return getCareModule(moduleId).roles.includes(role);
}

export function careModuleFromAppointment(a: Appointment): CareModuleId | null {
  const ext = a.extension?.find(e => e.url === CARE_MODULE_EXTENSION_URL);
  const extCode = ext?.valueCode;
  if (extCode && isCareModuleId(extCode)) return extCode;

  const typeCode = a.appointmentType?.coding?.[0]?.code;
  if (!typeCode) return null;

  for (const mod of CARE_MODULE_LIST) {
    if (mod.appointmentTypeCode === typeCode) return mod.id;
  }

  if (typeCode === CLINIC_ROLES.nurse.code) return 'nursing-vitals';
  if (typeCode === CLINIC_ROLES.doctor.code) return 'primary-care';
  return null;
}

export function careModuleDocumentationHref(
  patientId: string,
  moduleId: CareModuleId,
  appointmentId?: string,
): string {
  const q = new URLSearchParams();
  if (appointmentId?.trim()) q.set('appointment', appointmentId.trim());
  const query = q.toString();
  const base = `/patient/${patientId}/care/${moduleId}`;
  return query ? `${base}?${query}` : base;
}

/** Route for legacy pages that accept ?module= instead of /care/[moduleId]. */
export function legacyModuleHref(
  patientId: string,
  moduleId: CareModuleId,
  appointmentId?: string,
): string {
  const mod = getCareModule(moduleId);
  const q = new URLSearchParams({ module: moduleId });
  if (appointmentId?.trim()) q.set('appointment', appointmentId.trim());

  if (moduleId === 'nursing-vitals') {
    return `/patient/${patientId}/nurse?${q.toString()}`;
  }
  if (moduleId === 'primary-care') {
    return `/patient/${patientId}/consult/document?${q.toString()}`;
  }
  return careModuleDocumentationHref(patientId, mod.id, appointmentId);
}

export function resolveDocumentationHref(
  patientId: string,
  moduleId: CareModuleId | null | undefined,
  appointmentId?: string,
): string {
  const resolved = moduleId ?? 'primary-care';
  if (resolved === 'nursing-vitals') {
    return legacyModuleHref(patientId, 'nursing-vitals', appointmentId);
  }
  if (resolved === 'primary-care') {
    return legacyModuleHref(patientId, 'primary-care', appointmentId);
  }
  return careModuleDocumentationHref(patientId, resolved, appointmentId);
}

/** Care modules the acting role may open for documentation. */
export function careModulesForRole(role: ActingRole): CareModuleDef[] {
  return CARE_MODULE_LIST.filter(mod => mod.roles.includes(role));
}

export function careModulePatientHref(patientId: string, moduleId: CareModuleId): string {
  return resolveDocumentationHref(patientId, moduleId);
}
