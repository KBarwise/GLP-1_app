'use client';

import { labelClass } from '@/components/clinical/form-styles';
import {
  ACTIVE_MEDICATION_CHANGE_OPTIONS,
  type MedicationChangeType,
} from '@/lib/clinical/medication-qualifiers';
import {
  medicationQualifierSummary,
  medicationRequestLabel,
  medicationSnomedCode,
} from '@/lib/clinical/medications';
import type { MedicationRequest } from '@/lib/fhir/resources';

export function ActiveMedicationsPanel({
  medications,
  discontinuations,
  onDiscontinuationsChange,
}: {
  medications: MedicationRequest[];
  discontinuations: string[];
  onDiscontinuationsChange: (codes: string[]) => void;
}) {
  if (medications.length === 0) return null;

  const discontinued = new Set(discontinuations);

  function setDiscontinued(code: string, stop: boolean) {
    const next = new Set(discontinuations);
    if (stop) next.add(code);
    else next.delete(code);
    onDiscontinuationsChange([...next]);
  }

  return (
    <section className="border border-ink-100 rounded-lg p-4 bg-white space-y-3">
      <div>
        <h3 className="text-sm font-medium">Active medications</h3>
        <p className="text-[12px] text-ink-500 mt-1">
          Mark medicines to discontinue when you complete this visit. Discontinued orders are set to
          stopped in FHIR; continuing medicines stay active.
        </p>
      </div>
      <ul className="space-y-3">
        {medications.map(mr => {
          const code = medicationSnomedCode(mr);
          if (!code) return null;
          const qualifiers = medicationQualifierSummary(mr);
          const isStopped = discontinued.has(code);
          return (
            <li key={mr.id ?? code} className="rounded-md border border-ink-100 p-3 bg-ink-50/40">
              <div className="font-medium text-[13px]">{medicationRequestLabel(mr)}</div>
              {qualifiers && <div className="text-[11px] text-ink-500 mt-0.5">{qualifiers}</div>}
              <div className="mt-2">
                <label className={labelClass}>Action</label>
                <select
                  className="w-full px-3 py-2 border border-ink-100 rounded-md text-[13px] bg-white"
                  value={isStopped ? 'stop' : 'continue'}
                  onChange={e =>
                    setDiscontinued(code, (e.target.value as MedicationChangeType) === 'stop')
                  }
                >
                  {ACTIVE_MEDICATION_CHANGE_OPTIONS.filter(o => o.value !== 'change' && o.value !== 'refill').map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
