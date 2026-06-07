'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FHIR_COOKIE } from '@/lib/fhir/servers';
import { ChevronLeft, Menu, ShieldHalf } from 'lucide-react';
import { PatientSearch } from '@/components/patient-search';
import { RoleSwitcher } from './role-switcher';
import { useClinic } from './clinic-context';
import { NAV_BY_ROLE } from '@/lib/clinic/nav';
import { canSearchPatients } from '@/lib/clinic/access';
import { readSidebarCollapsed, writeSidebarCollapsed } from '@/lib/clinic/sidebar-storage';
import { KioskShell } from './kiosk-shell';
import { RoleAccessGate } from './role-access-gate';

const ICONS: Record<string, string> = {
  '/patients': '◉',
  '/register': '＋',
  '/reception': '⌁',
  '/reception/book': '◷',
  '/clinic/nurse': '✚',
  '/clinic/doctor': '◎',
  '/clinic/doctor/risk': '⚠',
  '/admin/settings': '⚙',
  '/admin/providers': '👤',
  '/mdm': '⇄',
  '/cohort': '▦',
  '/kiosk': '▣',
};

function isNavItemActive(pathname: string, href: string, allHrefs: string[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  const hasMoreSpecificMatch = allHrefs.some(
    other =>
      other !== href &&
      other.length > href.length &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
  return !hasMoreSpecificMatch;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, clinicName, productSubtitle } = useClinic();
  const nav = NAV_BY_ROLE[role];
  const navHrefs = nav.map(item => item.href);
  const [fhirLabel, setFhirLabel] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);

  const showPatientSearch = canSearchPatients(role) && role !== 'patient';

  useEffect(() => {
    setFhirLabel(localStorage.getItem(FHIR_COOKIE.displayLabel) ?? '');
    setCollapsed(readSidebarCollapsed());
    setSidebarReady(true);
  }, []);

  useEffect(() => {
    document.title = clinicName;
  }, [clinicName]);

  function toggleSidebar() {
    setCollapsed(prev => {
      const next = !prev;
      writeSidebarCollapsed(next);
      return next;
    });
  }

  if (role === 'patient') {
    return <KioskShell>{children}</KioskShell>;
  }

  const asideWidth = collapsed ? 'w-[3.25rem]' : 'w-56';

  return (
    <div className="flex min-h-screen">
      <aside
        className={`relative shrink-0 border-r border-ink-100 bg-white flex flex-col transition-[width] duration-200 ${asideWidth} ${
          sidebarReady ? '' : 'w-56'
        }`}
      >
        <div
          className={`shrink-0 border-b border-ink-100 ${
            collapsed ? 'px-2 py-3 flex flex-col items-center gap-2' : 'px-3 py-3'
          }`}
        >
          <div className={`flex items-center w-full ${collapsed ? 'justify-center' : 'gap-2'}`}>
            <button
              type="button"
              onClick={toggleSidebar}
              className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md text-ink-600 hover:bg-ink-50 hover:text-ink-900"
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <Menu className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
            {!collapsed && (
              <>
                <span className="shrink-0">
                  <ShieldHalf className="h-5 w-5 text-accent" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" title={clinicName}>
                    {clinicName}
                  </div>
                  <div className="text-[10px] text-ink-500 truncate">{productSubtitle}</div>
                </div>
              </>
            )}
          </div>
          {collapsed && (
            <span title={clinicName} className="shrink-0">
              <ShieldHalf className="h-5 w-5 text-accent" />
            </span>
          )}
        </div>

        <RoleSwitcher collapsed={collapsed} />

        {showPatientSearch && (
          <PatientSearch
            collapsed={collapsed}
            onRequestExpand={() => {
              setCollapsed(false);
              writeSidebarCollapsed(false);
            }}
          />
        )}

        <nav className={`py-2 space-y-0.5 text-sm flex-1 ${collapsed ? 'px-1' : 'px-2'}`}>
          {nav.map(item => {
            const active = isNavItemActive(pathname, item.href, navHrefs);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-md transition-colors ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'
                } ${
                  active
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-700 hover:bg-ink-50 hover:text-ink-900'
                }`}
              >
                <span
                  className={`text-[11px] w-4 text-center shrink-0 ${
                    active ? 'text-white/80' : 'text-ink-500'
                  }`}
                >
                  {ICONS[item.href] ?? '·'}
                </span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="text-[10px] text-ink-500 border-t border-ink-100 px-4 py-4 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent inline-block shrink-0" />
              <span className="truncate">{fhirLabel || 'FHIR R4'}</span>
            </div>
            {role === 'admin' && (
              <Link href="/admin/settings" className="text-info hover:underline block truncate">
                Change FHIR server
              </Link>
            )}
            <div className="capitalize">View: {role}</div>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto min-w-0">
        <RoleAccessGate>{children}</RoleAccessGate>
      </main>
    </div>
  );
}
