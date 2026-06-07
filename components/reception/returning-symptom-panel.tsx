import Link from 'next/link';
import { getNewReturningSymptomReports } from '@/app/(app)/kiosk/actions';
import { Card, CardTitle } from '@/components/ui/primitives';
import { AlertTriangle } from 'lucide-react';

export async function ReturningSymptomPanel() {
  let reports: Awaited<ReturnType<typeof getNewReturningSymptomReports>> = [];
  let loadError: string | null = null;

  try {
    reports = await getNewReturningSymptomReports();
  } catch (e) {
    loadError = (e as Error).message;
  }

  if (loadError) {
    return (
      <Card className="mb-4 border-warning/30">
        <CardTitle icon={<AlertTriangle className="h-4 w-4 text-warning" />}>
          Kiosk symptom alerts
        </CardTitle>
        <p className="text-[12px] text-ink-600">Could not load symptom alerts: {loadError}</p>
      </Card>
    );
  }

  if (reports.length === 0) return null;

  return (
    <Card className="mb-4 border-danger/30">
      <CardTitle icon={<AlertTriangle className="h-4 w-4 text-danger" />}>
        Kiosk symptom alerts — needs review
      </CardTitle>
      <p className="text-[12px] text-ink-500 mb-3">
        Returning patients who reported urgent symptoms today ({reports.length}).
      </p>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-ink-500 border-b border-ink-100">
            <th className="py-2 font-medium">Patient</th>
            <th className="py-2 font-medium">DOB</th>
            <th className="py-2 font-medium">Reported</th>
            <th className="py-2 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id} className="border-b border-ink-100 last:border-b-0">
              <td className="py-2.5 font-medium">{r.patientName}</td>
              <td className="py-2.5 text-ink-600">{r.birthDate}</td>
              <td className="py-2.5 text-ink-600">
                {r.symptoms.length > 0
                  ? r.symptoms.map(s => s.display).join(', ')
                  : 'None selected'}
              </td>
              <td className="py-2.5 text-right">
                <Link
                  href={`/patient/${r.patientId}`}
                  className="text-info text-[12px] hover:underline"
                >
                  Open chart →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
