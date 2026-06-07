'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ClinicalTrendsPanel } from '@/components/patient/clinical-trends-panel';
import { X } from 'lucide-react';

function titleForSection(section: string | null): string {
  if (!section) return 'Trends';
  if (section.includes('laboratory')) return 'Laboratory results';
  if (section.includes('anthropometric') || section.includes('measurement')) return 'Measurements';
  if (section.includes('vital')) return 'Vital signs';
  return 'Trends';
}

export function DoctorTrendsOverlay({ patientId }: { patientId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams.get('trends');

  const isOpen = Boolean(section);
  const heading = useMemo(() => titleForSection(section), [section]);

  function closeOverlay() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('trends');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40 p-2 sm:p-3">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-lg border border-ink-100 bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-100 px-3 py-2">
          <h2 className="text-sm font-medium">{heading}</h2>
          <button
            type="button"
            onClick={closeOverlay}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-100 px-2.5 py-1 text-[12px] hover:bg-ink-50"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <ClinicalTrendsPanel patientId={patientId} />
        </div>
      </div>
    </div>
  );
}
