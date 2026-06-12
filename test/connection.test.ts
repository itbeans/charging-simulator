import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChargerSimulator } from '../src/ChargerSimulator';
import { MockOCPPServer } from './helpers/MockOCPPServer';
import { makeConfig } from './helpers/config';

/** Poll until `predicate` is true (or fail after `timeoutMs`). */
function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      if (predicate()) resolve();
      else if (Date.now() > deadline) reject(new Error('waitFor timed out'));
      else setTimeout(poll, 10);
    };
    poll();
  });
}

describe('connection lifecycle', () => {
  let server: MockOCPPServer;
  let sim: ChargerSimulator | null;

  beforeEach(async () => {
    server = await MockOCPPServer.start();
    sim = null;
  });

  afterEach(async () => {
    if (sim) {
      await sim.disconnect();
    }
    await server.close();
  });

  it('boots: sends BootNotification with charger metadata, then a StatusNotification per connector', async () => {
    sim = new ChargerSimulator(makeConfig(server.url));
    await sim.connect();

    const [boot] = server.payloadsOf('BootNotification');
    expect(boot).toMatchObject({
      chargePointVendor: 'TestVendor',
      chargePointModel: 'TestModel-22kW',
      chargeBoxSerialNumber: 'TEST-SN-001',
      firmwareVersion: '0.0.1-test',
    });

    // connectorId 0 (the charger itself) + connectors 1 and 2, all Available
    const statuses = server.payloadsOf('StatusNotification');
    expect(statuses.map((s) => s['connectorId'])).toEqual([0, 1, 2]);
    expect(statuses.every((s) => s['status'] === 'Available')).toBe(true);

    expect(sim.isConnected()).toBe(true);
  });

  it('rejects connect() when the server rejects BootNotification', async () => {
    server.onAction('BootNotification', () => ({
      status: 'Rejected',
      currentTime: new Date().toISOString(),
      interval: 0,
    }));

    sim = new ChargerSimulator(makeConfig(server.url));
    await expect(sim.connect()).rejects.toThrow(/rejected BootNotification/i);
  });

  it('starts the heartbeat loop using the server-supplied interval', async () => {
    server.onAction('BootNotification', () => ({
      status: 'Accepted',
      currentTime: new Date().toISOString(),
      interval: 1, // 1-second heartbeat for the test
    }));

    sim = new ChargerSimulator(makeConfig(server.url));
    await sim.connect();

    await server.waitForAction('Heartbeat', 2, 4_000);
    expect(server.countOf('Heartbeat')).toBeGreaterThanOrEqual(2);
  });

  it('times out unanswered requests after requestTimeoutSecs', async () => {
    server.silence('Authorize');

    sim = new ChargerSimulator(makeConfig(server.url, { requestTimeoutSecs: 0.3 }));
    await sim.connect();

    const started = Date.now();
    await expect(sim.authorize('AABBCCDD')).rejects.toThrow(/timeout/i);
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(250);
    expect(elapsed).toBeLessThan(2_000);
  });

  it('rejects in-flight requests when the connection drops', async () => {
    server.silence('Authorize'); // keep the request pending while we cut the line

    sim = new ChargerSimulator(makeConfig(server.url));
    await sim.connect();

    const pending = sim.authorize('AABBCCDD');
    server.dropConnections();

    await expect(pending).rejects.toThrow(/WebSocket closed/i);
    expect(sim.isConnected()).toBe(false);
  });

  it('auto-reconnects and re-boots after a dropped connection', async () => {
    sim = new ChargerSimulator(makeConfig(server.url));
    sim.enableAutoReconnect(100); // fast backoff for the test
    await sim.connect();
    expect(server.countOf('BootNotification')).toBe(1);

    server.dropConnections();
    // Server-side terminate() propagates to the client asynchronously
    await waitFor(() => !sim!.isConnected());

    // Second BootNotification proves a full reconnect + boot sequence ran
    await server.waitForAction('BootNotification', 2, 5_000);
    expect(sim.isConnected()).toBe(true);
  });

  it('does not reconnect after an intentional disconnect', async () => {
    sim = new ChargerSimulator(makeConfig(server.url));
    sim.enableAutoReconnect(100);
    await sim.connect();

    await sim.disconnect();
    sim = null;

    await new Promise((r) => setTimeout(r, 400));
    expect(server.countOf('BootNotification')).toBe(1);
    expect(server.connectionCount).toBe(0);
  });
});
