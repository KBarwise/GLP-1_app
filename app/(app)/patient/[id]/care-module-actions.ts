'use server';

import { revalidatePath } from 'next/cache';
import { canViewClinicalData } from '@/lib/clinic/access';
import { getActingRoleFromCookie } from '@/lib/clinic/server-role';
import { LAB_PANELS } from '@/lib/clinical/lab-catalog';
import {
  careModuleAllowsRole,
  getCareModuleTemplateId,
  type CareModuleId,
} from '@/lib/ehr/care-modules';
import { clinicalFhir } from '@/lib/fhir/client';
import {
  buildEncounter,
  buildObservationString,
  buildServiceRequest,
} from '@/lib/fhir/builders';

export type SoapEncounterInput = {
  patientId: string;
  careModuleId: CareModuleId;
  appointmentId?: string;
  reason: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  /** Antenatal: gestational age in weeks. */
  gestationalWeeks?: string;
};

export type LabRequestInput = {
  patientId: string;
  appointmentId?: string;
  reason: string;
  labPanels: string[];
};

function assertCareModuleWrite(moduleId: CareModuleId): void {
  const role = getActingRoleFromCookie();
  if (!canViewClinicalData(role)) {
    throw new Error('Clinical documentation is not available in this role.');
  }
  if (!careModuleAllowsRole(moduleId, role)) {
    throw new Error('Your role cannot document in this care module.');
  }
}

function revalidateCareModule(patientId: string, moduleId: CareModuleId) {
  revalidatePath(`/patient/${patientId}`);
  revalidatePath(`/patient/${patientId}/care/${moduleId}`);
}

async function writeSoapSections(
  patientId: string,
  templateId: string,
  sections: Array<{ loinc: string; display: string; value?: string }>,
): Promise<number> {
  let count = 0;
  for (const section of sections) {
    const value = section.value?.trim();
    if (!value) continue;
    await clinicalFhir.create('Observation', buildObservationString({
      patientId,
      loinc: section.loinc,
      display: section.display,
      value,
      category: 'survey',
      openEhrTemplateId: templateId,
    }));
    count += 1;
  }
  return count;
}

/** Submit antenatal, gynaecology, or other SOAP-style care module encounters. */
export async function submitSoapCareModule(
  args: SoapEncounterInput,
): Promise<{ encounterId?: string; resources: number }> {
  assertCareModuleWrite(args.careModuleId);
  const templateId = getCareModuleTemplateId(args.careModuleId);

  const encounter = await clinicalFhir.create('Encounter', buildEncounter({
    patientId: args.patientId,
    reason: args.reason,
    openEhrTemplateId: templateId,
  }));
  const encounterId = (encounter as { id?: string }).id;
  let count = 1;

  const sections: Array<{ loinc: string; display: string; value?: string }> = [
    { loinc: '8661-1', display: 'Chief complaint', value: args.reason },
    { loinc: '61150-9', display: 'Subjective narrative', value: args.subjective },
    { loinc: '61149-1', display: 'Objective narrative', value: args.objective },
    { loinc: '51848-0', display: 'Assessment', value: args.assessment },
    { loinc: '18776-5', display: 'Plan of care', value: args.plan },
  ];

  if (args.careModuleId === 'antenatal' && args.gestationalWeeks?.trim()) {
    sections.push({
      loinc: '11884-4',
      display: 'Gestational age',
      value: `${args.gestationalWeeks.trim()} weeks`,
    });
  }

  count += await writeSoapSections(args.patientId, templateId, sections);
  revalidateCareModule(args.patientId, args.careModuleId);
  return { encounterId, resources: count };
}

/** Submit laboratory test orders using the lab request care module template. */
export async function submitLabRequestModule(
  args: LabRequestInput,
): Promise<{ encounterId?: string; orders: number }> {
  assertCareModuleWrite('lab-request');
  const templateId = getCareModuleTemplateId('lab-request');

  const encounter = await clinicalFhir.create('Encounter', buildEncounter({
    patientId: args.patientId,
    reason: args.reason,
    openEhrTemplateId: templateId,
  }));
  const encounterId = (encounter as { id?: string }).id;
  let orders = 0;

  for (const panelId of args.labPanels) {
    const panel = LAB_PANELS.find(p => p.id === panelId);
    if (!panel) continue;
    await clinicalFhir.create('ServiceRequest', buildServiceRequest({
      patientId: args.patientId,
      loinc: panel.code,
      display: panel.codingDisplay,
      encounterId,
      openEhrTemplateId: templateId,
    }));
    orders += 1;
  }

  revalidateCareModule(args.patientId, 'lab-request');
  return { encounterId, orders };
}
