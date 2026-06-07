'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { fetchPatientWeightProgress, logPatientWeight } from '@/app/(app)/kiosk/weight-actions';
import { lookupReturningPatient } from '@/app/(app)/kiosk/actions';
import {
  formatKg,
  formatWeightChange,
  type WeightLossSummary,
} from '@/lib/kiosk/weight-tracking';
import { KIOSK_RETURNING_NOT_FOUND } from '@/lib/kiosk/messages';
import { PatientWeightChart } from '@/components/kiosk/patient-weight-chart';
import { Scale, TrendingDown, ChevronLeft, CheckCircle2 } from 'lucide-react';

type Step = 'identify' | 'track' | 'saved';

const inputClass =
  'w-full px-4 py-3 border border-ink-100 rounded-xl bg-white text-[16px] focus:outline-none focus:ring-2 focus:ring-accent/30';
const labelClass = 'block text-[13px] text-ink-500 mb-1.5';

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: 'good' | 'neutral' | 'warn';
}) {
  const tone =
    highlight === 'good'
      ? 'border-accent/30 bg-accent-soft/40'
      : highlight === 'warn'
        ? 'border-warning/30 bg-warning-soft/40'
        : 'border-ink-100 bg-ink-50/60';
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <div className="text-[11px] uppercase tracking-wide text-ink-500 mb-1">{label}</div>
      <div className="text-xl font-medium tnum text-ink-900">{value}</div>
      {sub && <div className="text-[12px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function progressHighlight(summary: WeightLossSummary): 'good' | 'neutral' | 'warn' | undefined {
  if (summary.totalChangeKg === undefined) return undefined;
  if (summary.totalChangeKg < 0) return 'good';
  if (summary.totalChangeKg > 0) return 'warn';
  return 'neutral';
}

export function PatientWeightTracker({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('identify');
  const [given, setGiven] = useState('');
  const [family, setFamily] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [summary, setSummary] = useState<WeightLossSummary | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadProgress(identity: { given: string; family: string; birthDate: string }) {
    startTransition(async () => {
      try {
        const r = await fetchPatientWeightProgress(identity);
        setPatientId(r.patientId);
        setPatientName(r.patientName);
        setSummary(r.summary);
        setStep('track');
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function handleIdentify() {
    setError(null);
    if (!given.trim() || !family.trim() || !birthDate) {
      setError('Please enter your first name, last name, and date of birth.');
      return;
    }
    const identity = { given, family, birthDate };
    startTransition(async () => {
      const r = await lookupReturningPatient(identity);
      if ('error' in r) {
        setError(KIOSK_RETURNING_NOT_FOUND);
        return;
      }
      setPatientId(r.patientId);
      setPatientName(r.patientName);
      loadProgress(identity);
    });
  }

  function handleLogWeight(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const weightKg = parseFloat(weightInput.replace(',', '.'));
    if (Number.isNaN(weightKg)) {
      setError('Enter your weight in kilograms (e.g. 82.5).');
      return;
    }
    startTransition(async () => {
      try {
        const r = await logPatientWeight({ given, family, birthDate, weightKg });
        setSummary(r.summary);
        setWeightInput('');
        setStep('saved');
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  if (step === 'saved') {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="p-6 rounded-xl border border-accent/30 bg-accent-soft/30 text-center">
          <CheckCircle2 className="h-12 w-12 text-accent mx-auto mb-3" />
          <h3 className="text-xl font-medium mb-2">Weight recorded</h3>
          <p className="text-[15px] text-ink-700 leading-relaxed mb-4">
            Thank you, {patientName.split(' ')[0] || patientName}. Your care team can see this in your chart.
          </p>
          <button
            type="button"
            onClick={() => setStep('track')}
            className="px-4 py-2.5 text-[14px] bg-ink-900 text-white rounded-xl hover:bg-ink-700"
          >
            View progress
          </button>
        </div>
      </div>
    );
  }

  if (step === 'track' && summary) {
    const totalLabel = formatWeightChange(summary.totalChangeKg, summary.totalChangePct);
    const sinceLast =
      summary.sinceLast?.delta !== undefined
        ? formatWeightChange(summary.sinceLast.delta, summary.sinceLast.pctChange)
        : null;

    return (
      <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-ink-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Kiosk home
        </button>

        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent mb-2">
            <Scale className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-medium">Weight progress</h2>
          <p className="text-[14px] text-ink-500">{patientName}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SummaryCard
            label="Current weight"
            value={summary.currentKg !== undefined ? `${formatKg(summary.currentKg)} kg` : '—'}
            sub={summary.sinceLast?.date ? `as of ${summary.sinceLast.date}` : undefined}
          />
          <SummaryCard
            label="Total change"
            value={summary.entryCount > 1 ? totalLabel : 'Log again to track'}
            sub={
              summary.startingKg !== undefined
                ? `from ${formatKg(summary.startingKg)} kg`
                : undefined
            }
            highlight={progressHighlight(summary)}
          />
        </div>

        {sinceLast && summary.entryCount > 1 && (
          <p className="text-[12px] text-ink-500 text-center flex items-center justify-center gap-1">
            <TrendingDown className="h-3.5 w-3.5" />
            Since your last entry: {sinceLast}
          </p>
        )}

        {summary.entryCount >= 2 && patientId && (
          <div className="rounded-xl border border-ink-100 bg-white p-3">
            <h3 className="text-[12px] font-medium text-ink-600 mb-2">Your trend</h3>
            <PatientWeightChart patientId={patientId} />
          </div>
        )}

        <form onSubmit={handleLogWeight} className="rounded-xl border border-ink-100 bg-white p-4 space-y-3">
          <h3 className="text-[14px] font-medium">Log today&apos;s weight</h3>
          <div>
            <label className={labelClass} htmlFor="weight-kg">
              Weight (kg)
            </label>
            <input
              id="weight-kg"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={25}
              max={400}
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              placeholder="e.g. 82.5"
              className={inputClass}
              required
            />
          </div>
          {error && (
            <p className="text-[13px] text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 text-[15px] font-medium bg-ink-900 text-white rounded-xl hover:bg-ink-700 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save weight'}
          </button>
        </form>

        {summary.entries.length > 0 && (
          <div className="rounded-xl border border-ink-100 bg-white p-4">
            <h3 className="text-[12px] font-medium text-ink-600 mb-2">Recent entries</h3>
            <ul className="divide-y divide-ink-50 text-[13px]">
              {summary.entries.slice(0, 8).map(entry => (
                <li key={`${entry.date}-${entry.valueKg}`} className="flex justify-between py-2 tnum">
                  <span className="text-ink-500">
                    {entry.date ? format(new Date(entry.date), 'MMM d, yyyy') : '—'}
                  </span>
                  <span className="font-medium text-ink-900">{formatKg(entry.valueKg)} kg</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-ink-800 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="text-center mb-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent mb-3">
          <Scale className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-medium mb-2">Track your weight</h2>
        <p className="text-[15px] text-ink-500">
          Sign in with your name and date of birth to log weight and see your progress.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="given">
            First name
          </label>
          <input
            id="given"
            value={given}
            onChange={e => setGiven(e.target.value)}
            className={inputClass}
            autoComplete="given-name"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="family">
            Last name
          </label>
          <input
            id="family"
            value={family}
            onChange={e => setFamily(e.target.value)}
            className={inputClass}
            autoComplete="family-name"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="birthDate">
            Date of birth
          </label>
          <input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="text-[13px] text-danger mt-3" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={handleIdentify}
        className="w-full mt-5 py-3.5 text-[15px] font-medium bg-ink-900 text-white rounded-xl hover:bg-ink-700 disabled:opacity-50"
      >
        {pending ? 'Looking up your record…' : 'Continue'}
      </button>
    </div>
  );
}
