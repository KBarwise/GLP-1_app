import { fhir } from './client';
import type { Bundle, Practitioner } from './resources';
import { buildPractitioner } from './builders';
import type { ClinicRole } from '@/lib/clinical/scheduling';
import type { ProviderFormData, ProviderRow } from './practitioner-types';
import { providerClinicRole } from './practitioner-types';
import { fullName } from '@/lib/utils';

export type { ProviderFormData, ProviderRow } from './practitioner-types';
export { emptyProviderForm, providerClinicRole } from './practitioner-types';

function toRow(p: Practitioner): ProviderRow | null {
  if (!p.id) return null;
  const qual = p.qualification?.[0]?.code?.text ?? p.qualification?.[0]?.code?.coding?.[0]?.display ?? 'Provider';
  return {
    id: p.id,
    name: fullName(p),
    role: qual,
    npi: p.identifier?.find(i => i.system?.includes('npi'))?.value,
    active: p.active !== false,
  };
}

export async function listPractitioners(): Promise<ProviderRow[]> {
  const bundle = await fhir.search<Bundle<Practitioner>>('Practitioner', {
    _count: 200,
    _sort: 'family',
  });
  return (bundle.entry ?? [])
    .map(e => e.resource)
    .filter((r): r is Practitioner => r?.resourceType === 'Practitioner')
    .map(toRow)
    .filter((r): r is ProviderRow => Boolean(r));
}

export async function listProvidersForClinicRole(clinicRole: ClinicRole): Promise<ProviderRow[]> {
  const all = await listPractitioners();
  return all.filter(p => p.active && providerClinicRole(p) === clinicRole);
}

export async function createPractitioner(form: ProviderFormData): Promise<Practitioner> {
  if (!form.family.trim() && !form.given.trim()) {
    throw new Error('Provider name is required');
  }
  const resource = buildPractitioner(form);
  return fhir.create<Practitioner>('Practitioner', resource);
}
