'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendPatientToReceptionCheckout } from '@/app/(app)/scheduling/actions';
import { submitLabRequestModule } from '@/app/(app)/patient/[id]/care-module-actions';
import { LAB_PANELS } from '@/lib/clinical/lab-catalog';
import { inputClass, labelClass } from '@/components/clinical/form-styles';

export function LabRequestModuleForm({
  patientId,
  appointmentId,
  chartBackHref,
}: {
  patientId: string;
  appointmentId?: string;
  chartBackHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [selectedPanels, setSelectedPanels] = useState<string[]>([]);

  function togglePanel(id: string) {
    setSelectedPanels(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id],
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Enter a clinical indication for the laboratory request.');
      return;
    }
    if (selectedPanels.length === 0) {
      setError('Select at least one laboratory panel.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitLabRequestModule({
          patientId,
          appointmentId,
          reason: reason.trim(),
          labPanels: selectedPanels,
        });
        if (appointmentId) {
          await sendPatientToReceptionCheckout({ patientId, appointmentId });
        }
        router.push(chartBackHref);
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-[13px]">
      <div>
        <label className={labelClass}>Clinical indication</label>
        <input
          className={inputClass}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for laboratory testing"
        />
      </div>

      <div>
        <p className={labelClass}>Laboratory panels</p>
        <div className="space-y-2 mt-1">
          {LAB_PANELS.map(panel => (
            <label key={panel.id} className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPanels.includes(panel.id)}
                onChange={() => togglePanel(panel.id)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-ink-800">{panel.display}</span>
                <span className="block text-[11px] text-ink-500">{panel.codingDisplay}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-[12px] text-danger">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          className="text-[12px] px-3 py-1.5 rounded border border-ink-100 hover:bg-ink-50"
          onClick={() => router.push(chartBackHref)}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="text-[12px] px-3 py-1.5 rounded bg-ink-900 text-white hover:bg-ink-700 disabled:opacity-50"
        >
          {pending ? 'Submitting…' : 'Submit lab request'}
        </button>
      </div>
    </form>
  );
}
