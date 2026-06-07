'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import {
  evaluateKioskScreening,
  kioskScreeningPassed,
  screeningSummaryMessage,
} from '@/lib/screening/evaluate-kiosk';
import type {
  KioskConditionSelection,
  KioskDemographics,
  KioskScreeningItemRecord,
} from '@/lib/kiosk/intake-types';
import { persistKioskIntakeToPatient } from '@/lib/kiosk/persist-intake-to-patient';
import {
  saveKioskIntakeLead,
  listPendingKioskIntakes,
  markKioskIntakeRegistered,
  getKioskIntakeLead,
} from '@/lib/kiosk/intake-store';
import { KIOSK_RETURNING_WARNING_SYMPTOMS } from '@/lib/kiosk/returning-symptoms';
import {
  listNewReturningSymptomReports,
  saveReturningSymptomReport,
} from '@/lib/kiosk/symptom-report-store';
import { findPatientByNameAndDob } from '@/lib/fhir/patient-search';
import { fullName } from '@/lib/utils';
import { firstContactError, validateContactFields } from '@/lib/validation/contact';

function revalidateKioskQueues() {
  revalidatePath('/reception');
}

export async function submitKioskScreening(args: {
  demographics: KioskDemographics;
  conditions: KioskConditionSelection[];
  consented: boolean;
}): Promise<{
  passed: boolean;
  overall: 'clear' | 'amber' | 'red';
  summary: string;
  items: { label: string; level: string; reason: string }[];
}> {
  if (!args.consented) {
    throw new Error('Consent is required to continue.');
  }

  const d = args.demographics;
  if (!d.given.trim() || !d.family.trim()) {
    throw new Error('Please enter your first and last name.');
  }
  if (!d.age || d.age < 1 || d.age > 120) {
    throw new Error('Please enter a valid age.');
  }
  const contactErrors = validateContactFields(d.phone, d.email, { requireOne: true });
  const contactErr = firstContactError(contactErrors);
  if (contactErr) throw new Error(contactErr);

  const screening = await evaluateKioskScreening(args.conditions);
  const passed = kioskScreeningPassed(screening.overall);

  if (!passed) {
    return {
      passed: false,
      overall: screening.overall,
      summary: screeningSummaryMessage(screening.overall),
      items: screening.items.map(i => ({
        label: i.label,
        level: i.level,
        reason: i.reason,
      })),
    };
  }

  const leadId = randomUUID();
  await saveKioskIntakeLead({
    id: leadId,
    createdAt: new Date().toISOString(),
    status: 'pending-registration',
    pathway: 'glp1',
    demographics: {
      given: d.given.trim(),
      family: d.family.trim(),
      age: d.age,
      gender: d.gender,
      phone: d.phone.trim(),
      email: d.email.trim(),
    },
    screeningOverall: screening.overall,
    screeningSummary: screeningSummaryMessage(screening.overall),
    reportedConditions: args.conditions,
    screeningItems: screening.items.map(i => ({
      label: i.label,
      level: i.level,
      reason: i.reason,
    })),
  });
  revalidateKioskQueues();

  return {
    passed: true,
    overall: screening.overall,
    summary: screeningSummaryMessage(screening.overall),
    items: screening.items.map(i => ({
      label: i.label,
      level: i.level,
      reason: i.reason,
    })),
  };
}

export async function getPendingKioskIntakes() {
  return listPendingKioskIntakes();
}

export async function getNewReturningSymptomReports() {
  return listNewReturningSymptomReports();
}

export async function lookupReturningPatient(args: {
  given: string;
  family: string;
  birthDate: string;
}): Promise<{ patientId: string; patientName: string } | { error: string }> {
  const patient = await findPatientByNameAndDob(args.given, args.family, args.birthDate);
  if (!patient?.id) {
    return { error: 'not-found' };
  }
  return { patientId: patient.id, patientName: fullName(patient) };
}

export async function submitReturningPatientSymptoms(args: {
  patientId: string;
  patientName: string;
  birthDate: string;
  symptomCodes: string[];
  consented: boolean;
}): Promise<{ urgent: boolean; symptomLabels: string[] }> {
  if (!args.consented) {
    throw new Error('Consent is required to continue.');
  }

  const known = new Map(KIOSK_RETURNING_WARNING_SYMPTOMS.map(s => [s.code, s]));
  const symptoms = args.symptomCodes
    .map(code => known.get(code))
    .filter((s): s is (typeof KIOSK_RETURNING_WARNING_SYMPTOMS)[number] => Boolean(s))
    .map(s => ({ code: s.code, display: s.display }));

  const urgent = symptoms.length > 0;

  await saveReturningSymptomReport({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    patientId: args.patientId,
    patientName: args.patientName,
    birthDate: args.birthDate,
    symptoms,
    urgent,
    status: 'new',
  });
  revalidateKioskQueues();

  return {
    urgent,
    symptomLabels: symptoms.map(s => s.display),
  };
}

export async function loadKioskIntakeForRegistration(intakeId: string) {
  const lead = await getKioskIntakeLead(intakeId);
  if (!lead || lead.status !== 'pending-registration') return null;
  return lead;
}

export async function completeKioskIntakeRegistration(intakeId: string, patientId: string) {
  const lead = await getKioskIntakeLead(intakeId);
  if (lead) {
    await persistKioskIntakeToPatient(patientId, lead);
  }
  await markKioskIntakeRegistered(intakeId, patientId);
  revalidatePath(`/patient/${patientId}`);
  revalidateKioskQueues();
}

const DIET_EXERCISE_SUMMARY = 'Diet & exercise pathway — awaiting registration';

export async function confirmKioskFailChoice(args: {
  demographics: KioskDemographics;
  conditions: KioskConditionSelection[];
  screeningItems?: KioskScreeningItemRecord[];
  choice: 'reception-diet-exercise' | 'discard';
}): Promise<{ saved: boolean; message: string }> {
  const d = args.demographics;
  if (!d.given.trim() || !d.family.trim()) {
    throw new Error('Please enter your first and last name.');
  }
  const contactErrors = validateContactFields(d.phone, d.email, { requireOne: true });
  const contactErr = firstContactError(contactErrors);
  if (contactErr) throw new Error(contactErr);

  if (args.choice === 'discard') {
    return {
      saved: false,
      message:
        'Your information has not been saved. You may continue treatment elsewhere.',
    };
  }

  const leadId = randomUUID();
  await saveKioskIntakeLead({
    id: leadId,
    createdAt: new Date().toISOString(),
    status: 'pending-registration',
    pathway: 'diet-exercise',
    demographics: {
      given: d.given.trim(),
      family: d.family.trim(),
      age: d.age,
      gender: d.gender,
      phone: d.phone.trim(),
      email: d.email.trim(),
    },
    screeningOverall: 'red',
    screeningSummary: DIET_EXERCISE_SUMMARY,
    reportedConditions: args.conditions,
    screeningItems: args.screeningItems ?? [],
  });
  revalidateKioskQueues();

  return {
    saved: true,
    message:
      'Your details have been sent to reception for medically assisted weight loss through diet and exercise.',
  };
}
