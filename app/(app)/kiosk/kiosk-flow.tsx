'use client';

import { useState, useTransition } from 'react';
import { confirmKioskFailChoice, submitKioskScreening } from './actions';
import { KIOSK_SCREENING_CONDITIONS } from '@/lib/kiosk/screening-conditions';
import type { KioskDemographics } from '@/lib/kiosk/intake-types';
import { PrivacyNotice } from '@/components/kiosk/privacy-notice';
import { CheckCircle2, AlertOctagon, UserRound } from 'lucide-react';
import {
  firstContactError,
  hasContactErrors,
  validateContactFields,
  type ContactFieldErrors,
} from '@/lib/validation/contact';
import {
  KIOSK_FAIL_CHOICE_DISCARD,
  KIOSK_FAIL_CHOICE_RECEPTION,
  KIOSK_FAIL_DISCARD_THANK_YOU,
  KIOSK_FAIL_MESSAGE,
  KIOSK_FAIL_RECEPTION_THANK_YOU,
  KIOSK_PASS_THANK_YOU,
  KIOSK_THANK_YOU_HEADLINE,
} from '@/lib/kiosk/messages';

type Step = 'demographics' | 'consent' | 'screening' | 'result';

const inputClass =
  'w-full px-4 py-3 border border-ink-100 rounded-xl bg-white text-[16px] focus:outline-none focus:ring-2 focus:ring-accent/30';
const labelClass = 'block text-[13px] text-ink-500 mb-1.5';

export function KioskFlow({ onBack }: { onBack?: () => void } = {}) {
  const [step, setStep] = useState<Step>('demographics');
  const [demographics, setDemographics] = useState<KioskDemographics>({
    given: '',
    family: '',
    age: 0,
    gender: 'unknown',
    phone: '',
    email: '',
  });
  const [consented, setConsented] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [contactErrors, setContactErrors] = useState<ContactFieldErrors>({});
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    passed: boolean;
    overall: string;
    summary: string;
    items: { label: string; level: string; reason: string }[];
  } | null>(null);
  const [failChoice, setFailChoice] = useState<'reception' | 'discard' | null>(null);

  const stepIndex = ['demographics', 'consent', 'screening', 'result'].indexOf(step);

  function updateDemo<K extends keyof KioskDemographics>(key: K, value: KioskDemographics[K]) {
    setDemographics(prev => ({ ...prev, [key]: value }));
    setError(null);
    if (key === 'phone') {
      setContactErrors(prev => {
        if (!prev.phone) return prev;
        const { phone, ...rest } = prev;
        void phone;
        return rest;
      });
    } else if (key === 'email') {
      setContactErrors(prev => {
        if (!prev.email) return prev;
        const { email, ...rest } = prev;
        void email;
        return rest;
      });
    }
  }

  function toggleCondition(code: string) {
    setSelectedCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code],
    );
  }

  function validateDemographics(): string | null {
    if (!demographics.given.trim() || !demographics.family.trim()) {
      return 'Please enter your first and last name.';
    }
    if (!demographics.age || demographics.age < 1 || demographics.age > 120) {
      return 'Please enter a valid age (1–120).';
    }
    const contact = validateContactFields(demographics.phone, demographics.email, {
      requireOne: true,
    });
    if (hasContactErrors(contact)) {
      setContactErrors(contact);
      return firstContactError(contact);
    }
    setContactErrors({});
    return null;
  }

  function goNext() {
    setError(null);
    if (step === 'demographics') {
      const err = validateDemographics();
      if (err) {
        setError(err);
        return;
      }
      setStep('consent');
      return;
    }
    if (step === 'consent') {
      if (!consented) {
        setError('Please read the notice and check the box to continue.');
        return;
      }
      setStep('screening');
      return;
    }
    if (step === 'screening') {
      startTransition(async () => {
        try {
          const conditions = KIOSK_SCREENING_CONDITIONS.filter(c =>
            selectedCodes.includes(c.code),
          ).map(c => ({ code: c.code, display: c.display }));

          const r = await submitKioskScreening({
            demographics: { ...demographics, age: Number(demographics.age) },
            conditions,
            consented: true,
          });
          setResult(r);
          setStep('result');
        } catch (e) {
          setError((e as Error).message);
        }
      });
    }
  }

  function goBack() {
    setError(null);
    if (step === 'demographics') {
      onBack?.();
      return;
    }
    if (step === 'consent') setStep('demographics');
    else if (step === 'screening') setStep('consent');
  }

  function handleFailChoice(choice: 'reception-diet-exercise' | 'discard') {
    setError(null);
    const conditions = KIOSK_SCREENING_CONDITIONS.filter(c =>
      selectedCodes.includes(c.code),
    ).map(c => ({ code: c.code, display: c.display }));
    startTransition(async () => {
      try {
        await confirmKioskFailChoice({
          demographics: { ...demographics, age: Number(demographics.age) },
          conditions,
          screeningItems: result?.items,
          choice,
        });
        setFailChoice(choice === 'reception-diet-exercise' ? 'reception' : 'discard');
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-info-soft text-info mb-3">
          <UserRound className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-medium mb-2">GLP-1 Pre-screening</h2>
        {step !== 'result' && (
          <p className="text-[15px] text-ink-500">
            Step {stepIndex + 1} of 3 —{' '}
            {step === 'demographics'
              ? 'Your details'
              : step === 'consent'
                ? 'Privacy & consent'
                : 'Safety check'}
          </p>
        )}
      </div>

      {step === 'demographics' && (
        <div className="space-y-4 bg-white border border-ink-100 rounded-xl p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>First name</label>
              <input
                className={inputClass}
                value={demographics.given}
                onChange={e => updateDemo('given', e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className={labelClass}>Last name</label>
              <input
                className={inputClass}
                value={demographics.family}
                onChange={e => updateDemo('family', e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Age</label>
              <input
                type="number"
                min={1}
                max={120}
                className={inputClass}
                value={demographics.age || ''}
                onChange={e => updateDemo('age', parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div>
              <label className={labelClass}>Sex</label>
              <select
                className={inputClass}
                value={demographics.gender}
                onChange={e =>
                  updateDemo('gender', e.target.value as KioskDemographics['gender'])
                }
              >
                <option value="unknown">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="kiosk-phone">
              Phone
            </label>
            <input
              id="kiosk-phone"
              type="tel"
              className={`${inputClass}${contactErrors.phone ? ' border-red-400' : ''}`}
              value={demographics.phone}
              onChange={e => updateDemo('phone', e.target.value)}
              autoComplete="tel"
              placeholder="e.g. (555) 555-0100"
              aria-invalid={Boolean(contactErrors.phone)}
            />
            {contactErrors.phone && (
              <p className="text-[13px] text-red-600 mt-1">{contactErrors.phone}</p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="kiosk-email">
              Email
            </label>
            <input
              id="kiosk-email"
              type="email"
              className={`${inputClass}${contactErrors.email ? ' border-red-400' : ''}`}
              value={demographics.email}
              onChange={e => updateDemo('email', e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(contactErrors.email)}
            />
            {contactErrors.email && (
              <p className="text-[13px] text-red-600 mt-1">{contactErrors.email}</p>
            )}
          </div>
          {contactErrors.form && !contactErrors.phone && !contactErrors.email && (
            <p className="text-[13px] text-red-600">{contactErrors.form}</p>
          )}
        </div>
      )}

      {step === 'consent' && (
        <div className="space-y-4">
          <PrivacyNotice />
          <label className="flex items-start gap-3 p-4 bg-white border border-ink-100 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={consented}
              onChange={e => {
                setConsented(e.target.checked);
                setError(null);
              }}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span className="text-[14px] text-ink-700 leading-snug">
              I have read the privacy notice and consent to the collection and use of my
              information as described above.
            </span>
          </label>
        </div>
      )}

      {step === 'screening' && (
        <div className="space-y-3 bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-[14px] text-ink-700 leading-relaxed">
            Tap <strong>Yes</strong> for any question that applies to you. Tap again to change your
            answer. If none apply, continue without selecting any.
          </p>
          <ul className="space-y-2">
            {KIOSK_SCREENING_CONDITIONS.map(c => {
              const selected = selectedCodes.includes(c.code);
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => toggleCondition(c.code)}
                    className={`w-full text-left px-4 py-3 rounded-lg text-[14px] border transition-colors ${
                      selected
                        ? 'bg-accent-soft text-accent border-accent/40'
                        : 'bg-ink-50 border-ink-100 hover:border-ink-200 text-ink-800'
                    }`}
                  >
                    <span className="font-medium block mb-0.5">{selected ? 'Yes — ' : ''}{c.question}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-4">
          <div
            className={`p-6 rounded-xl border text-center ${
              result.passed
                ? 'bg-accent-soft border-accent/30'
                : 'bg-danger-soft border-danger/30'
            }`}
          >
            {result.passed ? (
              <CheckCircle2 className="h-12 w-12 text-accent mx-auto mb-3" />
            ) : (
              <AlertOctagon className="h-12 w-12 text-danger mx-auto mb-3" />
            )}
            <h3 className="text-xl font-medium mb-2">
              {result.passed || failChoice !== null
                ? KIOSK_THANK_YOU_HEADLINE
                : result.summary}
            </h3>
            {result.passed ? (
              <p className="text-[15px] text-ink-700">{KIOSK_PASS_THANK_YOU}</p>
            ) : failChoice === 'reception' ? (
              <p className="text-[15px] text-ink-700">{KIOSK_FAIL_RECEPTION_THANK_YOU}</p>
            ) : failChoice === 'discard' ? (
              <p className="text-[15px] text-ink-700">{KIOSK_FAIL_DISCARD_THANK_YOU}</p>
            ) : (
              <>
                <p className="text-[15px] text-ink-700 leading-relaxed whitespace-pre-line text-left mb-4">
                  {KIOSK_FAIL_MESSAGE}
                </p>
                <p className="text-[13px] text-ink-500 mb-3">What would you like to do?</p>
                <div className="flex flex-col gap-3 text-left">
                  <button
                    type="button"
                    onClick={() => handleFailChoice('reception-diet-exercise')}
                    disabled={pending}
                    className="w-full px-4 py-3 text-[14px] bg-ink-900 text-white rounded-xl hover:bg-ink-700 disabled:opacity-50"
                  >
                    {pending ? 'Please wait…' : KIOSK_FAIL_CHOICE_RECEPTION}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFailChoice('discard')}
                    disabled={pending}
                    className="w-full px-4 py-3 text-[14px] border border-ink-200 rounded-xl bg-white hover:bg-ink-50 disabled:opacity-50"
                  >
                    {KIOSK_FAIL_CHOICE_DISCARD}
                  </button>
                </div>
              </>
            )}
          </div>

          {result.items.length > 0 && (
            <div className="bg-white border border-ink-100 rounded-xl p-4 text-[13px]">
              <p className="font-medium mb-2">Items reviewed</p>
              <ul className="space-y-2">
                {result.items.map(item => (
                  <li key={item.label} className="text-ink-600">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-ink-400 mx-1">·</span>
                    {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-[14px] text-danger mt-4 text-center" role="alert">
          {error}
        </p>
      )}

      {step !== 'result' && (
        <div className="flex justify-between gap-3 mt-6">
          <button
            type="button"
            onClick={goBack}
            disabled={pending}
            className="px-5 py-3 text-[14px] border border-ink-100 rounded-xl bg-white disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={pending}
            className="px-6 py-3 text-[14px] bg-ink-900 text-white rounded-xl hover:bg-ink-700 disabled:opacity-50"
          >
            {pending ? 'Checking…' : step === 'screening' ? 'Submit' : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
}
