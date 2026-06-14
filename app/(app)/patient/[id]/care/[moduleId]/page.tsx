import { notFound, redirect } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/primitives';
import { CareModuleBadge } from '@/components/care/care-module-badge';
import { LabRequestModuleForm } from '@/components/care/lab-request-module-form';
import { SoapCareModuleForm } from '@/components/care/soap-care-module-form';
import { getActingRoleFromCookie } from '@/lib/clinic/server-role';
import { canViewClinicalData } from '@/lib/clinic/access';
import {
  careModuleAllowsRole,
  getCareModule,
  isCareModuleId,
  legacyModuleHref,
  type CareModuleId,
} from '@/lib/ehr/care-modules';
import { loadPatientContext } from '@/lib/patient/load-patient-context';
import { ClipboardList, FlaskConical, Heart, Stethoscope } from 'lucide-react';

export const dynamic = 'force-dynamic';

function moduleIcon(id: CareModuleId) {
  switch (id) {
    case 'antenatal': return Heart;
    case 'gynaecology': return Stethoscope;
    case 'lab-request': return FlaskConical;
    default: return ClipboardList;
  }
}

function chartBackHref(moduleId: CareModuleId): string {
  const mod = getCareModule(moduleId);
  return mod.queueRole === 'nurse' ? '/clinic/nurse' : '/clinic/doctor';
}

export default async function CareModulePage({
  params,
  searchParams,
}: {
  params: { id: string; moduleId: string };
  searchParams: { appointment?: string };
}) {
  if (!isCareModuleId(params.moduleId)) notFound();

  const moduleId = params.moduleId;
  const role = getActingRoleFromCookie();
  if (!canViewClinicalData(role) || !careModuleAllowsRole(moduleId, role)) {
    redirect(`/patient/${params.id}`);
  }

  const ctx = await loadPatientContext(params.id);
  if (!ctx.patient) notFound();

  if (moduleId === 'primary-care') {
    redirect(legacyModuleHref(params.id, 'primary-care', searchParams.appointment));
  }
  if (moduleId === 'nursing-vitals') {
    redirect(legacyModuleHref(params.id, 'nursing-vitals', searchParams.appointment));
  }

  const mod = getCareModule(moduleId);
  const appointmentId = searchParams.appointment?.trim() || undefined;
  const Icon = moduleIcon(moduleId);
  const backHref = chartBackHref(moduleId);

  return (
    <div className="max-w-4xl">
      <CareModuleBadge moduleId={moduleId} />
      <Card>
        <CardTitle icon={<Icon className="h-4 w-4" />}>{mod.label}</CardTitle>
        {moduleId === 'lab-request' ? (
          <LabRequestModuleForm
            patientId={params.id}
            appointmentId={appointmentId}
            chartBackHref={backHref}
          />
        ) : (
          <SoapCareModuleForm
            patientId={params.id}
            careModuleId={moduleId}
            appointmentId={appointmentId}
            chartBackHref={backHref}
            showGestationalAge={moduleId === 'antenatal'}
          />
        )}
      </Card>
    </div>
  );
}
