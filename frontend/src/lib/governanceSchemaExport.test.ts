import { buildGovernanceSchemaExportSnapshot } from './governanceSchemaExport';

describe('buildGovernanceSchemaExportSnapshot', () => {
  it('normalizes governance schema payload and computes parity metadata', () => {
    const snapshot = buildGovernanceSchemaExportSnapshot({
      governanceType: 'schema_metadata',
      status: 'READY',
      reasonCodes: [' schema_ready ', 'schema_ready'],
      recommendedCommands: [
        ' npm run verify:governance:schema:preflight ',
        'npm run verify:governance:schema:preflight',
      ],
      handoff: {
        rolloutBlocked: false,
        ownerRole: 'Release Manager',
        actions: ['Schema metadata is healthy. Continue schema and packet contract checks.'],
      },
      rolloutActions: [
        {
          action: 'Schema metadata is healthy. Continue schema and packet contract checks.',
          reasonCode: 'schema_ready',
        },
      ],
      governanceExport: {
        governanceType: 'schema_metadata',
        status: 'READY',
        rolloutBlocked: false,
        ownerRole: 'Release Manager',
        reasonCodes: ['schema_ready'],
        recommendedCommands: ['npm run verify:governance:schema:preflight'],
        actions: [{ reasonCode: 'schema_ready' }],
        alerts: [{ reasonCode: 'schema_ready' }],
      },
    });

    if ('message' in snapshot) {
      throw new Error('Expected snapshot payload');
    }

    expect(snapshot.reasonCodes).toEqual(['schema_ready']);
    expect(snapshot.recommendedCommands).toEqual([
      'npm run verify:governance:schema:preflight',
    ]);
    expect(snapshot.schemaContractParity.reasonCodeCount).toBe(1);
    expect(snapshot.schemaContractParity.recommendedCommandCount).toBe(1);
    expect(
      snapshot.schemaContractParity.reasonCodeParity.topLevelVsRolloutActions
    ).toBe(true);
    expect(snapshot.schemaContractParity.reasonCodeParity.topLevelVsExportActions).toBe(
      true
    );
    expect(snapshot.schemaContractParity.reasonCodeParity.topLevelVsExportAlerts).toBe(
      true
    );
    expect(snapshot.schemaContractParity.reasonCodeParity.topLevelVsExportReasonCodes).toBe(
      true
    );
    expect(
      snapshot.schemaContractParity.recommendedCommandParity.topLevelVsExport
    ).toBe(true);
    expect(
      snapshot.schemaContractParity.handoffParity.rolloutBlockedMatchesExport
    ).toBe(true);
    expect(snapshot.schemaContractParity.handoffParity.ownerRoleMatchesExport).toBe(
      true
    );
    expect(
      snapshot.schemaContractParity.handoffParity.handoffActionsMatchRolloutActions
    ).toBe(true);
    expect(typeof snapshot.schemaContractParity.computedAt).toBe('string');
    expect(snapshot.schemaContractParitySource).toBe('client_recomputed');
  });

  it('reports mismatch parity metadata for divergent schema payloads', () => {
    const snapshot = buildGovernanceSchemaExportSnapshot({
      governanceType: 'schema_metadata',
      status: 'ACTION_REQUIRED',
      reasonCodes: ['schema_override_invalid'],
      recommendedCommands: ['npm run verify:governance:schema:preflight'],
      handoff: {
        rolloutBlocked: true,
        ownerRole: 'Release Manager',
        actions: ['Correct override and rerun extended verification.'],
      },
      rolloutActions: [
        {
          action: 'Correct override and rerun extended verification.',
          reasonCode: 'schema_override_invalid',
        },
      ],
      governanceExport: {
        governanceType: 'schema_metadata',
        status: 'ACTION_REQUIRED',
        rolloutBlocked: false,
        ownerRole: 'QA Engineer',
        reasonCodes: ['schema_ready'],
        recommendedCommands: ['npm run verify:governance:weekly:endpoint:contract'],
        actions: [{ reasonCode: 'schema_ready' }],
        alerts: [{ reasonCode: 'schema_ready' }],
      },
    });

    if ('message' in snapshot) {
      throw new Error('Expected snapshot payload');
    }

    expect(snapshot.schemaContractParity.reasonCodeParity.topLevelVsExportActions).toBe(
      false
    );
    expect(snapshot.schemaContractParity.reasonCodeParity.topLevelVsExportAlerts).toBe(
      false
    );
    expect(snapshot.schemaContractParity.reasonCodeParity.topLevelVsExportReasonCodes).toBe(
      false
    );
    expect(
      snapshot.schemaContractParity.recommendedCommandParity.topLevelVsExport
    ).toBe(false);
    expect(
      snapshot.schemaContractParity.handoffParity.rolloutBlockedMatchesExport
    ).toBe(false);
    expect(snapshot.schemaContractParity.handoffParity.ownerRoleMatchesExport).toBe(
      false
    );
    expect(snapshot.schemaContractParitySource).toBe('client_recomputed');
  });

  it('uses backend schema parity block when provided', () => {
    const snapshot = buildGovernanceSchemaExportSnapshot({
      governanceType: 'schema_metadata',
      status: 'READY',
      reasonCodes: ['schema_ready'],
      recommendedCommands: ['npm run verify:governance:schema:preflight'],
      handoff: {
        rolloutBlocked: false,
        ownerRole: 'Release Manager',
        actions: ['Schema metadata is healthy. Continue schema and packet contract checks.'],
      },
      rolloutActions: [
        {
          action: 'Schema metadata is healthy. Continue schema and packet contract checks.',
          reasonCode: 'schema_ready',
        },
      ],
      governanceExport: {
        governanceType: 'schema_metadata',
        status: 'READY',
        rolloutBlocked: false,
        ownerRole: 'Release Manager',
        reasonCodes: ['schema_ready'],
        recommendedCommands: ['npm run verify:governance:schema:preflight'],
        actions: [{ reasonCode: 'schema_ready' }],
        alerts: [{ reasonCode: 'schema_ready' }],
      },
      schemaContractParity: {
        reasonCodeCount: 7,
        recommendedCommandCount: 9,
        reasonCodeParity: {
          topLevelVsRolloutActions: false,
          topLevelVsExportActions: false,
          topLevelVsExportAlerts: false,
          topLevelVsExportReasonCodes: false,
        },
        recommendedCommandParity: {
          topLevelVsExport: false,
        },
        handoffParity: {
          rolloutBlockedMatchesExport: false,
          ownerRoleMatchesExport: false,
          handoffActionsMatchRolloutActions: false,
          handoffActionCount: 10,
          rolloutActionCount: 11,
        },
        computedAt: '2026-02-27T00:00:00+00:00',
      },
    });

    if ('message' in snapshot) {
      throw new Error('Expected snapshot payload');
    }

    expect(snapshot.schemaContractParitySource).toBe('backend');
    expect(snapshot.schemaContractParity.reasonCodeCount).toBe(7);
    expect(snapshot.schemaContractParity.recommendedCommandCount).toBe(9);
    expect(snapshot.schemaContractParity.reasonCodeParity.topLevelVsRolloutActions).toBe(
      false
    );
    expect(snapshot.schemaContractParity.reasonCodeParity.topLevelVsExportActions).toBe(
      false
    );
    expect(snapshot.schemaContractParity.reasonCodeParity.topLevelVsExportAlerts).toBe(
      false
    );
    expect(snapshot.schemaContractParity.reasonCodeParity.topLevelVsExportReasonCodes).toBe(
      false
    );
    expect(snapshot.schemaContractParity.recommendedCommandParity.topLevelVsExport).toBe(
      false
    );
    expect(snapshot.schemaContractParity.handoffParity.rolloutBlockedMatchesExport).toBe(
      false
    );
    expect(snapshot.schemaContractParity.handoffParity.ownerRoleMatchesExport).toBe(
      false
    );
    expect(
      snapshot.schemaContractParity.handoffParity.handoffActionsMatchRolloutActions
    ).toBe(false);
    expect(snapshot.schemaContractParity.handoffParity.handoffActionCount).toBe(10);
    expect(snapshot.schemaContractParity.handoffParity.rolloutActionCount).toBe(11);
    expect(snapshot.schemaContractParity.computedAt).toBe('2026-02-27T00:00:00+00:00');
  });

  it('returns fallback payload when schema contract is unavailable', () => {
    const snapshot = buildGovernanceSchemaExportSnapshot(undefined);
    expect(snapshot).toEqual({
      message: 'No governance schema contract loaded',
    });
  });
});
