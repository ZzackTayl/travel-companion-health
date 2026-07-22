import { z } from "zod";
import type {
  GuidanceRecord,
  LaunchCoverageRequirement,
  PublicGuidanceRecord,
  PublicGuidanceRequirement,
  SourceRecord,
} from "./types";
import {
  confidenceLevels,
  guidanceTypes,
  riskLabels,
  sourceTypes,
} from "./types";
import type { GuidanceRepository, PublicGuidanceRepository } from "./service";

export interface DatabaseRepositoryConfig {
  baseUrl: string;
  publicKey: string;
  adminAccessToken?: string;
  timeoutMs?: number;
}

type DatabaseRow = Record<string, unknown>;

const dateStringSchema = z
  .string()
  .refine(
    (value) => !Number.isNaN(new Date(value).getTime()),
    "Expected a valid date",
  );

const publicSourceSchema = z.object({
  id: z.string().min(1),
  url: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === "https:"),
  title: z.string().trim().min(1),
  sourceType: z.enum(sourceTypes),
  qualityTier: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]),
  excerpt: z.string().trim().min(20),
  accessedAt: dateStringSchema,
  lastVerifiedAt: dateStringSchema,
  supportsSummary: z.literal(true),
});

const publicGuidanceSchema = z.object({
  id: z.string().min(1),
  jurisdiction_id: z.string().min(1),
  jurisdiction_type: z.enum(["country", "airport_authority"]),
  jurisdiction_code: z.string().trim().min(1),
  medication_category_id: z.string().nullable(),
  medication_category_slug: z.string().trim().min(1).nullable(),
  guidance_type: z.enum(guidanceTypes),
  risk_label: z.enum(riskLabels),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  action_text: z.string().trim().min(1),
  applies_to_transit: z.boolean(),
  effective_from: dateStringSchema.nullable(),
  effective_to: dateStringSchema.nullable(),
  status: z.literal("published"),
  confidence: z.enum(confidenceLevels),
  last_reviewed_at: dateStringSchema,
  stale_after: dateStringSchema,
  reviewed_for_publication: z.literal(true),
  lower_tier_evidence_approved: z.boolean(),
  sources: z.array(publicSourceSchema).min(1),
});

function asDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapSource(row: DatabaseRow, guidanceRecordId: string): SourceRecord {
  return {
    id: String(row.id),
    guidanceRecordId,
    url: String(row.url),
    title: String(row.title),
    sourceType: (row.sourceType ??
      row.source_type) as SourceRecord["sourceType"],
    qualityTier: Number(
      row.qualityTier ?? row.quality_tier,
    ) as SourceRecord["qualityTier"],
    excerpt: String(row.excerpt),
    accessedAt: asDate(row.accessedAt ?? row.accessed_at) ?? new Date(0),
    lastVerifiedAt: asDate(row.lastVerifiedAt ?? row.last_verified_at),
    supportsSummary: Boolean(row.supportsSummary ?? row.supports_summary),
  };
}

function mapGuidance(row: DatabaseRow): GuidanceRecord {
  const id = String(row.id);
  const sourceRows = (
    Array.isArray(row.sources)
      ? row.sources
      : Array.isArray(row.source_records)
        ? row.source_records
        : []
  ) as DatabaseRow[];

  return {
    id,
    jurisdictionId: String(row.jurisdiction_id),
    medicationCategoryId:
      typeof row.medication_category_id === "string"
        ? row.medication_category_id
        : null,
    guidanceType: row.guidance_type as GuidanceRecord["guidanceType"],
    riskLabel: row.risk_label as GuidanceRecord["riskLabel"],
    title: String(row.title),
    summary: String(row.summary),
    actionText: String(row.action_text),
    appliesToTransit: Boolean(row.applies_to_transit),
    effectiveFrom: asDate(row.effective_from),
    effectiveTo: asDate(row.effective_to),
    status: row.status as GuidanceRecord["status"],
    confidence: row.confidence as GuidanceRecord["confidence"],
    lastReviewedAt: asDate(row.last_reviewed_at),
    staleAfter: asDate(row.stale_after),
    reviewerId: typeof row.reviewer_id === "string" ? row.reviewer_id : null,
    lowerTierEvidenceApprovedAt: asDate(row.lower_tier_evidence_approved_at),
    lowerTierEvidenceApprovedBy:
      typeof row.lower_tier_evidence_approved_by === "string"
        ? row.lower_tier_evidence_approved_by
        : null,
    lowerTierEvidenceReason:
      typeof row.lower_tier_evidence_reason === "string"
        ? row.lower_tier_evidence_reason
        : null,
    reviewedForPublication: Boolean(row.reviewed_for_publication),
    lowerTierEvidenceApproved: Boolean(row.lower_tier_evidence_approved),
    unresolvedQuestions: Array.isArray(row.unresolved_questions)
      ? row.unresolved_questions.map(String)
      : [],
    sources: sourceRows.map((source) => mapSource(source, id)),
  };
}

function mapPublicGuidance(
  row: z.infer<typeof publicGuidanceSchema>,
): PublicGuidanceRecord {
  const mapped = mapGuidance(row);
  return {
    ...mapped,
    jurisdictionType: row.jurisdiction_type,
    jurisdictionCode: row.jurisdiction_code,
    medicationCategorySlug: row.medication_category_slug,
  };
}

function mapRequirement(row: DatabaseRow): LaunchCoverageRequirement {
  return {
    id: String(row.id),
    jurisdictionId: String(row.jurisdiction_id),
    medicationCategoryId:
      typeof row.medication_category_id === "string"
        ? row.medication_category_id
        : null,
    guidanceType:
      row.guidance_type as LaunchCoverageRequirement["guidanceType"],
    label: String(row.label),
    requiredAtLaunch: Boolean(row.required_at_launch),
  };
}

function serializeGuidance(record: GuidanceRecord) {
  return {
    jurisdiction_id: record.jurisdictionId,
    medication_category_id: record.medicationCategoryId,
    guidance_type: record.guidanceType,
    risk_label: record.riskLabel,
    title: record.title,
    summary: record.summary,
    action_text: record.actionText,
    applies_to_transit: record.appliesToTransit,
    effective_from: record.effectiveFrom?.toISOString() ?? null,
    effective_to: record.effectiveTo?.toISOString() ?? null,
    status: record.status,
    confidence: record.confidence,
    last_reviewed_at: record.lastReviewedAt?.toISOString() ?? null,
    stale_after: record.staleAfter?.toISOString() ?? null,
    reviewer_id: record.reviewerId,
    lower_tier_evidence_approved_at:
      record.lowerTierEvidenceApprovedAt?.toISOString() ?? null,
    lower_tier_evidence_approved_by: record.lowerTierEvidenceApprovedBy,
    lower_tier_evidence_reason: record.lowerTierEvidenceReason,
    unresolved_questions: record.unresolvedQuestions,
  };
}

export class GuidanceDatabaseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GuidanceDatabaseError";
  }
}

export class DatabaseGuidanceRepository
  implements GuidanceRepository, PublicGuidanceRepository
{
  private readonly baseUrl: string;

  constructor(private readonly config: DatabaseRepositoryConfig) {
    let databaseUrl: URL;
    try {
      databaseUrl = new URL(config.baseUrl);
    } catch {
      throw new GuidanceDatabaseError("Guidance database URL is invalid");
    }
    const isLoopback =
      databaseUrl.hostname === "localhost" ||
      databaseUrl.hostname === "127.0.0.1" ||
      databaseUrl.hostname === "[::1]";
    if (
      databaseUrl.protocol !== "https:" &&
      !(databaseUrl.protocol === "http:" && isLoopback)
    ) {
      throw new GuidanceDatabaseError("Guidance database URL is invalid");
    }
    if (
      databaseUrl.username ||
      databaseUrl.password ||
      databaseUrl.search ||
      databaseUrl.hash
    ) {
      throw new GuidanceDatabaseError("Guidance database URL is invalid");
    }
    if (!config.publicKey.trim()) {
      throw new GuidanceDatabaseError("Guidance database key is missing");
    }
    this.baseUrl = databaseUrl.toString().replace(/\/$/, "");
  }

  private async request(
    path: string,
    options: RequestInit = {},
    admin = false,
  ) {
    const accessToken = admin
      ? this.config.adminAccessToken
      : this.config.publicKey;
    if (!accessToken) {
      throw new GuidanceDatabaseError(
        "An authenticated admin access token is required",
      );
    }

    const headers = new Headers(options.headers);
    headers.set("apikey", this.config.publicKey);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Content-Type", "application/json");

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/rest/v1/${path}`, {
        ...options,
        headers,
        cache: "no-store",
        signal:
          options.signal ?? AbortSignal.timeout(this.config.timeoutMs ?? 5_000),
      });
    } catch (error) {
      throw new GuidanceDatabaseError("Guidance database request failed", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new GuidanceDatabaseError(
        `Guidance database request failed (${response.status})`,
      );
    }

    if (response.status === 204) return null;
    try {
      return await response.json();
    } catch (error) {
      throw new GuidanceDatabaseError(
        "Guidance database returned an invalid response",
        { cause: error },
      );
    }
  }

  async getGuidanceForRoute(requirements: PublicGuidanceRequirement[]) {
    if (requirements.length === 0) return [];
    const payload = await this.request("rpc/get_public_guidance_for_route", {
      method: "POST",
      body: JSON.stringify({
        p_requirements: requirements,
      }),
    });
    const parsed = z.array(publicGuidanceSchema).safeParse(payload);
    if (!parsed.success) {
      throw new GuidanceDatabaseError(
        "Guidance database returned an invalid response",
        { cause: parsed.error },
      );
    }
    return parsed.data.map(mapPublicGuidance);
  }

  async getGuidanceForCoverage(requirements: LaunchCoverageRequirement[]) {
    if (requirements.length === 0) return [];
    const jurisdictionIds = [
      ...new Set(requirements.map(({ jurisdictionId }) => jurisdictionId)),
    ];
    const filter = encodeURIComponent(`(${jurisdictionIds.join(",")})`);
    const select = encodeURIComponent("*,source_records(*)");
    const rows = (await this.request(
      `guidance_records?select=${select}&jurisdiction_id=in.${filter}`,
      {},
      true,
    )) as DatabaseRow[];
    return rows.map(mapGuidance);
  }

  async listLaunchCoverageRequirements() {
    const rows = (await this.request(
      "launch_coverage_requirements?required_at_launch=eq.true",
      {},
      true,
    )) as DatabaseRow[];
    return rows.map(mapRequirement);
  }

  async savePublished(record: GuidanceRecord) {
    const rows = (await this.request(
      "rpc/publish_guidance",
      {
        method: "POST",
        body: JSON.stringify({ p_guidance_id: record.id }),
      },
      true,
    )) as DatabaseRow[];
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error("Guidance publication did not update exactly one record");
    }
  }

  async createDraft(record: GuidanceRecord) {
    const body = {
      id: record.id,
      ...serializeGuidance(record),
      status: "draft",
    };
    await this.request(
      "guidance_records",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { Prefer: "return=minimal" },
      },
      true,
    );
  }

  async addEvidenceSource(source: SourceRecord) {
    await this.request(
      "source_records",
      {
        method: "POST",
        body: JSON.stringify({
          id: source.id,
          guidance_record_id: source.guidanceRecordId,
          url: source.url,
          title: source.title,
          source_type: source.sourceType,
          quality_tier: source.qualityTier,
          excerpt: source.excerpt,
          accessed_at: source.accessedAt.toISOString(),
          last_verified_at: source.lastVerifiedAt?.toISOString() ?? null,
          supports_summary: source.supportsSummary,
        }),
        headers: { Prefer: "return=minimal" },
      },
      true,
    );
  }

  async approveLowerTierEvidence(guidanceRecordId: string, reason: string) {
    await this.request(
      "rpc/approve_lower_tier_evidence",
      {
        method: "POST",
        body: JSON.stringify({
          p_guidance_id: guidanceRecordId,
          p_reason: reason,
        }),
      },
      true,
    );
  }

  async submitForReview(guidanceRecordId: string) {
    await this.request(
      "rpc/submit_guidance_for_review",
      {
        method: "POST",
        body: JSON.stringify({ p_guidance_id: guidanceRecordId }),
      },
      true,
    );
  }

  async archiveGuidance(guidanceRecordId: string, reason: string) {
    if (!reason.trim()) {
      throw new GuidanceDatabaseError("Archiving guidance requires a reason");
    }
    await this.request(
      "rpc/archive_guidance",
      {
        method: "POST",
        body: JSON.stringify({
          p_guidance_id: guidanceRecordId,
          p_reason: reason,
        }),
      },
      true,
    );
  }

  async setPublicEvaluationEnabled(enabled: boolean, reason: string) {
    if (!reason.trim()) {
      throw new GuidanceDatabaseError(
        "Changing public guidance availability requires a reason",
      );
    }
    await this.request(
      "rpc/set_guidance_public_evaluation_enabled",
      {
        method: "POST",
        body: JSON.stringify({
          p_enabled: enabled,
          p_reason: reason,
        }),
      },
      true,
    );
  }
}
