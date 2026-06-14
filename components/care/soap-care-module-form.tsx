'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  sendPatientToReceptionCheckout,
} from '@/app/(app)/scheduling/actions';
import { submitSoapCareModule } from '@/app/(app)/patient/[id]/care-module-actions';
import { getCareModule, type CareModuleId } from '@/lib/ehr/care-modules';
import { inputClass, labelClass } from '@/components/clinical/form-styles';

export function SoapCareModuleForm({
  patientId,
  careModuleId,
  appointmentId,
  chartBackHref,
  showGestationalAge = false,
}: {
  patientId: string;
  careModuleId: CareModuleId;
  appointmentId?: string;
  chartBackHref: string;
  showGestationalAge?: boolean;
}) {
  const mod = getCareModule(careModuleId);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [gestationalWeeks, setGestationalWeeks] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Enter a reason for visit or chief complaint.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitSoapCareModule({
          patientId,
          careModuleId,
          appointmentId,
          reason: reason.trim(),
          subjective: subjective.trim() || undefined,
          objective: objective.trim() || undefined,
          assessment: assessment.trim() || undefined,
          plan: plan.trim() || undefined,
          gestationalWeeks: gestationalWeeks.trim() || undefined,
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
      <p className="text-[12px] text-ink-500">{mod.description}</p>

      <div>
        <label className={labelClass}>Reason for visit / chief complaint</label>
        <input
          className={inputClass}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. routine antenatal visit"
        />
      </div>

      {showGestationalAge && (
        <div>
          <label className={labelClass}>Gestational age (weeks)</label>
          <input
            className={inputClass}
            type="number"
            min={1}
            max={45}
            value={gestationalWeeks}
            onChange={e => setGestationalWeeks(e.target.value)}
            placeholder="e.g. 28"
          />
        </div>
      )}

      <div>
        <label className={labelClass}>Subjective</label>
        <textarea
          className={`${inputClass} min-h-[80px]`}
          value={subjective}
          onChange={e => setSubjective(e.target.value)}
          placeholder="Patient history, symptoms, concerns"
        />
      </div>

      <div>
        <label className={labelClass}>Objective</label>
        <textarea
          className={`${inputClass} min-h-[80px]`}
          value={objective}
          onChange={e => setObjective(e.target.value)}
          placeholder="Examination findings, vitals review"
        />
      </div>

      <div>
        <label className={labelClass}>Assessment</label>
        <textarea
          className={`${inputClass} min-h-[64px]`}
          value={assessment}
          onChange={e => setAssessment(e.target.value)}
          placeholder="Clinical impression"
        />
      </div>

      <div>
        <label className={labelClass}>Plan</label>
        <textarea
          className={`${inputClass} min-h-[64px]`}
          value={plan}
          onChange={e => setPlan(e.target.value)}
          placeholder="Follow-up, referrals, patient advice"
        />
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
          {pending ? 'Saving…' : 'Complete documentation'}
        </button>
      </div>
    </form>
  );
}
