/**
 * Narrow FHIR R4 types limited to what this app actually reads or writes.
 * Avoids pulling in the full FHIR TypeScript types which are unwieldy.
 */

export type Coding = {
  system?: string;
  code?: string;
  display?: string;
  version?: string;
};

export type CodeableConcept = {
  coding?: Coding[];
  text?: string;
};

export type Quantity = {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
};

export type Reference = {
  reference?: string;
  display?: string;
  type?: string;
};

export type Period = { start?: string; end?: string };

export type Identifier = {
  use?: string;
  system?: string;
  value?: string;
  type?: CodeableConcept;
};

export type Bundle<T = unknown> = {
  resourceType: 'Bundle';
  type: string;
  total?: number;
  entry?: Array<{ fullUrl?: string; resource?: T }>;
  link?: Array<{ relation: string; url: string }>;
};

export type Extension = {
  url: string;
  valueCode?: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueCodeableConcept?: CodeableConcept;
  valueCoding?: Coding;
  extension?: Extension[];
};

export type Patient = {
  resourceType: 'Patient';
  id?: string;
  meta?: { profile?: string[] };
  active?: boolean;
  identifier?: Identifier[];
  name?: Array<{ family?: string; given?: string[]; use?: string; suffix?: string[] }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  address?: Array<{
    use?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  extension?: Extension[];
};

export type Condition = {
  resourceType: 'Condition';
  id?: string;
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  category?: CodeableConcept[];
  code?: CodeableConcept;
  subject: Reference;
  onsetDateTime?: string;
  recordedDate?: string;
  severity?: CodeableConcept;
};

export type Meta = {
  tag?: Array<{ system?: string; code?: string; display?: string }>;
  profile?: string[];
};

export type Observation = {
  resourceType: 'Observation';
  id?: string;
  meta?: Meta;
  extension?: Extension[];
  status:
    | 'registered'
    | 'preliminary'
    | 'final'
    | 'amended'
    | 'corrected'
    | 'cancelled'
    | 'entered-in-error';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  issued?: string;
  encounter?: Reference;
  performer?: Reference[];
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  referenceRange?: Array<{
    low?: Quantity;
    high?: Quantity;
    text?: string;
  }>;
  component?: Array<{
    code: CodeableConcept;
    valueQuantity?: Quantity;
    interpretation?: CodeableConcept[];
    referenceRange?: Array<{
      low?: Quantity;
      high?: Quantity;
    }>;
  }>;
};

export type MedicationRequest = {
  resourceType: 'MedicationRequest';
  id?: string;
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'stopped' | 'draft' | 'entered-in-error';
  intent: 'proposal' | 'plan' | 'order' | 'original-order';
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  medicationCodeableConcept?: CodeableConcept;
  subject: Reference;
  authoredOn?: string;
  requester?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  note?: Array<{ text?: string }>;
  dosageInstruction?: Array<{
    text?: string;
    timing?: {
      repeat?: { frequency?: number; period?: number; periodUnit?: string };
    };
    route?: CodeableConcept;
    doseAndRate?: Array<{ doseQuantity?: Quantity }>;
  }>;
  dispenseRequest?: {
    numberOfRepeatsAllowed?: number;
    quantity?: Quantity;
  };
};

export type Flag = {
  resourceType: 'Flag';
  id?: string;
  status: 'active' | 'inactive' | 'entered-in-error';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject: Reference;
  period?: Period;
  encounter?: Reference;
  author?: Reference;
};

export type CarePlan = {
  resourceType: 'CarePlan';
  id?: string;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'option';
  category?: CodeableConcept[];
  title?: string;
  subject: Reference;
  period?: Period;
  instantiatesCanonical?: string[];
  activity?: Array<{
    detail?: {
      code?: CodeableConcept;
      status: string;
      scheduledTiming?: unknown;
      description?: string;
    };
  }>;
};

export type ValueSet = {
  resourceType: 'ValueSet';
  url?: string;
  version?: string;
  name?: string;
  status?: string;
  expansion?: {
    timestamp?: string;
    total?: number;
    contains?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
};

export type ServiceRequest = {
  resourceType: 'ServiceRequest';
  id?: string;
  meta?: Meta;
  extension?: Extension[];
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'original-order';
  code: CodeableConcept;
  subject: Reference;
  authoredOn?: string;
  reasonCode?: CodeableConcept[];
  encounter?: Reference;
};

export type Encounter = {
  resourceType: 'Encounter';
  id?: string;
  meta?: Meta;
  extension?: Extension[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
  class: Coding;
  subject: Reference;
  period?: Period;
  reasonCode?: CodeableConcept[];
};

export type Appointment = {
  resourceType: 'Appointment';
  id?: string;
  status: 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'entered-in-error';
  appointmentType?: CodeableConcept;
  description?: string;
  start?: string;
  end?: string;
  created?: string;
  extension?: Extension[];
  participant: Array<{
    actor?: Reference;
    status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
    required?: 'required' | 'optional' | 'information-only';
  }>;
};

export type Practitioner = {
  resourceType: 'Practitioner';
  id?: string;
  active?: boolean;
  identifier?: Identifier[];
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
  }>;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  qualification?: Array<{ code?: CodeableConcept }>;
};

export type Basic = {
  resourceType: 'Basic';
  id?: string;
  identifier?: Identifier[];
  code?: CodeableConcept;
  subject?: Reference;
  created?: string;
  extension?: Extension[];
};

export type Parameters = {
  resourceType: 'Parameters';
  parameter?: Array<{
    name: string;
    valueBoolean?: boolean;
    valueString?: string;
    valueCode?: string;
    valueCoding?: Coding;
    resource?: unknown;
  }>;
};
