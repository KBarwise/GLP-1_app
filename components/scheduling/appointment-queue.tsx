'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/primitives';
import { formatTime } from '@/lib/clinical/scheduling';
import { WORKFLOW_LABELS, type VisitWorkflow } from '@/lib/clinical/workflow';
import type { AppointmentRow } from '@/lib/fhir/appointments';
import {
  advanceVisitWorkflow,
  checkInPatient,
  setAppointmentStatus,
} from '@/app/(app)/scheduling/actions';
import { CLINIC_ROLES } from '@/lib/clinical/scheduling';
import type { ActingRole } from '@/lib/clinic/roles';
import { patientDestination } from '@/lib/clinic/access';

function workflowTone(w: VisitWorkflow): 'info' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (w === 'return-nurse' || w === 'ready-checkout') return 'warning';
  if (w === 'completed') return 'neutral';
  if (w.includes('progress')) return 'success';
  return 'info';
}

function roleLabel(role: AppointmentRow['clinicRole']) {
  if (role === 'nurse') return CLINIC_ROLES.nurse.display;
  if (role === 'doctor') return CLINIC_ROLES.doctor.display;
  return 'Clinic';
}

export function AppointmentQueue({
  rows,
  deskRole,
}: {
  rows: AppointmentRow[];
  deskRole: ActingRole;
}) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-ink-500 py-4">No patients in this queue.</p>;
  }

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-xs text-ink-500 border-b border-ink-100">
          <th className="py-2 font-medium">Time</th>
          <th className="py-2 font-medium">Patient</th>
          <th className="py-2 font-medium">Visit</th>
          <th className="py-2 font-medium">Stage</th>
          <th className="py-2 font-medium text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <QueueRow key={row.appointment.id} row={row} deskRole={deskRole} />
        ))}
      </tbody>
    </table>
  );
}

function QueueRow({ row, deskRole }: { row: AppointmentRow; deskRole: ActingRole }) {
  const router = useRouter();
  const patientHref = row.patientId ? patientDestination(deskRole, row.patientId) : null;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const a = row.appointment;
  const id = a.id!;
  const wf = row.workflow;

  function run(fn: () => Promise<unknown>, navigateTo?: string) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        if (navigateTo) {
          router.push(navigateTo);
        } else {
          router.refresh();
        }
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  const nurseDocHref = row.patientId
    ? `/patient/${row.patientId}/nurse?appointment=${id}`
    : null;
  const doctorConsultHref = row.patientId
    ? `/patient/${row.patientId}/consult/document?appointment=${id}`
    : null;

  return (
    <tr className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50">
      <td className="py-2.5 font-mono text-[12px]">{formatTime(a.start)}</td>
      <td className="py-2.5">
        {patientHref ? (
          <Link href={patientHref} className="font-medium hover:text-info">
            {row.patientName}
          </Link>
        ) : (
          <span>{row.patientName}</span>
        )}
      </td>
      <td className="py-2.5 text-ink-500">{roleLabel(row.clinicRole)}</td>
      <td className="py-2.5">
        <Badge tone={workflowTone(wf)}>{WORKFLOW_LABELS[wf]}</Badge>
      </td>
      <td className="py-2.5 text-right space-x-1 whitespace-nowrap">
        {error && (
          <p className="text-danger text-[11px] mb-1">{error}</p>
        )}
        {deskRole === 'reception' && (
          <>
            {a.status === 'booked' && wf === 'scheduled' && (
              <>
                <ActionBtn disabled={pending} onClick={() => run(() => checkInPatient(id))}>
                  Check in
                </ActionBtn>
                <ActionBtn disabled={pending} variant="muted" onClick={() => run(() => setAppointmentStatus(id, 'noshow'))}>
                  No show
                </ActionBtn>
              </>
            )}
            {(wf === 'ready-checkout' || wf === 'return-nurse') && (
              <ActionBtn disabled={pending} onClick={() => run(() => advanceVisitWorkflow(id, 'completed'))}>
                Complete checkout
              </ActionBtn>
            )}
          </>
        )}
        {deskRole === 'nurse' && row.patientId && (
          <>
            {(wf === 'waiting-nurse' || wf === 'return-nurse') && nurseDocHref && (
              <ActionBtn
                disabled={pending}
                onClick={() =>
                  run(() => advanceVisitWorkflow(id, 'nurse-in-progress', 'arrived'), nurseDocHref)
                }
              >
                Start
              </ActionBtn>
            )}
            {wf === 'nurse-in-progress' && nurseDocHref && (
              <Link href={nurseDocHref} className="text-info text-[12px] px-1">
                Documentation
              </Link>
            )}
            {(wf === 'nurse-in-progress' || wf === 'return-nurse') && (
              <ActionBtn disabled={pending} onClick={() => run(() => advanceVisitWorkflow(id, 'ready-for-doctor'))}>
                Send to doctor
              </ActionBtn>
            )}
          </>
        )}
        {deskRole === 'doctor' && row.patientId && doctorConsultHref && (
          <>
            {(wf === 'ready-for-doctor' || wf === 'doctor-in-progress') && (
              <ActionBtn
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    if (wf === 'ready-for-doctor') {
                      await advanceVisitWorkflow(id, 'doctor-in-progress', 'arrived');
                    }
                    router.push(doctorConsultHref);
                  })
                }
              >
                Start
              </ActionBtn>
            )}
          </>
        )}
      </td>
    </tr>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'muted';
}) {
  const cls = variant === 'primary'
    ? 'text-[11px] px-2 py-1 rounded bg-ink-900 text-white hover:bg-ink-700 disabled:opacity-50'
    : 'text-[11px] px-2 py-1 rounded border border-ink-100 hover:bg-ink-50 disabled:opacity-50';
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
