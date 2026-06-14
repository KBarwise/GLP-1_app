'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useClinic } from '@/components/clinic/clinic-context';
import {
  careModulePatientHref,
  careModulesForRole,
  type CareModuleId,
} from '@/lib/ehr/care-modules';

function moduleTabHref(patientId: string, moduleId: CareModuleId): string {
  return careModulePatientHref(patientId, moduleId);
}

function isModuleTabActive(pathname: string, href: string): boolean {
  const base = href.split('?')[0] ?? href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function PatientNav({
  patientId,
  embedded = false,
}: {
  patientId: string;
  /** When true, sits inside sticky patient chrome (no extra bottom margin). */
  embedded?: boolean;
}) {
  const pathname = usePathname();
  const { role } = useClinic();

  const modules = careModulesForRole(role);
  if (modules.length === 0) return null;

  const tabs = modules.map(mod => ({
    href: moduleTabHref(patientId, mod.id),
    label: mod.shortLabel,
  }));

  return (
    <nav
      className={cn(
        'flex gap-1 border-b border-ink-100 overflow-x-auto',
        embedded ? 'mt-3 mb-0' : 'mb-4',
      )}
    >
      {tabs.map(tab => {
        const active = isModuleTabActive(pathname, tab.href.split('?')[0] ?? tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-3 py-2 text-[12px] border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0',
              active
                ? 'border-ink-900 text-ink-900 font-medium'
                : 'border-transparent text-ink-500 hover:text-ink-700',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
