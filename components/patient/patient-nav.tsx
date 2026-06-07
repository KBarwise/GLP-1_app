'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useClinic } from '@/components/clinic/clinic-context';

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

  const tabs =
    role === 'nurse'
      ? [
          { href: `/patient/${patientId}`, label: 'Chart', exact: true },
          { href: `/patient/${patientId}/nurse`, label: 'Nurse documentation' },
        ]
      : [];

  if (tabs.length === 0) return null;

  return (
    <nav
      className={cn(
        'flex gap-1 border-b border-ink-100',
        embedded ? 'mt-3 mb-0' : 'mb-4',
      )}
    >
      {tabs.map(tab => {
        const exact = 'exact' in tab && tab.exact;
        const active = exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-3 py-2 text-[12px] border-b-2 -mb-px transition-colors',
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
