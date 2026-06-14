import { getCareModule, type CareModuleId } from '@/lib/ehr/care-modules';

export function CareModuleBadge({ moduleId }: { moduleId: CareModuleId }) {
  const mod = getCareModule(moduleId);
  return (
    <div className="rounded-md border border-brand-100 bg-brand-50/60 px-3 py-2 text-[12px] text-ink-700 mb-4">
      <span className="font-medium text-ink-900">{mod.label}</span>
      <span className="text-ink-500"> · EHRbase template </span>
      <code className="font-mono text-[11px] text-brand-700">{mod.templateId}</code>
    </div>
  );
}
