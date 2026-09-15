import * as z from 'zod/v4';

import {
  EvidenceSchema,
  ExcerptSchema,
  MaintenanceRecordSchema,
  PatternSchema,
  PriorCaseSchema,
  RecentAnomaliesSchema,
  SourceMetadataSchema
} from './adapters/adapterValidation.js';
import { AdvisoryPacketRecordSchema } from './schema.js';

const MAX_ID = 256;
const MAX_TEXT = 8000;

const emptyObject = z.strictObject({});

export const SearchMaintenanceRecordsOutputSchema = z.strictObject({
  query: z.record(z.string(), z.unknown()),
  count: z.number().int().nonnegative().max(100),
  records: z.array(MaintenanceRecordSchema).max(100)
});

export const EquipmentHistoryOutputSchema = z.strictObject({
  equipment_id: z.string().min(1).max(MAX_ID),
  history: z.array(MaintenanceRecordSchema).max(100)
});

export const RecentAnomaliesOutputSchema = RecentAnomaliesSchema;

export const RecurringPatternsOutputSchema = z.strictObject({
  equipment_id: z.string().min(1).max(MAX_ID).optional(),
  component: z.string().min(1).max(MAX_ID).optional(),
  patterns: z.array(PatternSchema).max(100)
});

export const SourceMetadataOutputSchema = z.strictObject({
  source: SourceMetadataSchema
});

export const SupportingEvidenceOutputSchema = z.strictObject({
  criteria: z.record(z.string(), z.unknown()),
  evidence: z.array(EvidenceSchema).max(100)
});

export const DocumentExcerptOutputSchema = z.strictObject({
  excerpt: ExcerptSchema
});

export const PriorCasesOutputSchema = z.strictObject({
  cases: z.array(PriorCaseSchema).max(100)
});

export const AnomalyContextOutputSchema = z.strictObject({
  record: MaintenanceRecordSchema,
  source: SourceMetadataSchema.nullable(),
  evidence: z.array(EvidenceSchema).max(100),
  prior_cases: z.array(PriorCaseSchema).max(100)
});

export const EvidenceBoundaryOutputSchema = z.record(z.string().max(MAX_ID), z.unknown());

export const SubmitAdvisoryPacketOutputSchema = z.strictObject({
  status: z.literal('stored'),
  assessment: z.record(z.string().max(MAX_ID), z.unknown()),
  packet: AdvisoryPacketRecordSchema
});

export const EmptyOutputSchema = emptyObject;

export const ToolAnnotations = {
  readOnly: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  write: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
} as const;

export const boundedId = () => z.string().min(1).max(MAX_ID);
export const boundedText = (max = MAX_TEXT) => z.string().min(1).max(max);
export const optionalBoundedText = (max = MAX_TEXT) => z.string().max(max).optional();
