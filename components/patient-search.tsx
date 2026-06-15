'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useClinic } from '@/components/clinic/clinic-context';
import { patientDestination, receptionBookPatientUrl, canBookAppointments } from '@/lib/clinic/access';

type SearchHit = {
  id: string;
  name: string;
  birthDate?: string;
  age?: number;
  gender?: string;
  mrn?: string;
};

export function PatientSearch({
  placeholder = 'Search patients…',
  collapsed = false,
  onRequestExpand,
}: {
  placeholder?: string;
  collapsed?: boolean;
  onRequestExpand?: () => void;
}) {
  const router = useRouter();
  const { role } = useClinic();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setHits(data.patients ?? []);
        setOpen(true);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function selectPatient(id: string) {
    setOpen(false);
    setQuery('');
    router.push(patientDestination(role, id));
  }

  if (collapsed) {
    return (
      <div className="px-1 pb-2 flex justify-center">
        <button
          type="button"
          onClick={() => onRequestExpand?.()}
          className="h-9 w-9 flex items-center justify-center rounded-md border border-ink-100 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
          title="Expand sidebar to search patients"
          aria-label="Search patients"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative px-3 pb-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-ink-500" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-ink-100 rounded-md bg-ink-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
      </div>
      {open && (hits.length > 0 || loading) && (
        <div className="absolute left-3 right-3 top-full z-20 mt-1 bg-white border border-ink-100 rounded-md shadow-lg max-h-56 overflow-auto">
          {loading && hits.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-ink-500">Searching…</div>
          )}
          {hits.map(h => (
            <div
              key={h.id}
              className="flex items-stretch border-b border-ink-100 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => selectPatient(h.id)}
                className="flex-1 min-w-0 text-left px-3 py-2 hover:bg-ink-50"
              >
                <div className="text-[13px] font-medium truncate">{h.name}</div>
                <div className="text-[11px] text-ink-500">
                  {h.mrn && <>MRN {h.mrn} · </>}
                  {h.gender ?? '?'} · {h.age ?? '?'}y
                </div>
              </button>
              {canBookAppointments(role) && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQuery('');
                    router.push(receptionBookPatientUrl(h.id, h.name));
                  }}
                  className="shrink-0 px-2.5 py-2 text-[11px] font-medium text-accent border-l border-ink-100 hover:bg-ink-50"
                >
                  Book
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
