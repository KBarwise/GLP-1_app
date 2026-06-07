import type { ActingRole } from './roles';

/** Vitals, labs, risk, cohort, clinical dashboard. */
export function canViewClinicalData(role: ActingRole): boolean {
  return role === 'nurse' || role === 'doctor';
}

/** Kiosk pre-prescription screening. */
export function canAccessScreening(role: ActingRole): boolean {
  return role === 'patient' || role === 'nurse' || role === 'doctor';
}

/** Registration and demographic edits. */
export function canEditDemographics(role: ActingRole): boolean {
  return role === 'reception' || role === 'admin';
}

/** Duplicate scan and patient merge (MDM). */
export function canMergePatients(role: ActingRole): boolean {
  return role === 'reception' || role === 'admin';
}

export function canSearchPatients(role: ActingRole): boolean {
  return role === 'reception' || role === 'nurse' || role === 'doctor' || role === 'patient';
}

/** Default route when opening a patient from search or lists. */
export function patientDestination(role: ActingRole, patientId: string): string {
  switch (role) {
    case 'patient':
      return `/screening/${patientId}`;
    case 'nurse':
      return `/patient/${patientId}`;
    case 'doctor':
      return `/patient/${patientId}/consult/document`;
    case 'reception':
    case 'admin':
      return `/register/${patientId}`;
  }
}

/** Reception desk — book appointment with patient pre-selected. */
export function receptionBookPatientUrl(patientId: string, patientName: string): string {
  const q = new URLSearchParams({
    patientId,
    patientName,
  });
  return `/reception/book?${q.toString()}`;
}

export function canBookAppointments(role: ActingRole): boolean {
  return role === 'reception' || role === 'admin';
}

const CLINICAL_PREFIXES = ['/prescribe', '/cohort'];

export function roleAllowsPath(role: ActingRole, pathname: string): boolean {
  if (pathname.startsWith('/admin')) return role === 'admin';
  if (pathname.startsWith('/mdm')) return canMergePatients(role);
  if (pathname.startsWith('/bindings')) return role === 'admin';

  if (pathname === '/kiosk' || pathname.startsWith('/kiosk/')) {
    return role === 'patient';
  }

  if (pathname.startsWith('/screening')) {
    return canAccessScreening(role);
  }

  if (CLINICAL_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }

  if (pathname.startsWith('/register')) {
    return canEditDemographics(role);
  }

  if (pathname.startsWith('/reception')) {
    return role === 'reception' || role === 'admin';
  }

  if (pathname.startsWith('/clinic/nurse')) {
    return role === 'nurse';
  }

  if (pathname.startsWith('/clinic/doctor')) {
    return role === 'doctor';
  }

  if (pathname.startsWith('/patients')) {
    return role === 'reception' || role === 'admin';
  }

  if (pathname.match(/^\/patient\/[^/]+\/nurse/)) {
    return role === 'nurse';
  }

  if (pathname.match(/^\/patient\/[^/]+\/consult/)) {
    return role === 'doctor';
  }

  if (pathname.match(/^\/patient\/[^/]+$/)) {
    return role === 'nurse' || role === 'doctor';
  }

  if (pathname.startsWith('/patient/')) {
    return false;
  }

  return role !== 'patient';
}

export function assertCanEditDemographics(role: ActingRole): void {
  if (!canEditDemographics(role)) {
    throw new Error('Your role cannot create or edit patient demographics.');
  }
}

export function assertCanMergePatients(role: ActingRole): void {
  if (!canMergePatients(role)) {
    throw new Error('Your role cannot merge patient records.');
  }
}

export function accessDeniedMessage(role: ActingRole): string {
  if (role === 'patient') {
    return 'This area is for clinic staff. Use the kiosk pre-screening flow.';
  }
  if (role === 'admin' || role === 'reception') {
    return 'Clinical records are not available in this role. Use registration or the reception desk.';
  }
  return 'You do not have access to this page in your current role.';
}
