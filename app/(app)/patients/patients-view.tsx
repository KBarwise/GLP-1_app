'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Patient } from '@/lib/fhir/resources';
import { Card, CardTitle } from '@/components/ui/primitives';
import { PatientDirectoryLoader } from './patient-directory-loader';
import { Search, Shield } from 'lucide-react';
import { fullName, ageFromBirthDate, initials } from '@/lib/utils';
import { useClinic } from '@/components/clinic/clinic-context';
import { canEditDemographics, canBookAppointments, patientDestination, receptionBookPatientUrl } from '@/lib/clinic/access';

function patientMrn(p: Patient) {
  return (
    p.identifier?.find(i => i.type?.coding?.some(c => c.code === 'MR'))?.value
    ?? p.identifier?.[0]?.value
  );
}

function PatientTable({ patients }: { patients: Patient[] }) {
  const { role } = useClinic();
  const canEdit = canEditDemographics(role);
  const canBook = canBookAppointments(role);

  return (
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
        {patients.map(p => {
          const name = fullName(p);
          const mrn = patientMrn(p);
          return (
            <tr key={p.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50">
              <td className="py-2.5">
                {p.id ? (
                  <Link href={patientDestination(role, p.id)} className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-info-soft text-info flex items-center justify-center text-[11px] font-medium">
                      {initials(name)}
                    </div>
                    <div>
                      <div className="font-medium">{name}</div>
                      <div className="text-[11px] text-ink-500">
                        {p.gender ?? '?'} · {ageFromBirthDate(p.birthDate) ?? '?'}y
                      </div>
                    </div>
                  </Link>
                ) : (
                  <span>{name}</span>
                )}
              </td>
              <td className="py-2.5 font-mono text-[12px] text-ink-500">{mrn ?? '–'}</td>
              <td className="py-2.5 text-ink-500">{p.birthDate ?? '–'}</td>
              <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                {canBook && p.id && (
                  <Link
                    href={receptionBookPatientUrl(p.id, name)}
                    className="text-accent text-[12px] font-medium"
                  >
                    Book
                  </Link>
                )}
                {canEdit && p.id && (
                  <Link href={`/register/${p.id}`} className="text-ink-500 text-[12px]">Edit demographics</Link>
                )}
                {p.id && (
                  <Link href={patientDestination(role, p.id)} className="text-info text-[12px]">
                    {canEdit ? 'Open →' : 'Chart →'}
                  </Link>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function PatientsView({
  query,
  searchResults,
  searchError,
}: {
  query: string;
  searchResults: Patient[];
  searchError: string | null;
}) {
  const [showDirectory, setShowDirectory] = useState(false);

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Find Patient</h1>
          <p className="text-sm text-ink-500 mt-0.5 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Search by name or MRN first. If no match, register the patient as new.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-[12px] text-ink-700">List all patients</span>
            <button
              type="button"
              role="switch"
              aria-checked={showDirectory}
              onClick={() => setShowDirectory(v => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                showDirectory ? 'bg-ink-900' : 'bg-ink-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                  showDirectory ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
          <Link
            href="/register"
            className="px-3 py-1.5 text-[12px] border border-ink-100 rounded-md hover:bg-ink-50"
          >
            Register new patient
          </Link>
        </div>
      </div>

      <form className="mb-4 flex gap-2" method="get">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-500" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Type at least 2 characters — name or MRN…"
            minLength={2}
            className="w-full pl-9 pr-3 py-2 text-[13px] border border-ink-100 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-[12px] bg-ink-900 text-white rounded-md hover:bg-ink-700"
        >
          Search
        </button>
        {query && (
          <Link href="/patients" className="px-3 py-2 text-[12px] text-ink-500 hover:text-ink-900">
            Clear
          </Link>
        )}
      </form>

      <Card className="mb-4">
        <CardTitle icon={<Search className="h-4 w-4" />}>Search results</CardTitle>
        {query.length < 2 ? (
          <p className="text-[13px] text-ink-500 py-4">
            Enter at least two characters to search. Patient names are only retrieved from FHIR when you search or open a known record.
          </p>
        ) : searchError ? (
          <p className="text-[13px] text-danger py-4">{searchError}</p>
        ) : searchResults.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-[13px] text-ink-600">
              No patient found for &ldquo;{query}&rdquo;.
            </p>
            <p className="text-[12px] text-ink-500">
              They may not be in the system yet — register them to start check-in and booking.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] bg-ink-900 text-white rounded-md hover:bg-ink-700"
            >
              Register new patient
            </Link>
          </div>
        ) : (
          <PatientTable patients={searchResults} />
        )}
      </Card>

      {showDirectory && (
        <Card>
          <CardTitle>Full patient directory</CardTitle>
          <p className="text-[12px] text-ink-500 mb-3">
            Turn off the list when you are finished to avoid displaying all patient names.
          </p>
          <PatientDirectoryLoader />
        </Card>
      )}
    </div>
  );
}
