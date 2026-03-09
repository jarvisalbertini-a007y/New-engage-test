const INTEGRATION_HEALTH_STATUS_ALLOWED = new Set([
  "ACTION_REQUIRED",
  "READY",
  "UNKNOWN",
]);
const INTEGRATION_HEALTH_STATUS_ORDER = [
  "ACTION_REQUIRED",
  "READY",
  "UNKNOWN",
] as const;

export type IntegrationHealthStatus = "ACTION_REQUIRED" | "READY" | "UNKNOWN";
export type IntegrationHealthFreshnessCountSource = "server" | "local";

export type IntegrationHealthFreshnessRow = {
  provider: string;
  status: IntegrationHealthStatus;
  configuredAgeDays: number | null;
  rotationAgeDays: number | null;
  staleReasons: string[];
};

export interface IntegrationHealthFreshnessCountProvenance {
  effectiveCounts: Record<string, number>;
  serverCounts: Record<string, number>;
  fallbackCounts: Record<string, number>;
  source: IntegrationHealthFreshnessCountSource;
  mismatch: boolean;
}

export interface IntegrationHealthExportMetadata {
  exportIntegrationHealthStatus: IntegrationHealthStatus;
  exportIntegrationHealthGeneratedAt: string | null;
  exportIntegrationHealthHealthyCount: number;
  exportIntegrationHealthUnhealthyCount: number;
  exportIntegrationHealthActionableUnhealthyProviders: string[];
  exportIntegrationHealthCredentialActionRequiredProviders: string[];
  exportIntegrationHealthCredentialConfiguredMaxAgeDays: number | null;
  exportIntegrationHealthCredentialRotationMaxAgeDays: number | null;
  exportIntegrationHealthCredentialFreshnessStatusCounts: Record<string, number>;
  exportIntegrationHealthCredentialFreshnessByProvider: Record<
    string,
    {
      status: IntegrationHealthStatus;
      configuredAgeDays: number | null;
      rotationAgeDays: number | null;
      staleReasons: string[];
    }
  >;
  exportIntegrationHealthCredentialFreshnessTotalProviders: number;
  exportIntegrationHealthCredentialFreshnessActionRequiredCount: number;
  exportIntegrationHealthCredentialFreshnessWithinPolicyCount: number;
  exportIntegrationHealthCredentialFreshnessUnknownCount: number;
  exportIntegrationHealthCredentialFreshnessStatusCountsSource: IntegrationHealthFreshnessCountSource;
  exportIntegrationHealthCredentialFreshnessStatusCountsMismatch: boolean;
  exportIntegrationHealthCredentialFreshnessStatusCountsServer: Record<string, number>;
  exportIntegrationHealthCredentialFreshnessStatusCountsFallback: Record<string, number>;
  exportIntegrationHealthRecommendedCommands: string[];
}

interface IntegrationHealthExportInput {
  generatedAt?: string | null;
  status?: unknown;
  healthyCount?: unknown;
  unhealthyCount?: unknown;
  actionableUnhealthyProviders?: unknown;
  credentialActionRequiredProviders?: unknown;
  credentialConfiguredMaxAgeDays?: unknown;
  credentialRotationMaxAgeDays?: unknown;
  credentialFreshnessByProvider?: unknown;
  credentialFreshnessStatusCounts?: unknown;
  credentialFreshnessTotalProviders?: unknown;
  credentialFreshnessActionRequiredCount?: unknown;
  credentialFreshnessWithinPolicyCount?: unknown;
  credentialFreshnessUnknownCount?: unknown;
  credentialFreshnessStatusCountsSource?: unknown;
  credentialFreshnessStatusCountsMismatch?: unknown;
  credentialFreshnessStatusCountsServer?: unknown;
  credentialFreshnessStatusCountsFallback?: unknown;
  recommendedCommands?: unknown;
}

const toFiniteNumberOrNull = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toFiniteNonNegativeIntegerOrNull = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const normalized = Math.floor(numeric);
  return normalized < 0 ? null : normalized;
};

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0);
};

const toOrderedFreshnessCountMap = (
  counts: Record<string, number>
): Record<string, number> => {
  const rank = new Map<string, number>(
    INTEGRATION_HEALTH_STATUS_ORDER.map((status, index) => [status, index])
  );
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => {
      const leftRank = rank.get(left);
      const rightRank = rank.get(right);
      if (leftRank != null && rightRank != null) {
        return leftRank - rightRank;
      }
      if (leftRank != null) {
        return -1;
      }
      if (rightRank != null) {
        return 1;
      }
      return left.localeCompare(right);
    })
  );
};

const areFreshnessCountMapsEqual = (
  left: Record<string, number>,
  right: Record<string, number>
): boolean => {
  const leftKeys = Object.keys(left || {}).sort();
  const rightKeys = Object.keys(right || {}).sort();
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    if (leftKey !== rightKeys[index]) {
      return false;
    }
    if (left[leftKey] !== right[rightKeys[index]]) {
      return false;
    }
  }
  return true;
};

export const normalizeIntegrationHealthStatus = (
  value: unknown,
  fallback: IntegrationHealthStatus = "UNKNOWN"
): IntegrationHealthStatus => {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (INTEGRATION_HEALTH_STATUS_ALLOWED.has(normalized)) {
    return normalized as IntegrationHealthStatus;
  }
  return fallback;
};

export const buildIntegrationHealthFreshnessRows = (
  value: unknown
): IntegrationHealthFreshnessRow[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value as Record<string, any>)
    .map(([provider, row]) => {
      const normalizedProvider = String(provider || "").trim().toLowerCase();
      if (!normalizedProvider) {
        return null;
      }
      const staleReasons = Array.isArray(row?.staleReasons)
        ? row.staleReasons
            .map((item: unknown) => String(item || "").trim())
            .filter((item: string) => item.length > 0)
        : [];
      return {
        provider: normalizedProvider,
        status: normalizeIntegrationHealthStatus(row?.status),
        configuredAgeDays: toFiniteNumberOrNull(row?.configuredAgeDays),
        rotationAgeDays: toFiniteNumberOrNull(row?.rotationAgeDays),
        staleReasons,
      };
    })
    .filter((row): row is IntegrationHealthFreshnessRow => row !== null)
    .sort((left, right) => left.provider.localeCompare(right.provider));
};

export const normalizeIntegrationHealthFreshnessStatusCountMap = (
  value: unknown
): Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const counts: Record<string, number> = {};
  for (const [rawStatus, rawCount] of Object.entries(
    value as Record<string, unknown>
  )) {
    const normalizedStatus = normalizeIntegrationHealthStatus(
      rawStatus,
      "UNKNOWN"
    );
    const normalizedCount = toFiniteNonNegativeIntegerOrNull(rawCount);
    if (normalizedCount == null) {
      continue;
    }
    counts[normalizedStatus] = (counts[normalizedStatus] || 0) + normalizedCount;
  }
  return toOrderedFreshnessCountMap(counts);
};

export const buildIntegrationHealthFreshnessStatusCountMap = (
  rows: IntegrationHealthFreshnessRow[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const row of rows || []) {
    const normalizedStatus = normalizeIntegrationHealthStatus(
      row?.status,
      "UNKNOWN"
    );
    counts[normalizedStatus] = (counts[normalizedStatus] || 0) + 1;
  }
  return toOrderedFreshnessCountMap(counts);
};

export const resolveIntegrationHealthFreshnessStatusCountProvenance = (
  serverValue: unknown,
  fallbackValue: Record<string, number>
): IntegrationHealthFreshnessCountProvenance => {
  const serverCounts = normalizeIntegrationHealthFreshnessStatusCountMap(
    serverValue
  );
  const fallbackCounts = normalizeIntegrationHealthFreshnessStatusCountMap(
    fallbackValue
  );
  const hasServerCounts = Object.keys(serverCounts).length > 0;
  const effectiveCounts = hasServerCounts ? serverCounts : fallbackCounts;
  const source: IntegrationHealthFreshnessCountSource = hasServerCounts
    ? "server"
    : "local";
  const mismatch = hasServerCounts
    ? !areFreshnessCountMapsEqual(serverCounts, fallbackCounts)
    : false;
  return {
    effectiveCounts,
    serverCounts,
    fallbackCounts,
    source,
    mismatch,
  };
};

export const buildIntegrationHealthExportMetadata = (
  value?: IntegrationHealthExportInput | null
): IntegrationHealthExportMetadata => {
  const freshnessRows = buildIntegrationHealthFreshnessRows(
    value?.credentialFreshnessByProvider
  );
  const freshnessCountsFallback = buildIntegrationHealthFreshnessStatusCountMap(
    freshnessRows
  );
  const serverFreshnessStatusCountsValue =
    value?.credentialFreshnessStatusCountsServer ??
    value?.credentialFreshnessStatusCounts;
  const fallbackFreshnessStatusCountsValue =
    normalizeIntegrationHealthFreshnessStatusCountMap(
      value?.credentialFreshnessStatusCountsFallback ?? freshnessCountsFallback
    );
  const freshnessCountsProvenanceResolved =
    resolveIntegrationHealthFreshnessStatusCountProvenance(
      serverFreshnessStatusCountsValue,
      fallbackFreshnessStatusCountsValue
    );
  const freshnessCountSourceRaw = String(
    value?.credentialFreshnessStatusCountsSource || ""
  )
    .trim()
    .toLowerCase();
  const freshnessCountSource: IntegrationHealthFreshnessCountSource =
    freshnessCountSourceRaw === "server" || freshnessCountSourceRaw === "local"
      ? (freshnessCountSourceRaw as IntegrationHealthFreshnessCountSource)
      : freshnessCountsProvenanceResolved.source;
  const freshnessCountsServer =
    freshnessCountsProvenanceResolved.serverCounts;
  const freshnessCountsFallbackResolved =
    freshnessCountsProvenanceResolved.fallbackCounts;
  const freshnessCountsMismatch =
    typeof value?.credentialFreshnessStatusCountsMismatch === "boolean"
      ? value.credentialFreshnessStatusCountsMismatch
      : freshnessCountSource === "server"
      ? !areFreshnessCountMapsEqual(
          freshnessCountsServer,
          freshnessCountsFallbackResolved
        )
      : false;
  const freshnessCounts =
    freshnessCountSource === "local" &&
    Object.keys(freshnessCountsFallbackResolved).length > 0
      ? freshnessCountsFallbackResolved
      : freshnessCountSource === "server" &&
        Object.keys(freshnessCountsServer).length > 0
      ? freshnessCountsServer
      : freshnessCountsProvenanceResolved.effectiveCounts;
  const freshnessByProvider = Object.fromEntries(
    freshnessRows.map((row) => [
      row.provider,
      {
        status: row.status,
        configuredAgeDays: row.configuredAgeDays,
        rotationAgeDays: row.rotationAgeDays,
        staleReasons: row.staleReasons,
      },
    ])
  );
  const freshnessActionRequiredCount =
    toFiniteNonNegativeIntegerOrNull(
      value?.credentialFreshnessActionRequiredCount
    ) ?? Number(freshnessCounts.ACTION_REQUIRED || 0);
  const freshnessWithinPolicyCount =
    toFiniteNonNegativeIntegerOrNull(value?.credentialFreshnessWithinPolicyCount) ??
    Number(freshnessCounts.READY || 0);
  const freshnessUnknownCount =
    toFiniteNonNegativeIntegerOrNull(value?.credentialFreshnessUnknownCount) ??
    Number(freshnessCounts.UNKNOWN || 0);
  const freshnessTotalProviders =
    toFiniteNonNegativeIntegerOrNull(value?.credentialFreshnessTotalProviders) ??
    freshnessRows.length;

  return {
    exportIntegrationHealthStatus: normalizeIntegrationHealthStatus(value?.status),
    exportIntegrationHealthGeneratedAt:
      typeof value?.generatedAt === "string" && value.generatedAt.trim().length > 0
        ? value.generatedAt
        : null,
    exportIntegrationHealthHealthyCount:
      toFiniteNonNegativeIntegerOrNull(value?.healthyCount) ?? 0,
    exportIntegrationHealthUnhealthyCount:
      toFiniteNonNegativeIntegerOrNull(value?.unhealthyCount) ?? 0,
    exportIntegrationHealthActionableUnhealthyProviders: toStringList(
      value?.actionableUnhealthyProviders
    ),
    exportIntegrationHealthCredentialActionRequiredProviders: toStringList(
      value?.credentialActionRequiredProviders
    ),
    exportIntegrationHealthCredentialConfiguredMaxAgeDays:
      toFiniteNonNegativeIntegerOrNull(value?.credentialConfiguredMaxAgeDays),
    exportIntegrationHealthCredentialRotationMaxAgeDays:
      toFiniteNonNegativeIntegerOrNull(value?.credentialRotationMaxAgeDays),
    exportIntegrationHealthCredentialFreshnessStatusCounts: freshnessCounts,
    exportIntegrationHealthCredentialFreshnessByProvider: freshnessByProvider,
    exportIntegrationHealthCredentialFreshnessTotalProviders:
      freshnessTotalProviders,
    exportIntegrationHealthCredentialFreshnessActionRequiredCount:
      freshnessActionRequiredCount,
    exportIntegrationHealthCredentialFreshnessWithinPolicyCount:
      freshnessWithinPolicyCount,
    exportIntegrationHealthCredentialFreshnessUnknownCount: freshnessUnknownCount,
    exportIntegrationHealthCredentialFreshnessStatusCountsSource:
      freshnessCountSource,
    exportIntegrationHealthCredentialFreshnessStatusCountsMismatch:
      freshnessCountsMismatch,
    exportIntegrationHealthCredentialFreshnessStatusCountsServer:
      freshnessCountsServer,
    exportIntegrationHealthCredentialFreshnessStatusCountsFallback:
      freshnessCountsFallbackResolved,
    exportIntegrationHealthRecommendedCommands: toStringList(
      value?.recommendedCommands
    ),
  };
};
