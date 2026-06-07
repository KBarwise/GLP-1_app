import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { Card, CardTitle } from '@/components/ui/primitives';
import { ClinicSettingsForm } from './clinic-settings-form';
import { FhirServerForm } from './fhir-server-form';
import { TerminologySettingsForm } from './terminology-settings-form';
import { TerminologyBindingsPreview } from './terminology-bindings-preview';
import { getFhirServerConfigForAdmin } from '@/lib/fhir/config';
import { getTerminologyConfigForAdmin } from '@/lib/terminology/config';
import { FHIR_COOKIE } from '@/lib/fhir/servers';
import { TERMINOLOGY_COOKIE } from '@/lib/terminology/servers';
import { PRODUCT_FULL_NAME } from '@/lib/clinic/branding';
import { Database, PlugZap, Settings } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AdminSettingsPage() {
  const fhir = getFhirServerConfigForAdmin();
  const terminology = getTerminologyConfigForAdmin();
  const jar = cookies();
  const customFhirBaseUrl = jar.get(FHIR_COOKIE.customUrl)?.value ?? '';
  const customTermEclUrl = jar.get(TERMINOLOGY_COOKIE.eclUrl)?.value ?? '';
  const customTermOpsUrl = jar.get(TERMINOLOGY_COOKIE.opsUrl)?.value ?? '';

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-medium mb-1">Clinic Settings</h1>
      <p className="text-sm text-ink-500 mb-4">
        Configure this clinic&apos;s display name and clinical data connections. The product is{' '}
        <strong className="font-medium text-ink-700">{PRODUCT_FULL_NAME}</strong> — shared across
        all deployments; each site sets its own clinic name below.
      </p>

      <Card className="mb-4">
        <CardTitle icon={<Settings className="h-4 w-4" />}>Clinic branding</CardTitle>
        <p className="text-[12px] text-ink-500 mb-3">
          Shown in the sidebar, kiosk header, and browser tab (with Sentinel). Patient and clinical
          data remain tied to your FHIR server — not the display name.
        </p>
        <ClinicSettingsForm />
      </Card>

      <Card className="mb-4">
        <CardTitle icon={<Database className="h-4 w-4" />}>FHIR server</CardTitle>
        <FhirServerForm
          initial={{
            presetId: fhir.presetId,
            baseUrl: fhir.baseUrl,
            label: fhir.label,
            hasBearerToken: fhir.hasBearerToken,
            customBaseUrl: customFhirBaseUrl,
          }}
        />
      </Card>

      <Card className="mb-4" id="terminology">
        <CardTitle icon={<PlugZap className="h-4 w-4" />}>Terminology</CardTitle>
        <p className="text-[12px] text-ink-500 mb-4">
          Snowstorm (or compatible) FHIR terminology — separate URLs for ECL expansion and
          validate/lookup. Value set bindings below use the active endpoints.
        </p>
        <TerminologySettingsForm
          initial={{
            presetId: terminology.presetId,
            label: terminology.label,
            eclBaseUrl: terminology.eclBaseUrl,
            opsBaseUrl: terminology.opsBaseUrl,
            hasAuthHeader: terminology.hasAuthHeader,
            customEclUrl: customTermEclUrl,
            customOpsUrl: customTermOpsUrl,
          }}
        />
        <div className="mt-6 pt-6 border-t border-ink-100">
          <h3 className="text-sm font-medium mb-3">Value set bindings</h3>
          <Suspense
            fallback={
              <p className="text-[12px] text-ink-500">Loading terminology expansions…</p>
            }
          >
            <TerminologyBindingsPreview />
          </Suspense>
        </div>
      </Card>

      <Card>
        <CardTitle>Role overview</CardTitle>
        <ul className="text-[13px] text-ink-700 space-y-2 list-disc pl-4">
          <li><strong>Reception</strong> — register/edit patients, book appointments, check-in, checkout</li>
          <li><strong>Nurse</strong> — vitals, anthropometrics, POC tests, nursing notes → doctor</li>
          <li><strong>Doctor</strong> — review nurse data, consult note, send to nurse or reception</li>
          <li><strong>Patient (kiosk)</strong> — identify by name/MRN and view pre-screening results only</li>
          <li><strong>Admin</strong> — this settings page (including terminology) and provider registry</li>
        </ul>
      </Card>
    </div>
  );
}
