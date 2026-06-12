import { SimulatorConfig } from '../../src/types';

/** Standard two-connector 22 kW test charger. */
export function makeConfig(serverUrl: string, overrides: Partial<SimulatorConfig> = {}): SimulatorConfig {
  return {
    serverUrl,
    chargingStationId: 'TEST-CS-001',
    vendor: 'TestVendor',
    model: 'TestModel-22kW',
    serialNumber: 'TEST-SN-001',
    firmwareVersion: '0.0.1-test',
    connectors: [
      { id: 1, maxPowerWatts: 22000, voltage: 230, phases: 3 },
      { id: 2, maxPowerWatts: 22000, voltage: 230, phases: 3 },
    ],
    heartbeatIntervalSecs: 3600,
    meterValueIntervalSecs: 60,
    verbose: false,
    ...overrides,
  };
}
