'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FlaskConical, HeartPulse, Ruler } from 'lucide-react';
import {
  DEFAULT_MEASUREMENT_SELECTION,
  DEFAULT_VITAL_SIGN_SELECTION,
  MEASUREMENT_TREND_OPTIONS,
  VITAL_SIGN_TREND_OPTIONS,
} from '@/lib/clinical/trend-code-sets';
import { DEFAULT_LAB_SELECTION, PRIORITY_LAB_CODES } from '@/lib/clinical/trend-metrics';
import { useLabCodeCatalog } from '@/hooks/useObservations';
import { MeasureTrendsTab } from './MeasureTrendsTab';

export type TrendsTabId = 'vitals' | 'measurements' | 'laboratory';

const TABS: Array<{ id: TrendsTabId; label: string; icon: typeof HeartPulse }> = [
  { id: 'vitals', label: 'Vital signs', icon: HeartPulse },
  { id: 'measurements', label: 'Measurements', icon: Ruler },
  { id: 'laboratory', label: 'Laboratory results', icon: FlaskConical },
];

function tabFromParam(value: string | null, trendsSection: string | null): TrendsTabId {
  if (value === 'vitals' || value === 'measurements' || value === 'laboratory') return value;
  if (trendsSection?.includes('laboratory')) return 'laboratory';
  if (trendsSection?.includes('anthropometric') || trendsSection?.includes('measurement')) {
    return 'measurements';
  }
  return 'vitals';
}

function LaboratoryTrendsTabContent({
  patientId,
  labOptions,
}: {
  patientId: string;
  labOptions: Array<{ code: string; display: string }>;
}) {
  const defaultSelected = useMemo(() => {
    const preferred = DEFAULT_LAB_SELECTION.filter(code => labOptions.some(o => o.code === code));
    if (preferred.length > 0) return preferred;
    return labOptions.slice(0, 3).map(o => o.code);
  }, [labOptions]);

  return (
    <MeasureTrendsTab
      patientId={patientId}
      codeOptions={labOptions}
      defaultSelected={defaultSelected}
      exportPrefix="labs"
      compact
      emptyMessage="Select at least one laboratory analyte."
    />
  );
}

export function TabbedTrendsPanel({ patientId }: { patientId: string }) {
  const searchParams = useSearchParams();
  const trendsSection = searchParams.get('trends');
  const [activeTab, setActiveTab] = useState<TrendsTabId>(() =>
    tabFromParam(searchParams.get('tab'), trendsSection),
  );

  useEffect(() => {
    setActiveTab(tabFromParam(searchParams.get('tab'), trendsSection));
  }, [searchParams, trendsSection]);

  const labCatalog = useLabCodeCatalog(patientId);
  const labOptions = useMemo(() => {
    const fromCatalog = labCatalog.data ?? [];
    if (fromCatalog.length > 0) return fromCatalog;
    return PRIORITY_LAB_CODES.map(l => ({ code: l.code, display: l.display }));
  }, [labCatalog.data]);

  return (
    <div className="flex flex-col min-h-0 gap-3">
      <div className="flex flex-wrap gap-1 shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const on = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] border transition-colors ${
                on
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'border-ink-100 text-ink-600 hover:bg-ink-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === 'vitals' && (
          <MeasureTrendsTab
            patientId={patientId}
            codeOptions={VITAL_SIGN_TREND_OPTIONS}
            defaultSelected={DEFAULT_VITAL_SIGN_SELECTION}
            exportPrefix="vitals"
            compact
            emptyMessage="Select vital signs to plot."
          />
        )}
        {activeTab === 'measurements' && (
          <MeasureTrendsTab
            patientId={patientId}
            codeOptions={MEASUREMENT_TREND_OPTIONS}
            defaultSelected={DEFAULT_MEASUREMENT_SELECTION}
            exportPrefix="measurements"
            compact
            emptyMessage="Select anthropometric measures to plot."
          />
        )}
        {activeTab === 'laboratory' && (
          <LaboratoryTrendsTabContent patientId={patientId} labOptions={labOptions} />
        )}
      </div>
    </div>
  );
}
