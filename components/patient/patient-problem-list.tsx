import { Card, CardTitle } from '@/components/ui/primitives';
import { ListTree } from 'lucide-react';
import type { Condition } from '@/lib/fhir/resources';
import { conditionLabel, conditionQualifierSummary } from '@/lib/clinical/conditions';

export function PatientProblemList({
  disorders,
  embedded = false,
}: {
  disorders: Condition[];
  embedded?: boolean;
}) {
  const body =
    disorders.length === 0 ? (
      <p className="text-[13px] text-ink-500 py-2">No active disorder diagnoses on record.</p>
    ) : (
      <ul className="text-[13px] space-y-1.5">
        {disorders.map(c => {
          const qualifiers = conditionQualifierSummary(c);
          return (
            <li key={c.id ?? conditionLabel(c)} className="text-ink-800">
              <div className="font-medium">{conditionLabel(c)}</div>
              {qualifiers && <div className="text-[12px] text-ink-500 mt-0.5">{qualifiers}</div>}
            </li>
          );
        })}
      </ul>
    );

  if (embedded) return <div>{body}</div>;

  return (
    <Card className="mb-3">
      <CardTitle icon={<ListTree className="h-4 w-4" />}>Problem list</CardTitle>
      {body}
    </Card>
  );
}
