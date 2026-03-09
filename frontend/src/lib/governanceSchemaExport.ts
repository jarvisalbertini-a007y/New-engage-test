interface GovernanceSchemaMetadata {
  activeVersion?: number;
  defaultVersion?: number;
  source?: string;
  supportedVersions?: number[];
  override?: {
    envVar?: string;
    rawValue?: string;
    isSet?: boolean;
    isValid?: boolean;
  };
}

interface GovernanceSchemaHandoff {
  rolloutBlocked?: boolean;
  ownerRole?: string;
  actions?: unknown[];
}

interface GovernanceSchemaRolloutAction {
  action?: string;
  reasonCode?: string;
}

interface GovernanceSchemaExportAlert {
  reasonCode?: string;
}

interface GovernanceSchemaExportEnvelope {
  governanceType?: string;
  status?: string;
  rolloutBlocked?: boolean;
  ownerRole?: string;
  reasonCodes?: unknown[];
  recommendedCommands?: unknown[];
  actions?: GovernanceSchemaRolloutAction[];
  alerts?: GovernanceSchemaExportAlert[];
  evaluatedAt?: string;
  requestedBy?: string;
}

type NullableParity = boolean | null;

interface GovernanceSchemaContractParity {
  reasonCodeCount: number;
  recommendedCommandCount: number;
  reasonCodeParity: {
    topLevelVsRolloutActions: NullableParity;
    topLevelVsExportActions: NullableParity;
    topLevelVsExportAlerts: NullableParity;
    topLevelVsExportReasonCodes: NullableParity;
  };
  recommendedCommandParity: {
    topLevelVsExport: NullableParity;
  };
  handoffParity: {
    rolloutBlockedMatchesExport: NullableParity;
    ownerRoleMatchesExport: NullableParity;
    handoffActionsMatchRolloutActions: NullableParity;
    handoffActionCount: number;
    rolloutActionCount: number;
  };
  computedAt: string;
}

interface GovernanceSchemaContractParityInput {
  reasonCodeCount?: unknown;
  recommendedCommandCount?: unknown;
  reasonCodeParity?: {
    topLevelVsRolloutActions?: unknown;
    topLevelVsExportActions?: unknown;
    topLevelVsExportAlerts?: unknown;
    topLevelVsExportReasonCodes?: unknown;
  };
  recommendedCommandParity?: {
    topLevelVsExport?: unknown;
  };
  handoffParity?: {
    rolloutBlockedMatchesExport?: unknown;
    ownerRoleMatchesExport?: unknown;
    handoffActionsMatchRolloutActions?: unknown;
    handoffActionCount?: unknown;
    rolloutActionCount?: unknown;
  };
  computedAt?: unknown;
}

export interface GovernanceSchemaContractPayload {
  generatedAt?: string;
  governanceType?: string;
  status?: string;
  schemaMetadata?: GovernanceSchemaMetadata;
  alerts?: unknown[];
  reasonCodes?: unknown[];
  handoff?: GovernanceSchemaHandoff;
  rolloutActions?: GovernanceSchemaRolloutAction[];
  recommendedCommands?: unknown[];
  schemaContractParity?: GovernanceSchemaContractParityInput;
  governanceExport?: GovernanceSchemaExportEnvelope;
  requestedBy?: string;
}

export interface GovernanceSchemaContractSnapshot extends GovernanceSchemaContractPayload {
  reasonCodes: string[];
  recommendedCommands: string[];
  handoff?: GovernanceSchemaHandoff;
  rolloutActions?: GovernanceSchemaRolloutAction[];
  governanceExport?: GovernanceSchemaExportEnvelope;
  schemaContractParity: GovernanceSchemaContractParity;
  schemaContractParitySource: 'backend' | 'client_recomputed';
}

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }
    normalized.add(trimmed);
  }
  return Array.from(normalized);
};

const normalizeActionReasonCodes = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = new Set<string>();
  for (const item of value) {
    const reasonCode = typeof (item as { reasonCode?: unknown })?.reasonCode === 'string'
      ? ((item as { reasonCode?: string }).reasonCode || '').trim()
      : '';
    if (reasonCode) {
      normalized.add(reasonCode);
    }
  }
  return Array.from(normalized);
};

const normalizeActionLabels = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = new Set<string>();
  for (const item of value) {
    const action = typeof (item as { action?: unknown })?.action === 'string'
      ? ((item as { action?: string }).action || '').trim()
      : '';
    if (action) {
      normalized.add(action);
    }
  }
  return Array.from(normalized);
};

const normalizeOwnerRole = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
};

const normalizeNullableParity = (value: unknown, fallback: NullableParity): NullableParity => {
  const normalized = normalizeBoolean(value);
  return normalized == null ? fallback : normalized;
};

const normalizeCount = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const normalized = Math.floor(parsed);
  return normalized >= 0 ? normalized : fallback;
};

const stableSerialize = (value: string[]): string =>
  JSON.stringify([...value].sort((a, b) => a.localeCompare(b)));

const listParity = (left: string[], right: string[]): NullableParity => {
  if (left.length === 0 && right.length === 0) {
    return null;
  }
  return stableSerialize(left) === stableSerialize(right);
};

export const buildGovernanceSchemaExportSnapshot = (
  payload?: GovernanceSchemaContractPayload | null
): GovernanceSchemaContractSnapshot | { message: string } => {
  if (!payload || typeof payload !== 'object') {
    return { message: 'No governance schema contract loaded' };
  }

  const topLevelReasonCodes = normalizeStringList(payload.reasonCodes);
  const topLevelCommands = normalizeStringList(payload.recommendedCommands);
  const handoffActions = normalizeStringList(payload.handoff?.actions);
  const rolloutActions = Array.isArray(payload.rolloutActions)
    ? payload.rolloutActions
    : [];
  const rolloutActionLabels = normalizeActionLabels(rolloutActions);
  const rolloutActionReasonCodes = normalizeActionReasonCodes(rolloutActions);

  const exportPayload = payload.governanceExport && typeof payload.governanceExport === 'object'
    ? payload.governanceExport
    : undefined;
  const exportReasonCodes = normalizeStringList(exportPayload?.reasonCodes);
  const exportCommands = normalizeStringList(exportPayload?.recommendedCommands);
  const exportActionReasonCodes = normalizeActionReasonCodes(exportPayload?.actions);
  const exportAlertReasonCodes = normalizeActionReasonCodes(exportPayload?.alerts);

  const computedParity: GovernanceSchemaContractParity = {
    reasonCodeCount: topLevelReasonCodes.length,
    recommendedCommandCount: topLevelCommands.length,
    reasonCodeParity: {
      topLevelVsRolloutActions: listParity(topLevelReasonCodes, rolloutActionReasonCodes),
      topLevelVsExportActions: listParity(topLevelReasonCodes, exportActionReasonCodes),
      topLevelVsExportAlerts: listParity(topLevelReasonCodes, exportAlertReasonCodes),
      topLevelVsExportReasonCodes: listParity(topLevelReasonCodes, exportReasonCodes),
    },
    recommendedCommandParity: {
      topLevelVsExport: listParity(topLevelCommands, exportCommands),
    },
    handoffParity: {
      rolloutBlockedMatchesExport:
        payload.handoff || exportPayload
          ? normalizeBoolean(payload.handoff?.rolloutBlocked) === normalizeBoolean(exportPayload?.rolloutBlocked)
          : null,
      ownerRoleMatchesExport:
        payload.handoff || exportPayload
          ? normalizeOwnerRole(payload.handoff?.ownerRole) === normalizeOwnerRole(exportPayload?.ownerRole)
          : null,
      handoffActionsMatchRolloutActions: listParity(handoffActions, rolloutActionLabels),
      handoffActionCount: handoffActions.length,
      rolloutActionCount: rolloutActionLabels.length,
    },
    computedAt: new Date().toISOString(),
  };

  const backendParity = payload.schemaContractParity && typeof payload.schemaContractParity === 'object'
    ? payload.schemaContractParity
    : null;
  const schemaContractParity: GovernanceSchemaContractParity = backendParity
    ? {
        reasonCodeCount: normalizeCount(
          backendParity.reasonCodeCount,
          computedParity.reasonCodeCount
        ),
        recommendedCommandCount: normalizeCount(
          backendParity.recommendedCommandCount,
          computedParity.recommendedCommandCount
        ),
        reasonCodeParity: {
          topLevelVsRolloutActions: normalizeNullableParity(
            backendParity.reasonCodeParity?.topLevelVsRolloutActions,
            computedParity.reasonCodeParity.topLevelVsRolloutActions
          ),
          topLevelVsExportActions: normalizeNullableParity(
            backendParity.reasonCodeParity?.topLevelVsExportActions,
            computedParity.reasonCodeParity.topLevelVsExportActions
          ),
          topLevelVsExportAlerts: normalizeNullableParity(
            backendParity.reasonCodeParity?.topLevelVsExportAlerts,
            computedParity.reasonCodeParity.topLevelVsExportAlerts
          ),
          topLevelVsExportReasonCodes: normalizeNullableParity(
            backendParity.reasonCodeParity?.topLevelVsExportReasonCodes,
            computedParity.reasonCodeParity.topLevelVsExportReasonCodes
          ),
        },
        recommendedCommandParity: {
          topLevelVsExport: normalizeNullableParity(
            backendParity.recommendedCommandParity?.topLevelVsExport,
            computedParity.recommendedCommandParity.topLevelVsExport
          ),
        },
        handoffParity: {
          rolloutBlockedMatchesExport: normalizeNullableParity(
            backendParity.handoffParity?.rolloutBlockedMatchesExport,
            computedParity.handoffParity.rolloutBlockedMatchesExport
          ),
          ownerRoleMatchesExport: normalizeNullableParity(
            backendParity.handoffParity?.ownerRoleMatchesExport,
            computedParity.handoffParity.ownerRoleMatchesExport
          ),
          handoffActionsMatchRolloutActions: normalizeNullableParity(
            backendParity.handoffParity?.handoffActionsMatchRolloutActions,
            computedParity.handoffParity.handoffActionsMatchRolloutActions
          ),
          handoffActionCount: normalizeCount(
            backendParity.handoffParity?.handoffActionCount,
            computedParity.handoffParity.handoffActionCount
          ),
          rolloutActionCount: normalizeCount(
            backendParity.handoffParity?.rolloutActionCount,
            computedParity.handoffParity.rolloutActionCount
          ),
        },
        computedAt:
          typeof backendParity.computedAt === 'string' && backendParity.computedAt.trim()
            ? backendParity.computedAt
            : computedParity.computedAt,
      }
    : computedParity;

  return {
    ...payload,
    reasonCodes: topLevelReasonCodes,
    recommendedCommands: topLevelCommands,
    handoff: payload.handoff,
    rolloutActions,
    governanceExport: exportPayload
      ? {
          ...exportPayload,
          reasonCodes: exportReasonCodes,
          recommendedCommands: exportCommands,
          actions: Array.isArray(exportPayload.actions) ? exportPayload.actions : [],
          alerts: Array.isArray(exportPayload.alerts) ? exportPayload.alerts : [],
        }
      : undefined,
    schemaContractParity,
    schemaContractParitySource: backendParity ? 'backend' : 'client_recomputed',
  };
};
