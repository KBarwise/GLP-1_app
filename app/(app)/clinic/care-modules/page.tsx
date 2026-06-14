import { Card, CardTitle } from '@/components/ui/primitives';
import { CareModulePatientSearch } from '@/components/care/care-module-patient-search';
import { careModulesForRole } from '@/lib/ehr/care-modules';
import { getActingRoleFromCookie } from '@/lib/clinic/server-role';
import { canViewClinicalData } from '@/lib/clinic/access';
import { redirect } from 'next/navigation';
import { ClipboardList } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function CareModulesPage() {
  const role = getActingRoleFromCookie();
  if (!canViewClinicalData(role)) {
    redirect('/');
  }

  const modules = careModulesForRole(role);

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-medium mb-1">Care modules</h1>
      <p className="text-sm text-ink-500 mb-4">
        Open clinical documentation for a patient. Each module maps to an EHRbase openEHR template.
        You can also reach modules from a patient&apos;s chart tabs after searching in the sidebar,
        or by booking the matching visit type at reception.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map(mod => (
          <Card key={mod.id}>
            <CardTitle icon={<ClipboardList className="h-4 w-4" />}>{mod.label}</CardTitle>
            <p className="text-[12px] text-ink-500 mb-3">{mod.description}</p>
            <p className="text-[11px] font-mono text-brand-700 mb-3 break-all">{mod.templateId}</p>
            <CareModulePatientSearch moduleId={mod.id} />
          </Card>
        ))}
      </div>
    </div>
  );
}
