import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChargerSimulator } from '../src/ChargerSimulator';
import { MockOCPPServer } from './helpers/MockOCPPServer';
import { makeConfig } from './helpers/config';

describe('charging session flow', () => {
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

  it('authorize sends the idTag and returns the server status', async () => {
    const resp = await sim.authorize('AABBCCDD');
    expect(resp.idTagInfo.status).toBe('Accepted');
    expect(server.payloadsOf('Authorize')[0]).toEqual({ idTag: 'AABBCCDD' });
  });

  it('runs a full transaction with correct status transitions and meter accounting', async () => {
    const start = await sim.startTransaction(1, 'AABBCCDD');
    expect(start.transactionId).toBeGreaterThan(0);

    const startPayload = server.payloadsOf('StartTransaction')[0];
    expect(startPayload).toMatchObject({ connectorId: 1, idTag: 'AABBCCDD', meterStart: 0 });
    expect(startPayload['timestamp']).toBeTruthy();

    // Status went Preparing → Charging (after the boot-time Available×3)
    let statuses = server.payloadsOf('StatusNotification').slice(3);
    expect(statuses.map((s) => s['status'])).toEqual(['Preparing', 'Charging']);
    expect(sim.getConnectorStatus(1).transactionId).toBe(start.transactionId);

    await sim.stopTransaction(1, 'Local');

    // Final meter value flagged Transaction.End was sent before StopTransaction
    const meterPayloads = server.payloadsOf('MeterValues');
    expect(meterPayloads.length).toBeGreaterThanOrEqual(1);
    const lastMeter = meterPayloads[meterPayloads.length - 1] as {
      meterValue: Array<{ sampledValue: Array<{ context?: string }> }>;
    };
    expect(lastMeter.meterValue[0].sampledValue[0].context).toBe('Transaction.End');

    const stopPayload = server.payloadsOf('StopTransaction')[0];
    expect(stopPayload).toMatchObject({
      transactionId: start.transactionId,
      idTag: 'AABBCCDD',
      reason: 'Local',
    });
    expect(stopPayload['meterStop'] as number).toBeGreaterThan(0);

    // Status went Finishing → Available, and connector state was cleared
    statuses = server.payloadsOf('StatusNotification').slice(5);
    expect(statuses.map((s) => s['status'])).toEqual(['Finishing', 'Available']);
    const connector = sim.getConnectorStatus(1);
    expect(connector.transactionId).toBeNull();
    expect(connector.idTag).toBeNull();
    expect(connector.status).toBe('Available');
  });

  it('reports all four measurands with units in meter values', async () => {
    const start = await sim.startTransaction(1, 'AABBCCDD');
    await sim.sendMeterValues(1, start.transactionId);

    const payload = server.payloadsOf('MeterValues')[0] as {
      connectorId: number;
      transactionId: number;
      meterValue: Array<{ timestamp: string; sampledValue: Array<{ measurand?: string; unit?: string }> }>;
    };
    expect(payload.connectorId).toBe(1);
    expect(payload.transactionId).toBe(start.transactionId);

    const samples = payload.meterValue[0].sampledValue;
    const byMeasurand = Object.fromEntries(samples.map((s) => [s.measurand, s.unit]));
    expect(byMeasurand).toEqual({
      'Energy.Active.Import.Register': 'Wh',
      'Power.Active.Import': 'W',
      'Voltage': 'V',
      'Current.Import': 'A',
    });

    await sim.stopTransaction(1);
  });

  it('refuses to start a transaction on a busy connector', async () => {
    await sim.startTransaction(1, 'AABBCCDD');
    await expect(sim.startTransaction(1, '11223344')).rejects.toThrow(/not available/i);
    await sim.stopTransaction(1);
  });

  it('returns the connector to Available when the server rejects the idTag', async () => {
    server.onAction('StartTransaction', () => ({
      transactionId: 0,
      idTagInfo: { status: 'Invalid' },
    }));

    const resp = await sim.startTransaction(1, 'BADTAG');
    expect(resp.idTagInfo.status).toBe('Invalid');
    expect(sim.getConnectorStatus(1).transactionId).toBeNull();
    expect(sim.getConnectorStatus(1).status).toBe('Available');
  });

  it('accelerated mode reports periodic meter values proportional to simulated time', async () => {
    // 6-second simulated sample interval at 60× → a real tick every 100 ms
    await server.sendCall('ChangeConfiguration', { key: 'MeterValueSampleInterval', value: '6' });
    sim.setTimeAcceleration(60);

    await sim.startTransaction(1, 'AABBCCDD');
    await server.waitForAction('MeterValues', 3, 3_000);
    await sim.stopTransaction(1);

    // Energy must increase monotonically across samples
    const energies = server.payloadsOf('MeterValues').map((p) => {
      const mv = p as { meterValue: Array<{ sampledValue: Array<{ measurand?: string; value: string }> }> };
      const energy = mv.meterValue[0].sampledValue.find((s) => s.measurand === 'Energy.Active.Import.Register');
      return Number(energy?.value);
    });
    for (let i = 1; i < energies.length; i++) {
      expect(energies[i]).toBeGreaterThan(energies[i - 1]);
    }
  });
});
