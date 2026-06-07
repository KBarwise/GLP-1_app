import { listPractitioners } from '@/lib/fhir/practitioners';
import { ProviderDirectory } from './provider-directory';

export const dynamic = 'force-dynamic';

export default async function AdminProvidersPage() {
  let providers: Awaited<ReturnType<typeof listPractitioners>> = [];
  let error: string | null = null;
  try {
    providers = await listPractitioners();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-medium mb-1">Provider Registry</h1>
      <p className="text-sm text-ink-500 mb-4">
        Register clinicians and clinic staff as FHIR Practitioner resources for attribution and future scheduling.
      </p>
      {error && <p className="text-[13px] text-danger mb-4">{error}</p>}
      <ProviderDirectory initial={providers} />
    </div>
  );
}
