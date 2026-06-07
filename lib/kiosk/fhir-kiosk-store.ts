import { fhir } from '@/lib/fhir/client';
import type { Basic, Bundle } from '@/lib/fhir/resources';
import {
  normalizeKioskIntakeLead,
  type KioskIntakeLead,
  type KioskIntakePathway,
} from './intake-types';
import {
  KIOSK_PAYLOAD_URL,
  KIOSK_RECORD_ID_SYSTEM,
  KIOSK_RECORD_TYPE,
  KIOSK_RECORD_TYPE_SYSTEM,
} from './fhir-codes';
import type { ReturningSymptomReport } from './symptom-report-store';

function splitBasics(bundle: Bundle<Basic>): Basic[] {
  return (bundle.entry ?? [])
    .map(e => e.resource)
    .filter((r): r is Basic => r?.resourceType === 'Basic');
}

function payloadFromBasic<T>(b: Basic): T | undefined {
  const raw = b.extension?.find(e => e.url === KIOSK_PAYLOAD_URL)?.valueString;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function parseIntakeLead(basic: Basic): KioskIntakeLead | undefined {
  const lead = payloadFromBasic<KioskIntakeLead>(basic);
  return lead ? normalizeKioskIntakeLead(lead) : undefined;
}

async function findBasicByRecordId(recordId: string): Promise<Basic | null> {
  const bundle = await fhir.search<Bundle<Basic>>('Basic', {
    identifier: `${KIOSK_RECORD_ID_SYSTEM}|${recordId}`,
    _count: 1,
  });
  return splitBasics(bundle)[0] ?? null;
}

async function listBasicsByRecordType(recordType: string): Promise<Basic[]> {
  const bundle = await fhir.search<Bundle<Basic>>('Basic', {
    code: `${KIOSK_RECORD_TYPE_SYSTEM}|${recordType}`,
    _count: 200,
    _sort: '-_lastUpdated',
  });
  return splitBasics(bundle);
}

function intakeToBasic(lead: KioskIntakeLead, existing?: Basic): Basic {
  return {
    resourceType: 'Basic',
    id: existing?.id,
    identifier: [{ system: KIOSK_RECORD_ID_SYSTEM, value: lead.id }],
    code: {
      coding: [
        {
          system: KIOSK_RECORD_TYPE_SYSTEM,
          code: KIOSK_RECORD_TYPE.intake,
          display: 'Kiosk intake',
        },
      ],
    },
    created: lead.createdAt,
    subject: lead.registeredPatientId
      ? { reference: `Patient/${lead.registeredPatientId}` }
      : undefined,
    extension: [{ url: KIOSK_PAYLOAD_URL, valueString: JSON.stringify(lead) }],
  };
}

function symptomReportToBasic(report: ReturningSymptomReport, existing?: Basic): Basic {
  return {
    resourceType: 'Basic',
    id: existing?.id,
    identifier: [{ system: KIOSK_RECORD_ID_SYSTEM, value: report.id }],
    code: {
      coding: [
        {
          system: KIOSK_RECORD_TYPE_SYSTEM,
          code: KIOSK_RECORD_TYPE.symptomReport,
          display: 'Kiosk symptom report',
        },
      ],
    },
    created: report.createdAt,
    subject: { reference: `Patient/${report.patientId}`, display: report.patientName },
    extension: [{ url: KIOSK_PAYLOAD_URL, valueString: JSON.stringify(report) }],
  };
}

export async function fhirSaveKioskIntakeLead(lead: KioskIntakeLead): Promise<void> {
  const existing = await findBasicByRecordId(lead.id);
  const body = intakeToBasic(lead, existing ?? undefined);
  if (existing?.id) {
    await fhir.update<Basic>('Basic', existing.id, body);
  } else {
    await fhir.create<Basic>('Basic', body);
  }
}

export async function fhirGetKioskIntakeLead(id: string): Promise<KioskIntakeLead | undefined> {
  const basic = await findBasicByRecordId(id);
  if (!basic) return undefined;
  return parseIntakeLead(basic);
}

/** Latest kiosk intake pathway for a registered patient (extension may be unset on legacy records). */
export async function fhirGetPatientKioskPathway(patientId: string): Promise<KioskIntakePathway | null> {
  const bundle = await fhir.search<Bundle<Basic>>('Basic', {
    subject: `Patient/${patientId}`,
    code: `${KIOSK_RECORD_TYPE_SYSTEM}|${KIOSK_RECORD_TYPE.intake}`,
    _count: 50,
    _sort: '-_lastUpdated',
  });
  for (const basic of splitBasics(bundle)) {
    const lead = parseIntakeLead(basic);
    if (lead?.pathway) return lead.pathway;
  }
  return null;
}

export async function fhirListPendingKioskIntakes(): Promise<KioskIntakeLead[]> {
  const basics = await listBasicsByRecordType(KIOSK_RECORD_TYPE.intake);
  return basics
    .map(b => parseIntakeLead(b))
    .filter((l): l is KioskIntakeLead => Boolean(l))
    .filter(l => l.status === 'pending-registration')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fhirMarkKioskIntakeRegistered(
  id: string,
  patientId: string,
): Promise<void> {
  const existing = await findBasicByRecordId(id);
  if (!existing?.id) return;
  const lead = parseIntakeLead(existing);
  if (!lead) return;
  const updated: KioskIntakeLead = {
    ...lead,
    status: 'registered',
    registeredPatientId: patientId,
  };
  await fhir.update<Basic>('Basic', existing.id, intakeToBasic(updated, existing));
}

export async function fhirSaveReturningSymptomReport(report: ReturningSymptomReport): Promise<void> {
  const existing = await findBasicByRecordId(report.id);
  const body = symptomReportToBasic(report, existing ?? undefined);
  if (existing?.id) {
    await fhir.update<Basic>('Basic', existing.id, body);
  } else {
    await fhir.create<Basic>('Basic', body);
  }
}

export async function fhirListNewReturningSymptomReports(): Promise<ReturningSymptomReport[]> {
  const basics = await listBasicsByRecordType(KIOSK_RECORD_TYPE.symptomReport);
  return basics
    .map(b => payloadFromBasic<ReturningSymptomReport>(b))
    .filter((r): r is ReturningSymptomReport => Boolean(r))
    .filter(r => r.status === 'new')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fhirAcknowledgeReturningSymptomReport(id: string): Promise<void> {
  const existing = await findBasicByRecordId(id);
  if (!existing?.id) return;
  const report = payloadFromBasic<ReturningSymptomReport>(existing);
  if (!report) return;
  const updated: ReturningSymptomReport = { ...report, status: 'acknowledged' };
  await fhir.update<Basic>('Basic', existing.id, symptomReportToBasic(updated, existing));
}
