'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addProblemListItem,
  removeProblemListItem,
  updateProblemListItem,
} from '@/app/(app)/patient/[id]/problem-list-actions';
import { Card, CardTitle } from '@/components/ui/primitives';
import { inputClass, labelClass } from '@/components/clinical/form-styles';
import { conditionLabel, conditionSnomedCode, isActiveCondition } from '@/lib/clinical/conditions';
import {
  CLINICAL_STATUS_OPTIONS,
  VERIFICATION_OPTIONS,
  defaultProblemListDiagnosis,
  formatDiagnosisQualifiers,
  parseClinicalStatus,
  parseVerificationStatus,
  type ProblemListDiagnosis,
  type DiagnosisClinicalStatus,
  type DiagnosisVerification,
} from '@/lib/clinical/diagnosis-qualifiers';
import { COMMON_DIAGNOSES } from '@/lib/clinical/lab-catalog';
import type { Condition } from '@/lib/fhir/resources';
import { ListTree, Pencil, Plus, Trash2 } from 'lucide-react';

type RowState = {
  conditionId: string;
  code: string;
  display: string;
  clinicalStatus: DiagnosisClinicalStatus;
  verification: DiagnosisVerification;
  isActive: boolean;
};

function toRow(condition: Condition): RowState | null {
  const id = condition.id;
  const code = conditionSnomedCode(condition);
  if (!id || !code) return null;
  return {
    conditionId: id,
    code,
    display: conditionLabel(condition),
    clinicalStatus: parseClinicalStatus(condition.clinicalStatus?.coding?.[0]?.code),
    verification: parseVerificationStatus(condition.verificationStatus?.coding?.[0]?.code),
    isActive: isActiveCondition(condition),
  };
}

export function EditableProblemList({
  patientId,
  problems,
  embedded = false,
}: {
  patientId: string;
  problems: Condition[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draftAdd, setDraftAdd] = useState<ProblemListDiagnosis | null>(null);

  const rows = useMemo(
    () =>
      problems
        .map(toRow)
        .filter((r): r is RowState => r !== null)
        .sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return a.display.localeCompare(b.display);
        }),
    [problems],
  );

  const activeCodes = new Set(rows.filter(r => r.isActive).map(r => r.code));

  function refresh() {
    router.refresh();
  }

  function closeEditors() {
    setEditingId(null);
    setShowAdd(false);
    setDraftAdd(null);
  }

  function beginAdd(code: string) {
    const d = COMMON_DIAGNOSES.find(x => x.code === code);
    if (!d) return;
    if (activeCodes.has(code)) {
      setError(`${d.display} is already on the active problem list.`);
      return;
    }
    const inactive = rows.find(r => r.code === code && !r.isActive);
    setError(null);
    setEditingId(null);
    setDraftAdd(
      inactive
        ? { ...defaultProblemListDiagnosis(d.code, d.display), clinicalStatus: 'active' }
        : defaultProblemListDiagnosis(d.code, d.display),
    );
  }

  function saveNewProblem() {
    if (!draftAdd) return;
    setError(null);
    startTransition(async () => {
      try {
        await addProblemListItem(patientId, draftAdd);
        closeEditors();
        refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function saveRow(row: RowState) {
    setError(null);
    startTransition(async () => {
      try {
        await updateProblemListItem(row.conditionId, patientId, {
          clinicalStatus: row.clinicalStatus,
          verification: row.verification,
        });
        setEditingId(null);
        refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function removeRow(conditionId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeProblemListItem(conditionId, patientId);
        setEditingId(null);
        refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const inner = (
    <>
      {rows.length === 0 && !draftAdd ? (
        <p className="text-[13px] text-ink-500 py-2">No problems on record.</p>
      ) : (
        <ul className="text-[13px] space-y-1 mb-3">
          {rows.map(row => (
            <ProblemRow
              key={row.conditionId}
              row={row}
              pending={pending}
              isEditing={editingId === row.conditionId}
              onEdit={() => {
                setShowAdd(false);
                setDraftAdd(null);
                setEditingId(row.conditionId);
                setError(null);
              }}
              onCancel={() => setEditingId(null)}
              onSave={saveRow}
              onRemove={() => removeRow(row.conditionId)}
            />
          ))}
        </ul>
      )}

      {draftAdd && (
        <div className="rounded-lg border border-accent/30 bg-accent-soft/30 p-3 mb-3 space-y-2">
          <p className="text-[13px] font-medium">Add: {draftAdd.display}</p>
          <QualifierFields
            clinicalStatus={draftAdd.clinicalStatus}
            verification={draftAdd.verification}
            onClinicalChange={clinicalStatus => setDraftAdd({ ...draftAdd, clinicalStatus })}
            onVerificationChange={verification => setDraftAdd({ ...draftAdd, verification })}
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={saveNewProblem}
              className="px-3 py-1.5 text-[12px] bg-ink-900 text-white rounded-md disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDraftAdd(null);
                setShowAdd(false);
              }}
              className="px-3 py-1.5 text-[12px] border border-ink-100 rounded-md bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!draftAdd && (
        <div className="border-t border-ink-100 pt-3">
          {showAdd ? (
            <div>
              <p className="text-[12px] font-medium text-ink-600 mb-2">Choose a diagnosis to add</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {COMMON_DIAGNOSES.map(d => (
                  <button
                    key={d.code}
                    type="button"
                    disabled={pending || activeCodes.has(d.code)}
                    onClick={() => beginAdd(d.code)}
                    className={`px-2.5 py-1 rounded-md text-[12px] border ${
                      activeCodes.has(d.code)
                        ? 'bg-ink-50 border-ink-100 text-ink-400 cursor-not-allowed'
                        : 'bg-ink-50 border-ink-100 hover:border-ink-200'
                    }`}
                  >
                    {d.display}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="text-[12px] text-ink-500 hover:text-ink-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending || editingId !== null}
              onClick={() => {
                setEditingId(null);
                setShowAdd(true);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 text-[12px] text-info hover:underline disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add diagnosis
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-[12px] text-danger mt-3" role="alert">
          {error}
        </p>
      )}
    </>
  );

  if (embedded) return <div className="text-[13px]">{inner}</div>;

  return (
    <Card className="mb-3">
      <CardTitle icon={<ListTree className="h-4 w-4" />}>Problem list</CardTitle>
      {inner}
    </Card>
  );
}

function ProblemRow({
  row,
  pending,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onRemove,
}: {
  row: RowState;
  pending: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (row: RowState) => void;
  onRemove: () => void;
}) {
  const [local, setLocal] = useState(row);

  useEffect(() => {
    setLocal(row);
  }, [row.conditionId, row.clinicalStatus, row.verification, row.isActive]);

  useEffect(() => {
    if (!isEditing) setLocal(row);
  }, [isEditing, row]);

  if (!isEditing) {
    const qualifiers = formatDiagnosisQualifiers(row);
    return (
      <li
        className={`flex items-start justify-between gap-3 py-1.5 border-b border-ink-50 last:border-b-0 ${
          row.isActive ? '' : 'opacity-75'
        }`}
      >
        <div className="min-w-0">
          <div className="font-medium text-ink-800">{row.display}</div>
          <div className="text-[12px] text-ink-500 mt-0.5">
            {!row.isActive && <span className="text-ink-400">Inactive · </span>}
            {qualifiers}
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={onEdit}
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[12px] text-ink-600 border border-ink-100 rounded-md bg-white hover:bg-ink-50 disabled:opacity-50"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </li>
    );
  }

  const dirty =
    local.clinicalStatus !== row.clinicalStatus || local.verification !== row.verification;

  return (
    <li className="rounded-md border border-ink-200 bg-ink-50/80 p-3 my-2">
      <div className="font-medium text-[13px] mb-2">{row.display}</div>
      <QualifierFields
        clinicalStatus={local.clinicalStatus}
        verification={local.verification}
        onClinicalChange={clinicalStatus => setLocal(prev => ({ ...prev, clinicalStatus }))}
        onVerificationChange={verification => setLocal(prev => ({ ...prev, verification }))}
      />
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => onSave(local)}
          className="px-3 py-1.5 text-[12px] bg-ink-900 text-white rounded-md disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="px-3 py-1.5 text-[12px] border border-ink-100 rounded-md bg-white"
        >
          Cancel
        </button>
        {row.isActive && (
          <button
            type="button"
            disabled={pending}
            onClick={onRemove}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] text-danger border border-danger/20 rounded-md bg-danger-soft/50 hover:bg-danger-soft ml-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove from list
          </button>
        )}
      </div>
      {!row.isActive && local.clinicalStatus === 'active' && dirty && (
        <p className="text-[11px] text-ink-500 mt-2">Saving with Active status will reactivate this problem.</p>
      )}
    </li>
  );
}

function QualifierFields({
  clinicalStatus,
  verification,
  onClinicalChange,
  onVerificationChange,
}: {
  clinicalStatus: DiagnosisClinicalStatus;
  verification: DiagnosisVerification;
  onClinicalChange: (v: DiagnosisClinicalStatus) => void;
  onVerificationChange: (v: DiagnosisVerification) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className={labelClass}>Clinical status</label>
        <select
          className={inputClass}
          value={clinicalStatus}
          onChange={e => onClinicalChange(e.target.value as DiagnosisClinicalStatus)}
        >
          {CLINICAL_STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Verification</label>
        <select
          className={inputClass}
          value={verification}
          onChange={e => onVerificationChange(e.target.value as DiagnosisVerification)}
        >
          {VERIFICATION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
