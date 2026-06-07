'use client';

import { useState } from 'react';
import { ClipboardList, Scale, UserPlus, UserRound } from 'lucide-react';
import Link from 'next/link';
import { KioskFlow } from './kiosk-flow';
import { KioskReturningFlow } from './kiosk-returning-flow';

type Mode = 'home' | 'new' | 'returning';

export function KioskHome() {
  const [mode, setMode] = useState<Mode>('home');

  if (mode === 'new') {
    return <KioskFlow onBack={() => setMode('home')} />;
  }

  if (mode === 'returning') {
    return <KioskReturningFlow onBack={() => setMode('home')} />;
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-info-soft text-info mb-3">
          <UserRound className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-medium mb-2">Welcome</h2>
        <p className="text-[15px] text-ink-500">How can we help you today?</p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setMode('new')}
          className="w-full text-left p-5 bg-white border border-ink-100 rounded-xl hover:border-ink-200 transition-colors"
        >
          <div className="flex items-start gap-4">
            <UserPlus className="h-6 w-6 text-accent shrink-0 mt-0.5" />
            <div>
              <div className="text-[16px] font-medium mb-1">I am new here</div>
              <p className="text-[14px] text-ink-500 leading-snug">
                GLP-1 therapy pre-screening for first-time visitors.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMode('returning')}
          className="w-full text-left p-5 bg-white border border-ink-100 rounded-xl hover:border-ink-200 transition-colors"
        >
          <div className="flex items-start gap-4">
            <ClipboardList className="h-6 w-6 text-info shrink-0 mt-0.5" />
            <div>
              <div className="text-[16px] font-medium mb-1">I am already a patient</div>
              <p className="text-[14px] text-ink-500 leading-snug">
                Sign in with your name and date of birth to report how you are feeling today.
              </p>
            </div>
          </div>
        </button>

        <Link
          href="/kiosk/track-weight"
          className="block w-full text-left p-5 bg-white border border-ink-100 rounded-xl hover:border-ink-200 transition-colors"
        >
          <div className="flex items-start gap-4">
            <Scale className="h-6 w-6 text-accent shrink-0 mt-0.5" />
            <div>
              <div className="text-[16px] font-medium mb-1">Track my weight</div>
              <p className="text-[14px] text-ink-500 leading-snug">
                Log your weight at home or in clinic and see your progress over time.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
