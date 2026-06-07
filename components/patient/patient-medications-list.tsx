'use client';

import type { MedicationRequest } from '@/lib/fhir/resources';
import { medicationQualifierSummary, medicationRequestLabel, medicationSnomedCode } from '@/lib/clinical/medications';

export function PatientMedicationsList({
  medications,
  embedded = false,
}: {
  medications: MedicationRequest[];
  embedded?: boolean;
}) {
  if (medications.length === 0) {
    return (
      <p className={embedded ? 'text-[12px] text-ink-500' : 'text-[13px] text-ink-500 py-2'}>
        No active medications on record.
      </p>
    );
  }

  return (
    <ul className={`text-[13px] space-y-2 ${embedded ? '' : ''}`}>
      {medications.map(mr => {
        const qualifiers = medicationQualifierSummary(mr);
        return (
          <li
            key={mr.id ?? medicationSnomedCode(mr) ?? medicationRequestLabel(mr)}
            className="text-ink-800 border-b border-ink-50 last:border-0 pb-2 last:pb-0"
          >
            <div>{medicationRequestLabel(mr)}</div>
            {qualifiers && <div className="text-[11px] text-ink-500 mt-0.5">{qualifiers}</div>}
          </li>
        );
      })}
    </ul>
  );
}
