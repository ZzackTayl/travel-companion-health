import {
  confidenceLevels,
  contentStatuses,
  guidanceTypes,
  riskLabels,
  sourceTypes,
  type Confidence,
  type ContentStatus,
  type GuidanceType,
  type GuidanceRecord,
  type LaunchCoverageRequirement,
  type RiskLabel,
  type SourceRecord,
  type SourceType,
} from "./types";
import type { GuidanceRepository } from "./service";

interface DatabaseRepositoryConfig {
  baseUrl: string;
  publicKey: string;
  adminAccessToken?: string;
}

type DatabaseRow = Record<string, unknown>;

function asDate(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Expected a date string");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid database date");
  return date;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid database field: ${field}`);
  }
  return value;
}

function requiredBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid database field: ${field}`);
  }
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
) {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`Invalid database field: ${field}`);
  }
  return value as T;
}

function mapSource(row: DatabaseRow, guidanceRecordId: string): SourceRecord {
  return {
    id: requiredString(row.id, "source.id"),
    guidanceRecordId,
    url: requiredString(row.url, "source.url"),
    title: requiredString(row.title, "source.title"),
    sourceType: enumValue<SourceType>(
      row.sourceType ?? row.source_type,
      sourceTypes,
      "source.source_type",
    ),
    qualityTier: (() => {
      const value = row.qualityTier ?? row.quality_tier;
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > 4
      ) {
        throw new Error("Invalid database field: source.quality_tier");
      }
      return value as SourceRecord["qualityTier"];
    })(),
    excerpt: requiredString(row.excerpt, "source.excerpt"),
    accessedAt:
      asDate(row.accessedAt ?? row.accessed_at) ??
      (() => {
        throw new Error("Invalid database field: source.accessed_at");
      })(),
    lastVerifiedAt: asDate(row.lastVerifiedAt ?? row.last_verified_at),
    supportsSummary: requiredBoolean(
      row.supportsSummary ?? row.supports_summary,
      "source.supports_summary",
    ),
  };
}

function mapGuidance(row: DatabaseRow): GuidanceRecord {
  const id = requiredString(row.id, "guidance.id");
  const sourceRows = (
    Array.isArray(row.sources)
      ? row.sources
      : Array.isArray(row.source_records)
        ? row.source_records
        : []
  ) as DatabaseRow[];

  return {
    id,
    jurisdictionId: requiredString(
      row.jurisdiction_id,
      "guidance.jurisdiction_id",
    ),
    medicationCategoryId:
      typeof row.medication_category_id === "string"
        ? row.medication_category_id
        : null,
    guidanceType: enumValue<GuidanceType>(
      row.guidance_type,
      guidanceTypes,
      "guidance.guidance_type",
    ),
    riskLabel: enumValue<RiskLabel>(
      row.risk_label,
      riskLabels,
      "guidance.risk_label",
    ),
    title: requiredString(row.title, "guidance.title"),
    summary: requiredString(row.summary, "guidance.summary"),
    actionText: requiredString(row.action_text, "guidance.action_text"),
    appliesToTransit: requiredBoolean(
      row.applies_to_transit,
      "guidance.applies_to_transit",
    ),
    effectiveFrom: asDate(row.effective_from),
    effectiveTo: asDate(row.effective_to),
    status: enumValue<ContentStatus>(
      row.status,
      contentStatuses,
      "guidance.status",
    ),
    confidence: enumValue<Confidence>(
      row.confidence,
      confidenceLevels,
      "guidance.confidence",
    ),
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
    reviewedForPublication:
      row.reviewed_for_publication === undefined
        ? undefined
        : requiredBoolean(
            row.reviewed_for_publication,
            "guidance.reviewed_for_publication",
          ),
    lowerTierEvidenceApproved:
      row.lower_tier_evidence_approved === undefined
        ? undefined
        : requiredBoolean(
            row.lower_tier_evidence_approved,
            "guidance.lower_tier_evidence_approved",
          ),
    unresolvedQuestions: Array.isArray(row.unresolved_questions)
      ? row.unresolved_questions.map(String)
      : [],
    sources: sourceRows.map((source) => mapSource(source, id)),
  };
}

function mapRequirement(row: DatabaseRow): LaunchCoverageRequirement {
  return {
    id: requiredString(row.id, "coverage.id"),
    jurisdictionId: requiredString(
      row.jurisdiction_id,
      "coverage.jurisdiction_id",
    ),
    medicationCategoryId:
      typeof row.medication_category_id === "string"
        ? row.medication_category_id
        : null,
    guidanceType: enumValue<GuidanceType>(
      row.guidance_type,
      guidanceTypes,
      "coverage.guidance_type",
    ),
    label: requiredString(row.label, "coverage.label"),
    requiredAtLaunch: requiredBoolean(
      row.required_at_launch,
      "coverage.required_at_launch",
    ),
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

export class DatabaseGuidanceRepository implements GuidanceRepository {
  private readonly baseUrl: string;

  constructor(private readonly config: DatabaseRepositoryConfig) {
    const url = new URL(config.baseUrl);
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    ) {
      throw new Error("Guidance database URL must use HTTPS");
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
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
      throw new Error("An authenticated admin access token is required");
    }

    const headers = new Headers(options.headers);
    headers.set("apikey", this.config.publicKey);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", "application/json");
    if (options.body) headers.set("Content-Type", "application/json");

    const response = await fetch(`${this.baseUrl}/rest/v1/${path}`, {
      ...options,
      headers,
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`Guidance database request failed (${response.status})`);
    }

    if (response.status === 204) return null;
    if (
      !(response.headers.get("content-type") ?? "").includes("application/json")
    ) {
      throw new Error("Guidance database returned an unreadable response");
    }
    return response.json();
  }

  async getGuidanceForRequirements(requirements: LaunchCoverageRequirement[]) {
    if (requirements.length === 0) return [];
    const jurisdictionIds = [
      ...new Set(requirements.map(({ jurisdictionId }) => jurisdictionId)),
    ];
    const filter = encodeURIComponent(`(${jurisdictionIds.join(",")})`);
    const rows = (await this.request(
      `public_guidance_records?jurisdiction_id=in.${filter}`,
    )) as DatabaseRow[];
    return rows.map(mapGuidance);
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

  async getGuidanceById(id: string) {
    const rows = (await this.request(
      `public_guidance_records?id=eq.${encodeURIComponent(id)}&limit=1`,
    )) as DatabaseRow[];
    return rows[0] ? mapGuidance(rows[0]) : null;
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

  async archiveGuidance(guidanceRecordId: string) {
    await this.request(
      "rpc/archive_guidance",
      {
        method: "POST",
        body: JSON.stringify({ p_guidance_id: guidanceRecordId }),
      },
      true,
    );
  }
}
