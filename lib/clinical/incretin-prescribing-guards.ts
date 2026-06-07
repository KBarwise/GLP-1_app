import { HEADER_LABS } from './lab-catalog';
import { dietExercisePathwayBlockReason } from './weight-management-pathway';
import type { KioskIntakePathway } from '@/lib/kiosk/intake-types';
import type { ScreeningEvaluation } from '@/lib/screening/evaluate-prescription';
import type { Observation } from '@/lib/fhir/resources';
import { evaluateSignals, type SafetySignal } from '@/lib/signals/rules';

export const LIPASE_LOINC = HEADER_LABS.lipase.code;
export const LIPASE_CRITICAL_ULN = HEADER_LABS.lipase.critical;

function latestLipaseObservation(observations: Observation[]): Observation | undefined {
  return observations
    .filter(o => {
      const code = o.code?.coding?.[0]?.code;
      const display = (o.code?.text ?? o.code?.coding?.[0]?.display ?? '').toLowerCase();
      return code === LIPASE_LOINC || display.includes('lipase');
    })
    .sort((a, b) => (b.effectiveDateTime ?? '').localeCompare(a.effectiveDateTime ?? ''))[0];
}

export function lipasePrescribingBlockReason(observations: Observation[]): string | null {
  const lipase = latestLipaseObservation(observations);
  const value = lipase?.valueQuantity?.value;
  if (value === undefined) return null;
  if (value >= LIPASE_CRITICAL_ULN) {
    return `Lipase ${value} U/L is at or above ${LIPASE_CRITICAL_ULN} U/L (≥3× upper limit). Do not start or continue incretin therapy until reviewed.`;
  }
  return null;
}

export type IncretinPrescribingBlock = {
  blocked: boolean;
  reasons: string[];
};

export function getIncretinPrescribingBlocks(args: {
  observations: Observation[];
  signals?: SafetySignal[];
  screening?: ScreeningEvaluation;
  weightPathway?: KioskIntakePathway | null;
}): IncretinPrescribingBlock {
  const signals = args.signals ?? evaluateSignals({
    observations: args.observations,
    conditions: [],
  });
  const reasons: string[] = [];

  const pathwayReason = dietExercisePathwayBlockReason(args.weightPathway ?? null);
  if (pathwayReason) reasons.push(pathwayReason);

  const lipaseReason = lipasePrescribingBlockReason(args.observations);
  if (lipaseReason) reasons.push(lipaseReason);

  for (const signal of signals) {
    if (signal.severity !== 'red') continue;
    reasons.push(`${signal.title}: ${signal.detail}. ${signal.action}`);
  }

  if (args.screening?.overall === 'red') {
    const conditionHits = args.screening.items
      .filter(i => i.level === 'red')
      .map(i => i.label);
    if (conditionHits.length > 0) {
      reasons.push(
        `Problem-list screening: absolute contraindication (${conditionHits.join(', ')}).`,
      );
    } else {
      reasons.push('Problem-list screening: absolute contraindication detected.');
    }
  }

  const unique = [...new Set(reasons)];

  return {
    blocked: unique.length > 0,
    reasons: unique,
  };
}

export function assertIncretinPrescribingAllowed(args: {
  observations: Observation[];
  signals?: SafetySignal[];
  screening?: ScreeningEvaluation;
  weightPathway?: KioskIntakePathway | null;
}): void {
  const { blocked, reasons } = getIncretinPrescribingBlocks(args);
  if (blocked) {
    throw new Error(reasons[0] ?? 'Incretin therapy is contraindicated for this patient.');
  }
}
