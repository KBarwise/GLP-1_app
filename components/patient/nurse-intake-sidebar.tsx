'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Activity, ChevronDown, ChevronRight, LineChart } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/primitives';
import {
  buildNurseIntakeSummary,
  nurseIntakeHasData,
  type NurseIntakeRow,
} from '@/lib/clinical/nurse-intake-summary';
import type { Observation } from '@/lib/fhir/resources';


function isAbnormalIntakeRow(row: NurseIntakeRow): boolean {
  return row.status === 'warning' || row.status === 'critical';
}

function partitionVitalSignRows(vitals: NurseIntakeRow[]): {
  prominent: NurseIntakeRow[];
  normal: NurseIntakeRow[];
} {
  const prominent: NurseIntakeRow[] = [];
  const normal: NurseIntakeRow[] = [];
  for (const row of vitals) {
    if (row.status === 'normal') normal.push(row);
    else prominent.push(row);
  }
  return { prominent, normal };
}

function TrendsLink({ section }: { section: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = useMemo(() => {
    const q = new URLSearchParams(searchParams.toString());
    q.set('trends', section);
    return `${pathname}?${q.toString()}`;
  }, [pathname, searchParams, section]);

  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex items-center gap-1 text-[11px] text-info hover:underline shrink-0"
    >
      <LineChart className="h-3 w-3" />
      Trends
    </Link>
  );
}

function SectionHeader({
  title,
  trendsSection,
}: {
  title: string;
  trendsSection: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <h4 className="text-[12px] font-medium text-ink-600">{title}</h4>
      <TrendsLink section={trendsSection} />
    </div>
  );
}

function IntakeRow({ row, prominent }: { row: NurseIntakeRow; prominent?: boolean }) {
  const abnormal = isAbnormalIntakeRow(row);
  return (
    <div
      className={`py-2 border-b border-ink-50 last:border-b-0 ${
        prominent && abnormal
          ? 'rounded-md border border-danger/30 bg-danger-soft/40 px-2 -mx-2'
          : abnormal
            ? 'rounded-md border border-warning/30 bg-warning-soft/30 px-2 -mx-2'
            : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] text-ink-600">{row.label}</span>
        {abnormal && (
          <span
            className={`text-[10px] font-medium uppercase tracking-wide shrink-0 ${
              row.status === 'critical' ? 'text-danger' : 'text-warning'
            }`}
          >
            {row.status === 'critical' ? 'Critical' : 'Abnormal'}
          </span>
        )}
      </div>
      <p
        className={`text-[14px] font-semibold tnum mt-0.5 ${
          row.status === 'critical'
            ? 'text-danger'
            : row.status === 'warning'
              ? 'text-warning'
              : 'text-ink-900'
        }`}
      >
        {row.value}
        {row.unit ? <span className="text-[12px] font-normal text-ink-500"> {row.unit}</span> : null}
      </p>
      {row.date && <p className="text-[10px] text-ink-400 mt-0.5">{row.date}</p>}
    </div>
  );
}

function collapsibleSummary(rows: NurseIntakeRow[], emptyLabel: string): string {
  if (rows.length === 0) return emptyLabel;
  return rows.map(r => `${r.label}: ${r.value}${r.unit ? ` ${r.unit}` : ''}`).join(' · ');
}

function CollapsibleIntakeRows({
  title,
  rows,
  emptyLabel,
  defaultExpanded = false,
}: {
  title: string;
  rows: NurseIntakeRow[];
  emptyLabel: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const summaryHint = collapsibleSummary(rows, emptyLabel);

  return (
    <div className="border border-ink-100 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-2 px-2.5 py-2 text-left bg-ink-50/60 hover:bg-ink-50 transition-colors"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-ink-500 shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-ink-500 shrink-0 mt-0.5" />
        )}
        <span className="flex-1 min-w-0">
          <span className="text-[12px] font-medium text-ink-700">{title}</span>
          {!expanded && (
            <span className="block text-[11px] text-ink-500 truncate mt-0.5">{summaryHint}</span>
          )}
        </span>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2 pt-1 border-t border-ink-100">
          {rows.length === 0 ? (
            <p className="text-[12px] text-ink-500 py-1">{emptyLabel}</p>
          ) : (
            <div>
              {rows.map(row => (
                <IntakeRow key={row.label} row={row} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VitalSignsSection({
  prominent,
  normal,
}: {
  prominent: NurseIntakeRow[];
  normal: NurseIntakeRow[];
}) {
  const hasAny = prominent.length > 0 || normal.length > 0;

  return (
    <div>
      <SectionHeader title="Vital signs" trendsSection="vitals-signs-trends" />
      {!hasAny ? (
        <p className="text-[12px] text-ink-500 py-1">No vitals recorded</p>
      ) : (
        <div className="space-y-2">
          {prominent.length > 0 && (
            <div>
              {prominent.map(row => (
                <IntakeRow key={row.label} row={row} prominent />
              ))}
            </div>
          )}
          {normal.length > 0 && (
            <CollapsibleIntakeRows
              title={`Normal vital signs (${normal.length})`}
              rows={normal}
              emptyLabel="None"
            />
          )}
        </div>
      )}
    </div>
  );
}

export function NurseIntakeSidebar({
  patientId,
  observations,
}: {
  patientId: string;
  observations: Observation[];
}) {
  void patientId;
  const summary = buildNurseIntakeSummary(observations);
  const { prominent: prominentVitals, normal: normalVitals } = useMemo(
    () => partitionVitalSignRows(summary.vitals),
    [summary.vitals],
  );
  const pocAbnormal = useMemo(
    () => summary.poc.filter(isAbnormalIntakeRow),
    [summary.poc],
  );
  const pocNormal = useMemo(
    () => summary.poc.filter(row => !isAbnormalIntakeRow(row)),
    [summary.poc],
  );

  return (
    <Card className="lg:sticky lg:top-[7.5rem]">
      <CardTitle icon={<Activity className="h-4 w-4" />}>Nurse intake</CardTitle>
      {!nurseIntakeHasData(summary) ? (
        <p className="text-[12px] text-ink-500 py-2">
          No vitals, anthropometrics, or point-of-care results yet.
        </p>
      ) : (
        <div className="space-y-4">
          <VitalSignsSection prominent={prominentVitals} normal={normalVitals} />

          <div>
            <SectionHeader title="Measurements" trendsSection="measurements-trends" />
            <CollapsibleIntakeRows
              title={`Measurements (${summary.anthropometrics.length})`}
              rows={summary.anthropometrics}
              emptyLabel="No height/weight/BMI"
              defaultExpanded={summary.anthropometrics.some(isAbnormalIntakeRow)}
            />
          </div>

          <div>
            <SectionHeader
              title="Point-of-care tests"
              trendsSection="laboratory-trends"
            />
            {summary.poc.length === 0 ? (
              <p className="text-[12px] text-ink-500 py-1">No POC tests recorded</p>
            ) : (
              <div className="space-y-2">
                {pocAbnormal.length > 0 && (
                  <div>
                    {pocAbnormal.map(row => (
                      <IntakeRow key={row.label} row={row} prominent />
                    ))}
                  </div>
                )}
                {pocNormal.length > 0 && (
                  <CollapsibleIntakeRows
                    title={`Normal point-of-care tests (${pocNormal.length})`}
                    rows={pocNormal}
                    emptyLabel="None"
                  />
                )}
              </div>
            )}
          </div>

          {summary.nursingNote && (
            <div>
              <h4 className="text-[12px] font-medium text-ink-600 mb-1.5">Nursing note</h4>
              <p className="text-[12px] text-ink-800 whitespace-pre-wrap">{summary.nursingNote.value}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
