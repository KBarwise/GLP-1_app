import { CARE_MODULE_LIST } from '@/lib/ehr/care-modules';

export function CareModulesPanel() {
  return (
    <dl className="text-[12px] space-y-3">
      {CARE_MODULE_LIST.map(mod => (
        <div key={mod.id} className="border-b border-ink-100 pb-3 last:border-b-0 last:pb-0">
          <dt className="font-medium text-ink-800">{mod.label}</dt>
          <dd className="text-ink-500 mt-0.5">{mod.description}</dd>
          <dd className="font-mono text-[11px] text-brand-700 mt-1 break-all">{mod.templateId}</dd>
          <dd className="text-ink-500 mt-0.5">
            Roles: {mod.roles.join(', ')} · Route:{' '}
            <span className="font-mono text-ink-700">/patient/…/care/{mod.id}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
