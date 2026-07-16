import type { Airport } from "@/lib/airports";

export const medicationCategories = [
  { value: "controlled", label: "Controlled substance" },
  { value: "stimulant", label: "ADHD stimulant" },
  { value: "opioid", label: "Opioid" },
  { value: "sedative", label: "Sedative or anxiety medicine" },
  { value: "sleep", label: "Sleep medicine" },
  { value: "pseudoephedrine", label: "Pseudoephedrine" },
  { value: "cannabis", label: "Cannabis-derived product" },
  { value: "injectable", label: "Injectable" },
  { value: "liquid", label: "Liquid over 100 mL" },
  { value: "refrigerated", label: "Needs refrigeration" },
  { value: "sharps", label: "Needles or sharps" },
  { value: "device", label: "Medical device" },
  { value: "unknown", label: "Not sure" },
] as const;

export type MedicationCategory = (typeof medicationCategories)[number]["value"];

export type RiskLevel =
  | "likely_ok"
  | "check_documentation"
  | "prior_permission"
  | "high_risk"
  | "unknown";

export type GuidanceResult = {
  airport: Airport;
  transitOnly: boolean;
  risk: RiskLevel;
  actions: string[];
  confidence: "High" | "Moderate";
  reviewedAt: string;
  source: {
    title: string;
    url: string;
  };
};

export type Evaluation = {
  overallRisk: RiskLevel;
  results: GuidanceResult[];
  generatedAt: string;
};

export const riskContent: Record<
  RiskLevel,
  { label: string; description: string; styles: string }
> = {
  likely_ok: {
    label: "Likely OK",
    description:
      "No major issue found in reviewed guidance. Still carry documents and verify if your medicine is high-risk.",
    styles: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  },
  check_documentation: {
    label: "Check documentation",
    description:
      "Bring prescription copies, original packaging, or a doctor letter.",
    styles: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  },
  prior_permission: {
    label: "Prior permission may be required",
    description: "Check official requirements before travel.",
    styles: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  },
  high_risk: {
    label: "High risk",
    description:
      "Do not travel with this item until you verify official rules.",
    styles: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  },
  unknown: {
    label: "Unknown",
    description:
      "We could not verify this confidently. Check official sources before travel.",
    styles: "border-slate-300/30 bg-slate-300/10 text-slate-100",
  },
};

const officialSources: Record<
  string,
  { title: string; url: string; reviewedAt: string }
> = {
  US: {
    title: "U.S. Transportation Security Administration",
    url: "https://www.tsa.gov/travel/security-screening/whatcanibring/medical",
    reviewedAt: "2026-06-15",
  },
  GB: {
    title: "UK Government: travelling with medicine",
    url: "https://www.gov.uk/travelling-controlled-drugs",
    reviewedAt: "2026-06-12",
  },
  FR: {
    title: "France Diplomacy: health advice",
    url: "https://www.diplomatie.gouv.fr/en/coming-to-france/",
    reviewedAt: "2026-05-28",
  },
  IT: {
    title: "Italian Ministry of Health",
    url: "https://www.salute.gov.it/",
    reviewedAt: "2026-05-28",
  },
  AE: {
    title: "UAE Ministry of Health: controlled medicines",
    url: "https://mohap.gov.ae/en/services/issue-of-permit-to-import-medicines-for-personal-use",
    reviewedAt: "2026-06-18",
  },
  JP: {
    title: "Japan Ministry of Health: medicines for personal use",
    url: "https://www.mhlw.go.jp/english/policy/health-medical/pharmaceuticals/01.html",
    reviewedAt: "2026-06-08",
  },
  CA: {
    title: "Government of Canada: travelling with medication",
    url: "https://travel.gc.ca/travelling/health-safety/medication",
    reviewedAt: "2026-06-04",
  },
};

const riskRank: Record<RiskLevel, number> = {
  likely_ok: 0,
  check_documentation: 1,
  unknown: 2,
  prior_permission: 3,
  high_risk: 4,
};

function getRisk(
  countryCode: string,
  categories: MedicationCategory[],
): RiskLevel {
  if (categories.includes("cannabis") && ["AE", "JP"].includes(countryCode)) {
    return "high_risk";
  }

  if (categories.includes("unknown")) {
    return "unknown";
  }

  const permissionCategories: MedicationCategory[] = [
    "controlled",
    "stimulant",
    "opioid",
    "pseudoephedrine",
  ];

  if (
    categories.some((category) => permissionCategories.includes(category)) &&
    ["AE", "JP", "GB"].includes(countryCode)
  ) {
    return "prior_permission";
  }

  return categories.length > 0 ? "check_documentation" : "likely_ok";
}

function getActions(
  risk: RiskLevel,
  categories: MedicationCategory[],
  transitOnly: boolean,
  tripDuration: number | null,
) {
  const actions = [
    "Keep medicine in its original, clearly labeled packaging.",
    "Pack essential medicine and documents in your carry-on.",
  ];

  if (categories.length > 0) {
    actions.unshift(
      "Bring a prescription copy or clinician letter using generic medicine names.",
    );
  }

  if (
    categories.some((category) =>
      ["injectable", "liquid", "refrigerated", "sharps", "device"].includes(
        category,
      ),
    )
  ) {
    actions.push(
      "Allow extra time for security screening and explain special handling needs.",
    );
  }

  if (
    risk === "prior_permission" ||
    risk === "high_risk" ||
    risk === "unknown"
  ) {
    actions.unshift(
      "Verify current requirements with the official authority before travel.",
    );
  }

  if (transitOnly) {
    actions.push(
      "Confirm whether transit rules apply if you leave the secure airport area.",
    );
  }

  if (tripDuration && tripDuration > 30) {
    actions.unshift(
      "Verify quantity limits or prior-permission requirements for this longer trip.",
    );
  }

  return actions;
}

export function evaluateTrip(
  route: Airport[],
  categories: MedicationCategory[],
  tripDuration: number | null = null,
): Evaluation {
  const results = route.map((airport, index) => {
    const transitOnly = index > 0 && index < route.length - 1;
    const risk = getRisk(airport.countryCode, categories);
    const source = officialSources[airport.countryCode] ?? {
      title: `${airport.country} official travel authority`,
      url: "https://www.iatatravelcentre.com/",
      reviewedAt: "2026-05-15",
    };

    return {
      airport,
      transitOnly,
      risk,
      actions: getActions(risk, categories, transitOnly, tripDuration),
      confidence: officialSources[airport.countryCode]
        ? ("High" as const)
        : ("Moderate" as const),
      reviewedAt: source.reviewedAt,
      source: {
        title: source.title,
        url: source.url,
      },
    };
  });

  const overallRisk = results.reduce<RiskLevel>(
    (highest, result) =>
      riskRank[result.risk] > riskRank[highest] ? result.risk : highest,
    "likely_ok",
  );

  return {
    overallRisk,
    results,
    generatedAt: new Date().toISOString(),
  };
}
