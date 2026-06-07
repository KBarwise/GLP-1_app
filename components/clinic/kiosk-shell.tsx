'use client';

import { useClinic } from './clinic-context';
import { RoleAccessGate } from './role-access-gate';
import { RoleSwitcher } from './role-switcher';
import { ShieldHalf } from 'lucide-react';

export function KioskShell({ children }: { children: React.ReactNode }) {
  const { clinicName, productSubtitle } = useClinic();

  return (
    <div className="h-screen min-h-screen bg-ink-50 flex flex-col overflow-hidden">
      <header className="shrink-0 z-10 bg-white border-b border-ink-100 px-6 py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <ShieldHalf className="h-8 w-8 text-accent shrink-0" />
          <div>
            <h1 className="text-lg font-medium">{clinicName}</h1>
            <p className="text-sm text-ink-500">{productSubtitle} · Pre-screening kiosk</p>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <RoleAccessGate>{children}</RoleAccessGate>
      </main>

      <footer className="shrink-0 bg-white border-t border-ink-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <p className="text-[12px] text-ink-500">
            This kiosk is for pre-screening and symptom reporting only. It does not prescribe
            medication.
          </p>
          <div className="w-full sm:w-48 shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-ink-500 mb-1">Staff</p>
            <RoleSwitcher />
          </div>
        </div>
      </footer>
    </div>
  );
}
