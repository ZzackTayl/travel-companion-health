import type {
  GuidanceRecord,
  LaunchCoverageRequirement,
  SourceRecord,
} from "./types";
import type { GuidanceRepository } from "./service";

interface DatabaseRepositoryConfig {
  baseUrl: string;
  publicKey: string;
  adminAccessToken?: string;
}

type DatabaseRow = Record<string, unknown>;

function asDate(value: unknown) {
  return typeof value === "string" ? new Date(value) : null;
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

export class DatabaseGuidanceRepository implements GuidanceRepository {
  private readonly baseUrl: string;

  constructor(private readonly config: DatabaseRepositoryConfig) {
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
    headers.set("Content-Type", "application/json");

    const response = await fetch(`${this.baseUrl}/rest/v1/${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Guidance database request failed (${response.status})`);
    }

    if (response.status === 204) return null;
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
