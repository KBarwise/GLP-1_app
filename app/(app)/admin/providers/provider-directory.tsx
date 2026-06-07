'use client';

import { useState, useTransition } from 'react';
import { registerProvider } from './actions';
import type { ProviderFormData, ProviderRow } from '@/lib/fhir/practitioner-types';
import { emptyProviderForm } from '@/lib/fhir/practitioner-types';
import { Card, CardTitle } from '@/components/ui/primitives';

const inputClass = 'w-full px-3 py-2 border border-ink-100 rounded-md text-[13px]';

export function ProviderDirectory({ initial }: { initial: ProviderRow[] }) {
  const [form, setForm] = useState<ProviderFormData>(emptyProviderForm());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof ProviderFormData>(key: K, value: ProviderFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      try {
        const p = await registerProvider(form);
        setMessage(`Registered Practitioner/${p.id}`);
        setForm(emptyProviderForm());
      } catch (err) {
        setMessage((err as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Add provider</CardTitle>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <label className="block text-xs text-ink-500 mb-1">Given name</label>
            <input className={inputClass} value={form.given} onChange={e => set('given', e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Family name</label>
            <input className={inputClass} value={form.family} onChange={e => set('family', e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Role</label>
            <select
              className={inputClass}
              value={form.role}
              onChange={e => set('role', e.target.value as ProviderFormData['role'])}
            >
              <option value="doctor">Physician</option>
              <option value="nurse">Nurse</option>
              <option value="reception">Reception</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">NPI (optional)</label>
            <input className={inputClass} value={form.npi} onChange={e => set('npi', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Phone</label>
            <input className={inputClass} value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Email</label>
            <input type="email" className={inputClass} value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 bg-ink-900 text-white text-[12px] rounded-md disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Add to directory'}
            </button>
          </div>
        </form>
        {message && <p className="text-[12px] mt-2 text-ink-600">{message}</p>}
      </Card>

      <Card>
        <CardTitle>Provider directory ({initial.length})</CardTitle>
        {initial.length === 0 ? (
          <p className="text-[13px] text-ink-500">No practitioners on the server yet.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-xs text-ink-500 border-b border-ink-100">
                <th className="py-2">Name</th>
                <th className="py-2">Role</th>
                <th className="py-2">NPI</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {initial.map(p => (
                <tr key={p.id} className="border-b border-ink-100 last:border-b-0">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="py-2 text-ink-500">{p.role}</td>
                  <td className="py-2 font-mono text-[12px]">{p.npi ?? '—'}</td>
                  <td className="py-2">{p.active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
