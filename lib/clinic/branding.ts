/** Product branding (shared across all clinic deployments). */
export const PRODUCT_NAME = 'Sentinel';
export const PRODUCT_VENDOR = 'Lucea Health';
export const PRODUCT_FULL_NAME = `${PRODUCT_NAME} by ${PRODUCT_VENDOR}`;

export const PRODUCT_DESCRIPTION =
  'Clinical surveillance and workflow for incretin therapy — powered by Lucea Health.';

/** Default when no clinic display name has been configured. */
export const DEFAULT_CLINIC_NAME = 'Demo Clinic';

/** Browser tab and metadata: clinic first, product second. */
export function documentTitle(clinicName: string): string {
  const clinic = clinicName.trim() || DEFAULT_CLINIC_NAME;
  return `${clinic} · ${PRODUCT_NAME}`;
}
