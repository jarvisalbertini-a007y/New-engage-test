import { buildGovernanceRuntimePrereqsMetadata } from './governanceRuntimePrereqs';

describe('buildGovernanceRuntimePrereqsMetadata', () => {
  it('normalizes runtime-prereq rollups and reports parity', () => {
    const metadata = buildGovernanceRuntimePrereqsMetadata(
      {
        present: true,
        available: true,
        passed: true,
        contractValid: true,
        valid: true,
        missingCheckCount: 1,
        missingChecks: {
          commands: ['node', 'node', ' npm '],
          workspace: ['frontend', 'frontend'],
        },
        command: ' npm run verify:baseline:runtime-prereqs:artifact ',
      },
      {
        present: true,
        available: true,
        passed: true,
        contractValid: true,
        valid: true,
        missingCheckCount: 1,
        missingChecks: {
          commands: ['node', 'npm'],
          workspace: ['frontend'],
        },
        command: 'npm run verify:baseline:runtime-prereqs:artifact',
      }
    );

    expect(metadata.runtimePrereqsPresent).toBe(true);
    expect(metadata.runtimePrereqsAvailable).toBe(true);
    expect(metadata.runtimePrereqsMissingCheckCount).toBe(1);
    expect(metadata.runtimePrereqsMissingCommands).toEqual(['node', 'npm']);
    expect(metadata.runtimePrereqsMissingWorkspaceChecks).toEqual(['frontend']);
    expect(metadata.runtimePrereqsParity.topLevelPresent).toBe(true);
    expect(metadata.runtimePrereqsParity.nestedPresent).toBe(true);
    expect(metadata.runtimePrereqsParity.matchesNested).toBe(true);
  });

  it('returns safe defaults when runtime-prereq payload is absent', () => {
    const metadata = buildGovernanceRuntimePrereqsMetadata(undefined, undefined);

    expect(metadata.runtimePrereqsPresent).toBe(false);
    expect(metadata.runtimePrereqsAvailable).toBe(false);
    expect(metadata.runtimePrereqsPassed).toBeNull();
    expect(metadata.runtimePrereqsContractValid).toBeNull();
    expect(metadata.runtimePrereqsValid).toBeNull();
    expect(metadata.runtimePrereqsMissingCheckCount).toBe(0);
    expect(metadata.runtimePrereqsMissingCommands).toEqual([]);
    expect(metadata.runtimePrereqsMissingWorkspaceChecks).toEqual([]);
    expect(metadata.runtimePrereqsParity.matchesNested).toBeNull();
  });

  it('flags parity mismatch when top-level and nested runtime-prereq payloads drift', () => {
    const metadata = buildGovernanceRuntimePrereqsMetadata(
      {
        present: true,
        available: true,
        passed: true,
        contractValid: true,
        valid: true,
        missingCheckCount: 0,
        missingChecks: {
          commands: [],
          workspace: [],
        },
      },
      {
        present: true,
        available: false,
        passed: false,
        contractValid: true,
        valid: false,
        missingCheckCount: 1,
        missingChecks: {
          commands: ['node'],
          workspace: [],
        },
      }
    );

    expect(metadata.runtimePrereqsParity.matchesNested).toBe(false);
  });
});
