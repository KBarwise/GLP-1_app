export type ProviderFormData = {
  family: string;
  given: string;
  npi: string;
  role: 'doctor' | 'nurse';
  phone: string;
  email: string;
  active: boolean;
};

export type ProviderRow = {
  id: string;
  name: string;
  role: string;
  npi?: string;
  active: boolean;
};

export function emptyProviderForm(): ProviderFormData {
  return {
    family: '',
    given: '',
    npi: '',
    role: 'doctor',
    phone: '',
    email: '',
    active: true,
  };
}

/** Map provider directory row to nurse/doctor clinic role for scheduling. */
export function providerClinicRole(row: ProviderRow): 'doctor' | 'nurse' | null {
  const r = row.role.toLowerCase();
  if (r.includes('physician') || r.includes('doctor')) return 'doctor';
  if (r.includes('nurse')) return 'nurse';
  return null;
}
