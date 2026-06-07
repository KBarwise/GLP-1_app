'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { initials } from '@/lib/utils';
import { useClinic } from '@/components/clinic/clinic-context';
import { canEditDemographics, canBookAppointments, patientDestination, receptionBookPatientUrl } from '@/lib/clinic/access';

type Row = {
  id: string;
  name: string;
  birthDate?: string;
  age?: number;
  gender?: string;
  mrn?: string;
  active: boolean;
};

export function PatientDirectoryLoader() {
  const { role } = useClinic();
  const canEdit = canEditDemographics(role);
  const canBook = canBookAppointments(role);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    fetch('/api/patients/list')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        setRows(data.patients ?? []);
        setTruncated(Boolean(data.truncated));
      })
      .catch(e => setError((e as Error).message));
  }, []);

  if (error) return <p className="text-[13px] text-danger">{error}</p>;
  if (rows === null) return <p className="text-[13px] text-ink-500 py-4">Loading full directory…</p>;
  if (rows.length === 0) return <p className="text-[13px] text-ink-500 py-4">No patients found.</p>;

  return (
    <>
      {truncated && (
        <p className="text-[12px] text-warning mb-2">Showing first 500 patients only.</p>
      )}
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-ink-500 border-b border-ink-100">
            <th className="py-2 font-medium">Patient</th>
            <th className="py-2 font-medium">MRN</th>
            <th className="py-2 font-medium">DOB</th>
            <th className="py-2 font-medium text-right"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50">
              <td className="py-2.5">
                <Link href={patientDestination(role, p.id)} className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-info-soft text-info flex items-center justify-center text-[11px] font-medium">
                    {initials(p.name)}
                  </div>
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[11px] text-ink-500">
                      {p.gender ?? '?'} · {p.age ?? '?'}y
                    </div>
                  </div>
                </Link>
              </td>
              <td className="py-2.5 font-mono text-[12px] text-ink-500">{p.mrn ?? '–'}</td>
              <td className="py-2.5 text-ink-500">{p.birthDate ?? '–'}</td>
              <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                {canBook && (
                  <Link
                    href={receptionBookPatientUrl(p.id, p.name)}
                    className="text-accent text-[12px] font-medium"
                  >
                    Book
                  </Link>
                )}
                {canEdit && (
                  <Link href={`/register/${p.id}`} className="text-ink-500 text-[12px]">Edit</Link>
                )}
                <Link href={patientDestination(role, p.id)} className="text-info text-[12px]">
                  {canEdit ? 'Open →' : 'Chart →'}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
