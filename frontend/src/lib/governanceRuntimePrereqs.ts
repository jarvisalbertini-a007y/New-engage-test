export interface GovernanceRuntimePrereqsRollup {
  present?: boolean | null;
  available?: boolean | null;
  passed?: boolean | null;
  contractValid?: boolean | null;
  valid?: boolean | null;
  missingCheckCount?: number | null;
  missingChecks?: {
    commands?: string[] | null;
    workspace?: string[] | null;
  } | null;
  command?: string | null;
  artifactPath?: string | null;
  generatedAt?: string | null;
  validatedAt?: string | null;
}

interface NormalizedRuntimePrereqsRollup {
  present: boolean;
  available: boolean;
  passed: boolean | null;
  contractValid: boolean | null;
  valid: boolean | null;
  missingCheckCount: number;
  missingChecks: {
    commands: string[];
    workspace: string[];
  };
  command: string | null;
  artifactPath: string | null;
  generatedAt: string | null;
  validatedAt: string | null;
}

export interface GovernanceRuntimePrereqsExportMetadata {
  runtimePrereqs: NormalizedRuntimePrereqsRollup;
  runtimePrereqsPresent: boolean;
  runtimePrereqsAvailable: boolean;
  runtimePrereqsPassed: boolean | null;
  runtimePrereqsContractValid: boolean | null;
  runtimePrereqsValid: boolean | null;
  runtimePrereqsMissingCheckCount: number;
  runtimePrereqsMissingChecks: {
    commands: string[];
    workspace: string[];
  };
  runtimePrereqsMissingCommands: string[];
  runtimePrereqsMissingWorkspaceChecks: string[];
  runtimePrereqsCommand: string | null;
  runtimePrereqsParity: {
    topLevelPresent: boolean;
    nestedPresent: boolean;
    matchesNested: boolean | null;
  };
}

const normalizeOptionalBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized: string[] = [];
  value.forEach((item) => {
    if (typeof item !== 'string') {
      return;
    }
    const token = item.trim();
    if (!token || normalized.includes(token)) {
      return;
    }
    normalized.push(token);
  });
  return normalized;
};

const normalizeNonNegativeInt = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return Math.max(0, Math.floor(fallback));
  }
  return Math.floor(numeric);
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const token = value.trim();
  return token || null;
};

const normalizeRuntimePrereqsRollup = (
  value?: GovernanceRuntimePrereqsRollup | null
): NormalizedRuntimePrereqsRollup => {
  const payload = value && typeof value === 'object' ? value : {};
  const missingChecksPayload = (
    payload.missingChecks && typeof payload.missingChecks === 'object'
      ? payload.missingChecks
      : {}
  ) as { commands?: string[] | null; workspace?: string[] | null };
  const missingCommands = normalizeStringList(missingChecksPayload.commands);
  const missingWorkspace = normalizeStringList(missingChecksPayload.workspace);
  const missingCheckCount = normalizeNonNegativeInt(
    payload.missingCheckCount,
    missingCommands.length + missingWorkspace.length
  );
  return {
    present: Boolean(payload.present),
    available: Boolean(payload.available),
    passed: normalizeOptionalBoolean(payload.passed),
    contractValid: normalizeOptionalBoolean(payload.contractValid),
    valid: normalizeOptionalBoolean(payload.valid),
    missingCheckCount,
    missingChecks: {
      commands: missingCommands,
      workspace: missingWorkspace,
    },
    command: normalizeOptionalString(payload.command),
    artifactPath: normalizeOptionalString(payload.artifactPath),
    generatedAt: normalizeOptionalString(payload.generatedAt),
    validatedAt: normalizeOptionalString(payload.validatedAt),
  };
};

const runtimePrereqsRollupEqual = (
  left: NormalizedRuntimePrereqsRollup,
  right: NormalizedRuntimePrereqsRollup
): boolean =>
  left.present === right.present
  && left.available === right.available
  && left.passed === right.passed
  && left.contractValid === right.contractValid
  && left.valid === right.valid
  && left.missingCheckCount === right.missingCheckCount
  && JSON.stringify(left.missingChecks.commands) === JSON.stringify(right.missingChecks.commands)
  && JSON.stringify(left.missingChecks.workspace) === JSON.stringify(right.missingChecks.workspace)
  && left.command === right.command;

export const buildGovernanceRuntimePrereqsMetadata = (
  topLevelRuntimePrereqs?: GovernanceRuntimePrereqsRollup | null,
  nestedRuntimePrereqs?: GovernanceRuntimePrereqsRollup | null
): GovernanceRuntimePrereqsExportMetadata => {
  const topLevelPresent = Boolean(topLevelRuntimePrereqs && typeof topLevelRuntimePrereqs === 'object');
  const nestedPresent = Boolean(nestedRuntimePrereqs && typeof nestedRuntimePrereqs === 'object');
  const normalizedTopLevel = topLevelPresent
    ? normalizeRuntimePrereqsRollup(topLevelRuntimePrereqs)
    : null;
  const normalizedNested = nestedPresent
    ? normalizeRuntimePrereqsRollup(nestedRuntimePrereqs)
    : null;
  const selected =
    normalizedTopLevel
    || normalizedNested
    || normalizeRuntimePrereqsRollup(undefined);

  return {
    runtimePrereqs: selected,
    runtimePrereqsPresent: selected.present,
    runtimePrereqsAvailable: selected.available,
    runtimePrereqsPassed: selected.passed,
    runtimePrereqsContractValid: selected.contractValid,
    runtimePrereqsValid: selected.valid,
    runtimePrereqsMissingCheckCount: selected.missingCheckCount,
    runtimePrereqsMissingChecks: selected.missingChecks,
    runtimePrereqsMissingCommands: selected.missingChecks.commands,
    runtimePrereqsMissingWorkspaceChecks: selected.missingChecks.workspace,
    runtimePrereqsCommand: selected.command,
    runtimePrereqsParity: {
      topLevelPresent,
      nestedPresent,
      matchesNested:
        normalizedTopLevel && normalizedNested
          ? runtimePrereqsRollupEqual(normalizedTopLevel, normalizedNested)
          : null,
    },
  };
};
