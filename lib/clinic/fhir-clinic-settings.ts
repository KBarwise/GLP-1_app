import { fhir } from '@/lib/fhir/client';
import type { Basic, Bundle } from '@/lib/fhir/resources';
import { DEFAULT_CLINIC_NAME } from './roles';

const CLINIC_SETTING_SYSTEM = 'http://glp1-monitor.local/clinic-setting';
const CLINIC_SETTING_ID_SYSTEM = 'http://glp1-monitor.local/clinic-setting/id';
const CLINIC_SETTING_RECORD_ID = 'global';
const CLINIC_NAME_CODE = 'clinic-name';
const CLINIC_NAME_EXTENSION_URL = 'http://glp1-monitor.local/fhir/StructureDefinition/clinic-name';

function splitBasics(bundle: Bundle<Basic>): Basic[] {
  return (bundle.entry ?? [])
    .map(e => e.resource)
    .filter((r): r is Basic => r?.resourceType === 'Basic');
}

function clinicNameFromBasic(basic: Basic): string | null {
  const raw = basic.extension?.find(e => e.url === CLINIC_NAME_EXTENSION_URL)?.valueString;
  const trimmed = raw?.trim();
  return trimmed || null;
}

function clinicNameToBasic(name: string, existing?: Basic): Basic {
  const otherExtensions = (existing?.extension ?? []).filter(e => e.url !== CLINIC_NAME_EXTENSION_URL);
  return {
    resourceType: 'Basic',
    id: existing?.id,
    identifier: [{ system: CLINIC_SETTING_ID_SYSTEM, value: CLINIC_SETTING_RECORD_ID }],
    code: {
      coding: [{
        system: CLINIC_SETTING_SYSTEM,
        code: CLINIC_NAME_CODE,
        display: 'Clinic display name',
      }],
    },
    created: existing?.created ?? new Date().toISOString(),
    extension: [
      ...otherExtensions,
      { url: CLINIC_NAME_EXTENSION_URL, valueString: name },
    ],
  };
}

async function findClinicNameBasic(): Promise<Basic | null> {
  const bundle = await fhir.search<Bundle<Basic>>('Basic', {
    identifier: `${CLINIC_SETTING_ID_SYSTEM}|${CLINIC_SETTING_RECORD_ID}`,
    code: `${CLINIC_SETTING_SYSTEM}|${CLINIC_NAME_CODE}`,
    _count: 1,
  });
  return splitBasics(bundle)[0] ?? null;
}

export async function getClinicNameFromFhir(): Promise<string | null> {
  try {
    const record = await findClinicNameBasic();
    if (!record) return null;
    return clinicNameFromBasic(record);
  } catch {
    return null;
  }
}

export async function saveClinicNameToFhir(name: string): Promise<string> {
  const trimmed = name.trim() || DEFAULT_CLINIC_NAME;
  const existing = await findClinicNameBasic();
  const body = clinicNameToBasic(trimmed, existing ?? undefined);
  if (existing?.id) {
    await fhir.update<Basic>('Basic', existing.id, body);
  } else {
    await fhir.create<Basic>('Basic', body);
  }
  return trimmed;
}
