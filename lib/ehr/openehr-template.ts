import type { Extension } from '@/lib/fhir/resources';

/** FHIR extension carrying the EHRbase openEHR template id for bridge mapping. */
export const OPENEHR_TEMPLATE_EXTENSION_URL =
  'http://codemuse.local/StructureDefinition/openehr-template-id';

export const OPENEHR_TEMPLATE_TAG_SYSTEM =
  'http://codemuse.local/fhir/CodeSystem/openehr-template';

type MetaTag = { system?: string; code?: string; display?: string };

type TemplatableResource = {
  meta?: { tag?: MetaTag[] };
  extension?: Extension[];
};

/** Attach openEHR template id to a FHIR resource (extension + meta.tag). */
export function withOpenEhrTemplate<T extends TemplatableResource>(
  resource: T,
  templateId: string,
): T {
  const tags = (resource.meta?.tag ?? []).filter(t => t.system !== OPENEHR_TEMPLATE_TAG_SYSTEM);
  const extensions = (resource.extension ?? []).filter(e => e.url !== OPENEHR_TEMPLATE_EXTENSION_URL);

  return {
    ...resource,
    meta: {
      ...resource.meta,
      tag: [...tags, { system: OPENEHR_TEMPLATE_TAG_SYSTEM, code: templateId, display: templateId }],
    },
    extension: [
      ...extensions,
      { url: OPENEHR_TEMPLATE_EXTENSION_URL, valueString: templateId },
    ],
  };
}

export function openEhrTemplateFromResource(resource: TemplatableResource): string | undefined {
  const ext = resource.extension?.find(e => e.url === OPENEHR_TEMPLATE_EXTENSION_URL);
  if (ext?.valueString?.trim()) return ext.valueString.trim();
  const tag = resource.meta?.tag?.find(t => t.system === OPENEHR_TEMPLATE_TAG_SYSTEM);
  return tag?.code?.trim() || tag?.display?.trim() || undefined;
}
