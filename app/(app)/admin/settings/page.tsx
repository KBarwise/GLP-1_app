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
import {
  getDeploymentBackendSummary,
  probeFhirBridgeHealth,
  probeOpenFhirHealth,
} from '@/lib/ehr/deployment-info';
import { CareModulesPanel } from '@/components/care/care-modules-panel';
import { Database, PlugZap, Settings } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const fhir = getFhirServerConfigForAdmin();
  const terminology = getTerminologyConfigForAdmin();
  const jar = cookies();
  const customFhirBaseUrl = jar.get(FHIR_COOKIE.customUrl)?.value ?? '';
  const customTermEclUrl = jar.get(TERMINOLOGY_COOKIE.eclUrl)?.value ?? '';
  const customTermOpsUrl = jar.get(TERMINOLOGY_COOKIE.opsUrl)?.value ?? '';
  const backends = getDeploymentBackendSummary();
  const [fhirBridgeHealth, openFhirHealth] = backends.separateClinicalStore
    ? await Promise.all([probeFhirBridgeHealth(), probeOpenFhirHealth()])
    : [undefined, undefined];

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

      {backends.separateClinicalStore && (
        <Card className="mb-4">
          <CardTitle>Data stores (this deployment)</CardTitle>
          <p className="text-[12px] text-ink-500 mb-3">
            EHRbase serves openEHR (Swagger). Clinical FHIR goes through{' '}
            <a
              href="https://github.com/NUM-Forschungsdatenplattform/num-fhir-bridge"
              className="text-brand-600 underline"
              target="_blank"
              rel="noreferrer"
            >
              NUM FHIR Bridge
            </a>{' '}
            (<code className="text-[11px]">infra/fhir-bridge</code> · set{' '}
            <code className="text-[11px]">FHIR_BRIDGE_URL</code>).{' '}
            <a
              href="https://open-fhir.com"
              className="text-brand-600 underline"
              target="_blank"
              rel="noreferrer"
            >
              openFHIR
            </a>{' '}
            configures FHIR ↔ openEHR mappings — not the app&apos;s clinical FHIR endpoint.
          </p>
          <dl className="text-[12px] space-y-2">
            <div>
              <dt className="text-ink-500">Administrative FHIR</dt>
              <dd className="font-mono text-ink-800 break-all">{backends.adminFhirUrl || '—'}</dd>
              <dd className="text-ink-500 mt-0.5">Patient, practitioner, appointment, kiosk queues</dd>
            </div>
            <div>
              <dt className="text-ink-500">Clinical FHIR (NUM FHIR Bridge)</dt>
              <dd className="font-mono text-ink-800 break-all">{backends.clinicalFhirUrl || '—'}</dd>
              <dd className="text-ink-500 mt-0.5">
                Chart, vitals, problem list, medications, consult
                {fhirBridgeHealth === 'up' && (
                  <span className="ml-1.5 text-accent font-medium">· metadata OK</span>
                )}
                {fhirBridgeHealth === 'down' && (
                  <span className="ml-1.5 text-danger font-medium">· not reachable</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500">EHRbase openEHR (bridge backend)</dt>
              <dd className="font-mono text-ink-800 break-all">{backends.ehrbaseOpenEhrUrl || '—'}</dd>
              <dd className="text-ink-500 mt-0.5">
                Bridge env: openEHR v1 base{' '}
                <span className="font-mono text-ink-700">{backends.ehrbaseOpenEhrV1Url}</span>
              </dd>
            </div>
            <div>
              <dt className="text-ink-500">openFHIR (mapping engine)</dt>
              <dd className="font-mono text-ink-800 break-all">{backends.openFhirUrl || '—'}</dd>
              <dd className="text-ink-500 mt-0.5">
                Swagger UI · templates &amp; mappers
                {openFhirHealth === 'up' && (
                  <span className="ml-1.5 text-accent font-medium">· health UP</span>
                )}
                {openFhirHealth === 'down' && (
                  <span className="ml-1.5 text-danger font-medium">· unreachable</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      {backends.separateClinicalStore && (
        <Card className="mb-4">
          <CardTitle>Care modules (EHRbase templates)</CardTitle>
          <p className="text-[12px] text-ink-500 mb-3">
            Clinical documentation routes map to openEHR templates on EHRbase. The FHIR Bridge uses
            template extensions on written resources to select the correct composition mapper.
          </p>
          <CareModulesPanel />
        </Card>
      )}

      <Card className="mb-4">
        <CardTitle icon={<Database className="h-4 w-4" />}>Administrative FHIR server</CardTitle>
        <p className="text-[12px] text-ink-500 mb-3">
          Demographics and scheduling. Clinical chart data uses EHRbase when{' '}
          <code className="text-[11px]">CLINICAL_BACKEND=ehrbase</code>.
        </p>
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
