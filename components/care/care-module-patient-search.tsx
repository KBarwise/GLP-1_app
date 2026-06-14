'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import {
  careModulePatientHref,
  getCareModule,
  type CareModuleId,
} from '@/lib/ehr/care-modules';

type SearchHit = {
  id: string;
  name: string;
  mrn?: string;
  gender?: string;
  age?: number;
};

export function CareModulePatientSearch({ moduleId }: { moduleId: CareModuleId }) {
  const mod = getCareModule(moduleId);
  const router = useRouter();
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

  function openModule(patientId: string) {
    setOpen(false);
    setQuery('');
    router.push(careModulePatientHref(patientId, moduleId));
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-[11px] text-ink-500 mb-1">
        Open {mod.shortLabel} for a patient
      </label>
      <div className="relative">
        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-ink-500" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Search by name or MRN…"
          className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-ink-100 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
      </div>
      {open && (hits.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 bg-white border border-ink-100 rounded-md shadow-lg max-h-48 overflow-auto">
          {loading && hits.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-ink-500">Searching…</div>
          )}
          {hits.map(h => (
            <button
              key={h.id}
              type="button"
              onClick={() => openModule(h.id)}
              className="w-full text-left px-3 py-2 hover:bg-ink-50 border-b border-ink-100 last:border-b-0"
            >
              <div className="text-[13px] font-medium truncate">{h.name}</div>
              <div className="text-[11px] text-ink-500">
                {h.mrn && <>MRN {h.mrn} · </>}
                {h.gender ?? '?'} · {h.age ?? '?'}y
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
