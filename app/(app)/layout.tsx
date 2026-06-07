import { ClinicProvider } from '@/components/clinic/clinic-context';
import { AppShell } from '@/components/clinic/app-shell';
import { documentTitle, PRODUCT_DESCRIPTION } from '@/lib/clinic/branding';
import { getClinicNameFromCookie } from '@/lib/clinic/server-clinic';
import { getActingRoleFromCookie } from '@/lib/clinic/server-role';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const clinicName = getClinicNameFromCookie();
  return {
    title: { absolute: documentTitle(clinicName) },
    description: PRODUCT_DESCRIPTION,
  };
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const initialClinicName = getClinicNameFromCookie();
  const initialRole = getActingRoleFromCookie();

  return (
    <ClinicProvider initialClinicName={initialClinicName} initialRole={initialRole}>
      <AppShell>{children}</AppShell>
    </ClinicProvider>
  );
}
