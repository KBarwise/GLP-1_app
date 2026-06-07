'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  readClinicNameFromDocumentCookie,
  writeClinicNameDocumentCookie,
} from '@/lib/clinic/clinic-name-cookie';
import { PRODUCT_FULL_NAME, DEFAULT_CLINIC_NAME } from '@/lib/clinic/branding';
import {
  ACTING_ROLES,
  STORAGE_KEYS,
  type ActingRole,
} from '@/lib/clinic/roles';
import { homePathForRole } from '@/lib/clinic/nav';
import { resolveClientActingRole } from '@/lib/clinic/client-role';

type ClinicContextValue = {
  role: ActingRole;
  setRole: (role: ActingRole) => void;
  clinicName: string;
  setClinicName: (name: string) => void;
  productSubtitle: string;
  homePath: string;
  roles: typeof ACTING_ROLES;
  ready: boolean;
};

const ClinicContext = createContext<ClinicContextValue | null>(null);

export function ClinicProvider({
  children,
  initialClinicName = DEFAULT_CLINIC_NAME,
  initialRole,
}: {
  children: ReactNode;
  initialClinicName?: string;
  initialRole?: ActingRole;
}) {
  const [role, setRoleState] = useState<ActingRole>(
    () => initialRole ?? resolveClientActingRole('reception'),
  );
  const [clinicName, setClinicNameState] = useState(
    () => initialClinicName.trim() || DEFAULT_CLINIC_NAME,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedRole = localStorage.getItem(STORAGE_KEYS.role) as ActingRole | null;
    const storedName = localStorage.getItem(STORAGE_KEYS.clinicName)?.trim();
    const cookieName = readClinicNameFromDocumentCookie();
    const fromServer = initialClinicName.trim();
    // Cookie / server win over localStorage so admin-saved names are not reverted on refresh.
    const resolvedName =
      cookieName
      || (fromServer && fromServer !== DEFAULT_CLINIC_NAME ? fromServer : '')
      || storedName
      || fromServer
      || DEFAULT_CLINIC_NAME;

    if (storedRole && ACTING_ROLES.some(r => r.id === storedRole)) {
      setRoleState(storedRole);
      document.cookie = `${STORAGE_KEYS.role}=${storedRole}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
    setClinicNameState(resolvedName);
    try {
      localStorage.setItem(STORAGE_KEYS.clinicName, resolvedName);
      writeClinicNameDocumentCookie(resolvedName);
    } catch {
      writeClinicNameDocumentCookie(resolvedName);
    }
    setReady(true);
  }, [initialClinicName]);

  const setRole = useCallback((next: ActingRole) => {
    setRoleState(next);
    localStorage.setItem(STORAGE_KEYS.role, next);
    document.cookie = `${STORAGE_KEYS.role}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  const setClinicName = useCallback((name: string) => {
    const trimmed = name.trim() || DEFAULT_CLINIC_NAME;
    setClinicNameState(trimmed);
    try {
      localStorage.setItem(STORAGE_KEYS.clinicName, trimmed);
    } catch {
      /* localStorage may be unavailable */
    }
    writeClinicNameDocumentCookie(trimmed);
  }, []);

  const value = useMemo<ClinicContextValue>(() => ({
    role,
    setRole,
    clinicName,
    setClinicName,
    productSubtitle: PRODUCT_FULL_NAME,
    homePath: homePathForRole(role),
    roles: ACTING_ROLES,
    ready,
  }), [role, setRole, clinicName, setClinicName, ready]);

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error('useClinic must be used within ClinicProvider');
  return ctx;
}
