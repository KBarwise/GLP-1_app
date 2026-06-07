import type {
  Appointment,
  Condition,
  Encounter,
  Flag,
  MedicationRequest,
  Observation,
  Practitioner,
  ServiceRequest,
  CodeableConcept,
  Reference,
} from './resources';
import { APPOINTMENT_TYPE_SYSTEM, CLINIC_ROLES, type ClinicRole } from '../clinical/scheduling';
import { withWorkflow, type VisitWorkflow } from '../clinical/workflow';

const SNOMED = 'http://snomed.info/sct';
const LOINC = 'http://loinc.org';

export const sct = (code: string, display: string): CodeableConcept => ({
  coding: [{ system: SNOMED, code, display }],
  text: display,
});

export const loinc = (code: string, display: string): CodeableConcept => ({
  coding: [{ system: LOINC, code, display }],
  text: display,
});

export const patientRef = (id: string, display?: string): Reference => ({
  reference: `Patient/${id}`,
  type: 'Patient',
  display,
});

export const buildMedicationRequest = (args: {
  patientId: string;
  medicationCode: { code: string; display: string };
  reasonCode?: { code: string; display: string };
  reasonCodes?: { code: string; display: string }[];
  doseText: string;
  doseValue: number;
  doseUnit: string;
  frequencyPeriodDays?: number;
  requesterId?: string;
  priority?: 'routine' | 'urgent';
  qualifierNotes?: Array<{ text: string }>;
}): MedicationRequest => {
  const reasons =
    args.reasonCodes ??
    (args.reasonCode ? [args.reasonCode] : [{ code: '414916001', display: 'Obesity' }]);
  return {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    ...(args.priority && args.priority !== 'routine' ? { priority: args.priority } : {}),
    medicationCodeableConcept: sct(args.medicationCode.code, args.medicationCode.display),
    subject: patientRef(args.patientId),
    authoredOn: new Date().toISOString(),
    ...(args.requesterId && { requester: { reference: `Practitioner/${args.requesterId}` } }),
    ...(args.qualifierNotes?.length ? { note: args.qualifierNotes } : {}),
    reasonCode: reasons.map(r => sct(r.code, r.display)),
    dosageInstruction: [{
      text: args.doseText,
      timing: {
        repeat: {
          frequency: 1,
          period: args.frequencyPeriodDays ?? 7,
          periodUnit: 'd',
        },
      },
      route: sct('34206005', 'Subcutaneous route'),
      doseAndRate: [{
        doseQuantity: {
          value: args.doseValue,
          unit: args.doseUnit,
          system: 'http://unitsofmeasure.org',
          code: args.doseUnit,
        },
      }],
    }],
  };
};

/** Oral or general medication order (catalog agents). */
export const buildMedicationRequestFromCatalog = (args: {
  patientId: string;
  medicationCode: { code: string; display: string };
  doseText: string;
  reasonCodes?: { code: string; display: string }[];
  routeCode?: string;
  routeDisplay?: string;
  priority?: 'routine' | 'urgent';
  qualifierNotes?: Array<{ text: string }>;
}): MedicationRequest => {
  const reasons = args.reasonCodes ?? [{ code: '414916001', display: 'Obesity' }];
  return {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    ...(args.priority && args.priority !== 'routine' ? { priority: args.priority } : {}),
    medicationCodeableConcept: sct(args.medicationCode.code, args.medicationCode.display),
    subject: patientRef(args.patientId),
    authoredOn: new Date().toISOString(),
    ...(args.qualifierNotes?.length ? { note: args.qualifierNotes } : {}),
    reasonCode: reasons.map(r => sct(r.code, r.display)),
    dosageInstruction: [{
      text: args.doseText,
      route: sct(args.routeCode ?? '26643006', args.routeDisplay ?? 'Oral route'),
    }],
  };
};

export const buildFlag = (args: {
  patientId: string;
  code: { code: string; display: string };
  category: 'safety' | 'clinical' | 'admin';
}): Flag => ({
  resourceType: 'Flag',
  status: 'active',
  category: [sct(
    args.category === 'safety' ? '182840001' : '404684003',
    args.category === 'safety' ? 'Drug treatment monitoring' : 'Clinical finding',
  )],
  code: sct(args.code.code, args.code.display),
  subject: patientRef(args.patientId),
  period: { start: new Date().toISOString() },
});

export const buildObservation = (args: {
  patientId: string;
  code: CodeableConcept;
  value: number;
  unit: string;
  effective?: string;
  category?: 'laboratory' | 'vital-signs' | 'survey';
}): Observation => ({
  resourceType: 'Observation',
  status: 'final',
  category: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/observation-category',
      code: args.category ?? 'laboratory',
    }],
  }],
  code: args.code,
  subject: patientRef(args.patientId),
  effectiveDateTime: args.effective ?? new Date().toISOString(),
  valueQuantity: {
    value: args.value,
    unit: args.unit,
    system: 'http://unitsofmeasure.org',
    code: args.unit,
  },
});

export const buildObservationString = (args: {
  patientId: string;
  loinc: string;
  display: string;
  value: string;
  category?: 'laboratory' | 'vital-signs' | 'survey';
}): Observation => ({
  resourceType: 'Observation',
  status: 'final',
  category: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/observation-category',
      code: args.category ?? 'survey',
    }],
  }],
  code: loinc(args.loinc, args.display),
  subject: patientRef(args.patientId),
  effectiveDateTime: new Date().toISOString(),
  valueString: args.value,
});

export const buildObservationCoded = (args: {
  patientId: string;
  loinc: string;
  display: string;
  result: string;
}): Observation => ({
  resourceType: 'Observation',
  status: 'final',
  category: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/observation-category',
      code: 'laboratory',
    }],
  }],
  code: loinc(args.loinc, args.display),
  subject: patientRef(args.patientId),
  effectiveDateTime: new Date().toISOString(),
  valueCodeableConcept: { text: args.result },
});

const CONDITION_CLINICAL_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-clinical';
const CONDITION_VERIFICATION_SYSTEM = 'http://terminology.hl7.org/CodeSystem/condition-ver-status';

export const buildCondition = (args: {
  patientId: string;
  code: { code: string; display: string };
  category?: 'problem-list-item' | 'encounter-diagnosis';
  verification?:
    | 'unconfirmed'
    | 'provisional'
    | 'differential'
    | 'confirmed';
  clinicalStatus?:
    | 'active'
    | 'recurrence'
    | 'relapse'
    | 'inactive'
    | 'remission'
    | 'resolved';
}): Condition => ({
  resourceType: 'Condition',
  clinicalStatus: {
    coding: [{
      system: CONDITION_CLINICAL_SYSTEM,
      code: args.clinicalStatus ?? 'active',
    }],
  },
  verificationStatus: {
    coding: [{
      system: CONDITION_VERIFICATION_SYSTEM,
      code: args.verification ?? 'confirmed',
    }],
  },
  category: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/condition-category',
      code: args.category ?? 'encounter-diagnosis',
    }],
  }],
  code: sct(args.code.code, args.code.display),
  subject: patientRef(args.patientId),
  recordedDate: new Date().toISOString(),
});

export function applyConditionQualifiers(
  condition: Condition,
  args: {
    clinicalStatus: NonNullable<Parameters<typeof buildCondition>[0]['clinicalStatus']>;
    verification: NonNullable<Parameters<typeof buildCondition>[0]['verification']>;
  },
): Condition {
  return {
    ...condition,
    clinicalStatus: {
      coding: [{ system: CONDITION_CLINICAL_SYSTEM, code: args.clinicalStatus }],
    },
    verificationStatus: {
      coding: [{ system: CONDITION_VERIFICATION_SYSTEM, code: args.verification }],
    },
  };
}

export const buildEncounter = (args: {
  patientId: string;
  reason: string;
}): Encounter => ({
  resourceType: 'Encounter',
  status: 'finished',
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'AMB',
    display: 'ambulatory',
  },
  subject: patientRef(args.patientId),
  period: { start: new Date().toISOString() },
  reasonCode: [{ text: args.reason }],
});

export const buildAppointment = (args: {
  patientId: string;
  patientName?: string;
  clinicRole: ClinicRole;
  start: string;
  description?: string;
  workflow?: VisitWorkflow;
  practitionerId?: string;
  practitionerName?: string;
}): Appointment => {
  const role = CLINIC_ROLES[args.clinicRole];
  const start = new Date(args.start);
  const end = new Date(start.getTime() + role.minutes * 60_000);
  const base: Appointment = {
    resourceType: 'Appointment',
    status: 'booked',
    appointmentType: {
      coding: [{
        system: APPOINTMENT_TYPE_SYSTEM,
        code: role.code,
        display: role.display,
      }],
      text: role.display,
    },
    description: args.description,
    start: start.toISOString(),
    end: end.toISOString(),
    created: new Date().toISOString(),
    participant: [
      {
        actor: patientRef(args.patientId, args.patientName),
        status: 'accepted',
        required: 'required',
      },
      ...(args.practitionerId
        ? [{
            actor: {
              reference: `Practitioner/${args.practitionerId}`,
              type: 'Practitioner',
              display: args.practitionerName,
            },
            status: 'accepted' as const,
            required: 'required' as const,
          }]
        : []),
    ],
  };
  return withWorkflow(base, args.workflow ?? 'scheduled');
};

export const buildPractitioner = (args: {
  family: string;
  given: string;
  npi?: string;
  role: 'doctor' | 'nurse' | 'reception' | 'admin';
  phone?: string;
  email?: string;
  active?: boolean;
}): Practitioner => {
  const roleQualification = (() => {
    if (args.role === 'doctor') {
      return { code: 'MD', display: 'Doctor of Medicine', text: 'Physician' };
    }
    if (args.role === 'nurse') {
      return { code: 'RN', display: 'Registered Nurse', text: 'Registered nurse' };
    }
    if (args.role === 'reception') {
      return { code: 'RECP', display: 'Reception staff', text: 'Reception staff' };
    }
    return { code: 'ADMIN', display: 'Administrative staff', text: 'Administrative staff' };
  })();

  const given = args.given.trim().split(/\s+/).filter(Boolean);
  return {
    resourceType: 'Practitioner',
    active: args.active !== false,
    identifier: args.npi?.trim()
      ? [{
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: args.npi.trim(),
        }]
      : undefined,
    name: [{
      use: 'official',
      family: args.family.trim() || undefined,
      given: given.length > 0 ? given : undefined,
      prefix: args.role === 'doctor' ? ['Dr.'] : undefined,
    }],
    telecom: [
      ...(args.phone?.trim() ? [{ system: 'phone' as const, value: args.phone.trim(), use: 'work' as const }] : []),
      ...(args.email?.trim() ? [{ system: 'email' as const, value: args.email.trim(), use: 'work' as const }] : []),
    ],
    qualification: [{
      code: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
          code: roleQualification.code,
          display: roleQualification.display,
        }],
        text: roleQualification.text,
      },
    }],
  };
};

export const buildServiceRequest = (args: {
  patientId: string;
  loinc: string;
  display: string;
  encounterId?: string;
}): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  status: 'active',
  intent: 'order',
  code: loinc(args.loinc, args.display),
  subject: patientRef(args.patientId),
  authoredOn: new Date().toISOString(),
  ...(args.encounterId && { encounter: { reference: `Encounter/${args.encounterId}` } }),
});
