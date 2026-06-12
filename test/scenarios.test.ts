import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChargerSimulator } from '../src/ChargerSimulator';
import { runBasicChargingSession } from '../src/scenarios/BasicChargingSession';
import { runMultiConnectorSession } from '../src/scenarios/MultiConnectorSession';
import { MockOCPPServer } from './helpers/MockOCPPServer';
import { makeConfig } from './helpers/config';

describe('scenarios (accelerated end-to-end)', () => {
  let server: MockOCPPServer;
  let sim: ChargerSimulator;

  beforeEach(async () => {
    server = await MockOCPPServer.start();
    sim = new ChargerSimulator(makeConfig(server.url));
    await sim.connect();
  });

  afterEach(async () => {
    await sim.disconnect();
    await server.close();
  });

  it('runBasicChargingSession completes a full flow and reports proportional energy', async () => {
    // 3 simulated minutes at 60× → ~3 real seconds
    await runBasicChargingSession(sim, {
      connectorId: 1,
      idTag: 'AABBCCDD',
      durationMins: 3,
      accelerated: true,
    });

    expect(server.countOf('Authorize')).toBe(1);
    expect(server.countOf('StartTransaction')).toBe(1);
    expect(server.countOf('StopTransaction')).toBe(1);
    // 60s simulated sample interval over 3 simulated minutes → ≥2 periodic
    // samples plus the final Transaction.End reading
    expect(server.countOf('MeterValues')).toBeGreaterThanOrEqual(3);

    // 3 minutes at 11–22 kW → at least ~500 Wh; proves accelerated metering
    // accrues energy proportional to simulated (not wall-clock) duration
    const connector = sim.getConnectorStatus(1);
    expect(connector.meterValue).toBeGreaterThan(400);
    expect(connector.status).toBe('Available');
    expect(connector.transactionId).toBeNull();
  }, 15_000);

  it('runBasicChargingSession fails fast when authorization is rejected', async () => {
    server.onAction('Authorize', () => ({ idTagInfo: { status: 'Blocked' } }));

    await expect(
      runBasicChargingSession(sim, { connectorId: 1, idTag: 'BLOCKED', durationMins: 1, accelerated: true }),
    ).rejects.toThrow(/Authorization failed: Blocked/);
    expect(server.countOf('StartTransaction')).toBe(0);
  });

  it('runMultiConnectorSession charges all connectors simultaneously then stops them', async () => {
    await runMultiConnectorSession(sim, {
      sessions: [
        { connectorId: 1, idTag: 'TAG00001' },
        { connectorId: 2, idTag: 'TAG00002' },
      ],
      durationMins: 2,
      accelerated: true,
    });

    expect(server.countOf('StartTransaction')).toBe(2);
    expect(server.countOf('StopTransaction')).toBe(2);

    const startedConnectors = server.payloadsOf('StartTransaction').map((p) => p['connectorId']).sort();
    expect(startedConnectors).toEqual([1, 2]);

    for (const state of sim.getAllConnectorStatuses()) {
      expect(state.transactionId).toBeNull();
      expect(state.status).toBe('Available');
      expect(state.meterValue).toBeGreaterThan(0);
    }
  }, 15_000);
});
