import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChargerSimulator } from '../src/ChargerSimulator';
import { MockOCPPServer } from './helpers/MockOCPPServer';
import { makeConfig } from './helpers/config';

describe('server → charger commands', () => {
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

  it('RemoteStartTransaction: accepts a valid connector and starts the transaction', async () => {
    const outcome = await server.sendCall('RemoteStartTransaction', { connectorId: 1, idTag: 'AABBCCDD' });
    expect(outcome).toEqual({ ok: { status: 'Accepted' } });

    await server.waitForAction('StartTransaction');
    expect(server.payloadsOf('StartTransaction')[0]).toMatchObject({ connectorId: 1, idTag: 'AABBCCDD' });

    // Clean up the transaction the command started
    await server.waitForAction('StatusNotification', 5); // boot×3 + Preparing + Charging
    await sim.stopTransaction(1);
  });

  it('RemoteStartTransaction: rejects an unknown connector', async () => {
    const outcome = await server.sendCall('RemoteStartTransaction', { connectorId: 99, idTag: 'AABBCCDD' });
    expect(outcome).toEqual({ ok: { status: 'Rejected' } });
    expect(server.countOf('StartTransaction')).toBe(0);
  });

  it('RemoteStopTransaction: stops the matching transaction with reason Remote', async () => {
    const start = await sim.startTransaction(1, 'AABBCCDD');

    const outcome = await server.sendCall('RemoteStopTransaction', { transactionId: start.transactionId });
    expect(outcome).toEqual({ ok: { status: 'Accepted' } });

    await server.waitForAction('StopTransaction');
    expect(server.payloadsOf('StopTransaction')[0]).toMatchObject({
      transactionId: start.transactionId,
      reason: 'Remote',
    });
  });

  it('RemoteStopTransaction: rejects an unknown transaction id', async () => {
    const outcome = await server.sendCall('RemoteStopTransaction', { transactionId: 424242 });
    expect(outcome).toEqual({ ok: { status: 'Rejected' } });
  });

  it('ChangeConfiguration / GetConfiguration round-trip', async () => {
    const change = await server.sendCall('ChangeConfiguration', { key: 'HeartbeatInterval', value: '120' });
    expect(change).toEqual({ ok: { status: 'Accepted' } });

    const get = await server.sendCall('GetConfiguration', { key: ['HeartbeatInterval'] });
    expect(get).toEqual({
      ok: {
        configurationKey: [{ key: 'HeartbeatInterval', readonly: false, value: '120' }],
        unknownKey: [],
      },
    });
  });

  it('GetConfiguration without keys returns the full configuration store', async () => {
    const get = await server.sendCall('GetConfiguration', {});
    const keys = (get as { ok: { configurationKey: Array<{ key: string }> } }).ok.configurationKey.map((k) => k.key);
    expect(keys).toContain('HeartbeatInterval');
    expect(keys).toContain('MeterValueSampleInterval');
  });

  it('UnlockConnector: Unlocked for a known connector, NotSupported for unknown', async () => {
    expect(await server.sendCall('UnlockConnector', { connectorId: 1 })).toEqual({ ok: { status: 'Unlocked' } });
    expect(await server.sendCall('UnlockConnector', { connectorId: 99 })).toEqual({ ok: { status: 'NotSupported' } });
  });

  it('Reset: stops active transactions with the matching reason, then re-boots', async () => {
    await sim.startTransaction(1, 'AABBCCDD');

    const outcome = await server.sendCall('Reset', { type: 'Soft' });
    expect(outcome).toEqual({ ok: { status: 'Accepted' } });

    // The open transaction is closed with reason SoftReset…
    await server.waitForAction('StopTransaction');
    expect(server.payloadsOf('StopTransaction')[0]).toMatchObject({ reason: 'SoftReset' });
    expect(sim.getConnectorStatus(1).transactionId).toBeNull();

    // …and a second BootNotification follows the simulated 2s reboot
    await server.waitForAction('BootNotification', 2, 6_000);
  }, 10_000);

  it('replies with CALL_ERROR NotImplemented for unknown commands', async () => {
    const outcome = await server.sendCall('TriggerMessage', { requestedMessage: 'Heartbeat' });
    expect(outcome).toMatchObject({ error: { code: 'NotImplemented' } });
  });

  it('acknowledges the remaining informational commands', async () => {
    expect(await server.sendCall('ClearCache', {})).toEqual({ ok: { status: 'Accepted' } });
    expect(await server.sendCall('SetChargingProfile', { connectorId: 1, csChargingProfiles: {} })).toEqual({ ok: { status: 'Accepted' } });
    expect(await server.sendCall('ClearChargingProfile', {})).toEqual({ ok: { status: 'Accepted' } });
    expect(await server.sendCall('GetDiagnostics', { location: 'ftp://x' })).toEqual({ ok: { fileName: 'diagnostics.log' } });
    expect(await server.sendCall('DataTransfer', { vendorId: 'v' })).toEqual({ ok: { status: 'Accepted' } });
  });
});
