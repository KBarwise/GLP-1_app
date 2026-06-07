import Link from 'next/link';
import { Card, CardTitle, Badge, Metric } from '@/components/ui/primitives';
import { loadCohortRiskDashboard } from '@/lib/patient/risk';
import { fullName, ageFromBirthDate, initials } from '@/lib/utils';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DoctorRiskDashboardPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const atRiskOnly = searchParams.view !== 'all';
  const { rows, patientsScanned, error } = await loadCohortRiskDashboard({ atRiskOnly });

  const redPatients = rows.filter(r => r.redCount > 0).length;
  const amberOnly = rows.filter(r => r.redCount === 0 && r.amberCount > 0).length;
  const totalAlerts = rows.reduce((n, r) => n + r.redCount + r.amberCount, 0);

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Risk dashboard</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Safety signals across patients on active incretin therapy
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <Link
            href="/clinic/doctor/risk"
            className={`px-3 py-1.5 rounded-md border ${
              atRiskOnly
                ? 'bg-ink-900 text-white border-ink-900'
                : 'bg-white border-ink-100 text-ink-700 hover:bg-ink-50'
            }`}
          >
            At-risk only
          </Link>
          <Link
            href="/clinic/doctor/risk?view=all"
            className={`px-3 py-1.5 rounded-md border ${
              !atRiskOnly
                ? 'bg-ink-900 text-white border-ink-900'
                : 'bg-white border-ink-100 text-ink-700 hover:bg-ink-50'
            }`}
          >
            Full cohort
          </Link>
          <Link
            href="/clinic/doctor"
            className="px-3 py-1.5 rounded-md border border-ink-100 bg-white text-ink-700 hover:bg-ink-50"
          >
            Doctor queue
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md border border-danger/30 bg-danger-soft text-danger text-[13px]">
          Could not load cohort from FHIR: {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Metric label="Cohort scanned" value={patientsScanned} sub="active incretin Rx" />
        <Metric
          label="Patients shown"
          value={rows.length}
          sub={atRiskOnly ? 'red or amber signals' : 'sorted by risk'}
        />
        <Metric label="High risk (red)" value={redPatients} tone="danger" />
        <Metric label="Caution (amber)" value={amberOnly} tone="warning" sub={`${totalAlerts} alerts total`} />
      </div>

      <Card>
        <CardTitle icon={<ShieldAlert className="h-4 w-4" />}>
          {atRiskOnly ? 'Patients needing review' : 'Cohort risk ranking'}
        </CardTitle>

        {patientsScanned === 0 ? (
          <p className="text-[13px] text-ink-500 py-6 text-center">
            No active incretin prescriptions found. Connect FHIR with sample data or register patients
            on therapy.
          </p>
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-ink-500 py-6 text-center">
            No red or amber safety signals in the incretin cohort.{' '}
            <Link href="/clinic/doctor/risk?view=all" className="text-info hover:underline">
              View full cohort
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[40rem]">
              <thead>
                <tr className="text-left text-xs text-ink-500 border-b border-ink-100">
                  <th className="py-2 font-medium">Patient</th>
                  <th className="py-2 font-medium">Risk</th>
                  <th className="py-2 font-medium">Alerts</th>
                  <th className="py-2 font-medium">Top signals</th>
                  <th className="py-2 font-medium">Therapy</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const id = row.patient.id!;
                  const name = fullName(row.patient);
                  return (
                    <tr
                      key={id}
                      className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50 align-top"
                    >
                      <td className="py-2.5">
                        <Link href={`/patient/${id}`} className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-info-soft text-info flex items-center justify-center text-[11px] font-medium shrink-0">
                            {initials(name)}
                          </div>
                          <div>
                            <div className="font-medium">{name}</div>
                            <div className="text-[11px] text-ink-500">
                              {row.patient.gender ?? '?'} · {ageFromBirthDate(row.patient.birthDate) ?? '?'}y
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        <Badge tone={row.riskTone}>
                          {row.riskScore} ·{' '}
                          {row.riskTone === 'danger'
                            ? 'high'
                            : row.riskTone === 'warning'
                              ? 'moderate'
                              : 'low'}
                        </Badge>
                      </td>
                      <td className="py-2.5 whitespace-nowrap text-[12px]">
                        {row.redCount > 0 && (
                          <span className="text-danger font-medium">{row.redCount} red</span>
                        )}
                        {row.redCount > 0 && row.amberCount > 0 && ' · '}
                        {row.amberCount > 0 && (
                          <span className="text-warning font-medium">{row.amberCount} amber</span>
                        )}
                        {!row.atRisk && <span className="text-ink-500">clear</span>}
                      </td>
                      <td className="py-2.5 max-w-xs">
                        {row.topSignals.length === 0 ? (
                          <span className="text-ink-400">—</span>
                        ) : (
                          <ul className="space-y-1">
                            {row.topSignals.map(s => (
                              <li key={s.id} className="flex items-start gap-1.5 text-[12px]">
                                <AlertTriangle
                                  className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                                    s.severity === 'red' ? 'text-danger' : 'text-warning'
                                  }`}
                                />
                                <span>
                                  <span className="font-medium">{s.title}</span>
                                  <span className="text-ink-500"> — {s.detail}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-2.5 text-ink-600 text-[12px]">
                        <div>{row.medicationDisplay ?? '—'}</div>
                        {row.medicationAuthored && (
                          <div className="text-ink-400">{row.medicationAuthored}</div>
                        )}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap space-x-2">
                        <Link href={`/patient/${id}`} className="text-info text-[12px] hover:underline">
                          Chart
                        </Link>
                        <Link
                          href={`/patient/${id}/consult/document`}
                          className="text-ink-600 text-[12px] hover:underline"
                        >
                          Consult →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
