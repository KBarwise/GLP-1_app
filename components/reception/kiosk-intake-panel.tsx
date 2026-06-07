import Link from 'next/link';
import { getPendingKioskIntakes } from '@/app/(app)/kiosk/actions';
import { kioskLeadDisplayName } from '@/lib/kiosk/intake-types';
import { Card, CardTitle } from '@/components/ui/primitives';
import { ClipboardList } from 'lucide-react';

export async function KioskIntakePanel() {
  let leads: Awaited<ReturnType<typeof getPendingKioskIntakes>> = [];
  let loadError: string | null = null;

  try {
    leads = await getPendingKioskIntakes();
  } catch (e) {
    loadError = (e as Error).message;
  }

  return (
    <Card className="mb-4">
      <CardTitle icon={<ClipboardList className="h-4 w-4" />}>
        Kiosk pre-screening — awaiting registration
      </CardTitle>
      <p className="text-[12px] text-ink-500 mb-3">
        Patients who passed GLP-1 pre-screening or chose the diet-and-exercise pathway after a
        failed screen are listed here.
      </p>
      {loadError ? (
        <p className="text-[12px] text-ink-600">Could not load kiosk queue: {loadError}</p>
      ) : leads.length === 0 ? (
        <p className="text-[13px] text-ink-500 py-2">No patients waiting from the kiosk.</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-xs text-ink-500 border-b border-ink-100">
              <th className="py-2 font-medium">Patient</th>
              <th className="py-2 font-medium">Contact</th>
              <th className="py-2 font-medium">Pathway</th>
              <th className="py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => (
              <tr key={lead.id} className="border-b border-ink-100 last:border-b-0">
                <td className="py-2.5">
                  <div className="font-medium">{kioskLeadDisplayName(lead.demographics)}</div>
                  <div className="text-[11px] text-ink-500">
                    {lead.demographics.gender} · {lead.demographics.age}y
                  </div>
                </td>
                <td className="py-2.5 text-ink-600 text-[12px]">
                  {lead.demographics.phone && <div>{lead.demographics.phone}</div>}
                  {lead.demographics.email && <div>{lead.demographics.email}</div>}
                </td>
                <td className="py-2.5">
                  <div
                    className={
                      lead.pathway === 'diet-exercise'
                        ? 'text-info font-medium'
                        : lead.screeningOverall === 'amber'
                          ? 'text-warning'
                          : 'text-accent'
                    }
                  >
                    {lead.pathway === 'diet-exercise'
                      ? 'Diet & exercise'
                      : 'GLP-1 eligible'}
                  </div>
                  <div className="text-[11px] text-ink-500 mt-0.5">{lead.screeningSummary}</div>
                </td>
                <td className="py-2.5 text-right">
                  <Link
                    href={`/register?intake=${lead.id}`}
                    className="text-info text-[12px] hover:underline"
                  >
                    Register →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
