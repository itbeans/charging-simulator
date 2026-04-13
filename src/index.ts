#!/usr/bin/env node
/**
 * EV Charger Simulator CLI
 *
 * Usage:
 *   ts-node src/index.ts [command] [options]
 *
 * Commands:
 *   boot           Connect and boot (keeps running, responds to server commands)
 *   session        Run a single basic charging session then exit
 *   multi          Run sessions on all connectors simultaneously then exit
 *   scenario <n>   Run a named scenario: basic | multi
 *
 * All options are read from config.json (or the file path in EV_SIM_CONFIG env var).
 * Individual values can be overridden via environment variables:
 *   EV_SIM_SERVER_URL, EV_SIM_STATION_ID, EV_SIM_ID_TAG, EV_SIM_DURATION_MINS
 */

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { ChargerSimulator } from './ChargerSimulator';
import { SimulatorConfig } from './types';
import { runBasicChargingSession } from './scenarios/BasicChargingSession';
import { runMultiConnectorSession } from './scenarios/MultiConnectorSession';

// ---------------------------------------------------------------------------
// Load configuration
// ---------------------------------------------------------------------------

function loadConfig(): SimulatorConfig {
  const configPath = process.env['EV_SIM_CONFIG'] ?? path.join(__dirname, '..', 'config.json');
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    console.error('Copy config.example.json to config.json and fill in your tenant/token values.');
    process.exit(1);
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  const cfg = JSON.parse(raw) as SimulatorConfig;

  // Environment variable overrides
  if (process.env['EV_SIM_SERVER_URL']) {
    cfg.serverUrl = process.env['EV_SIM_SERVER_URL'];
  }
  if (process.env['EV_SIM_STATION_ID']) {
    cfg.chargingStationId = process.env['EV_SIM_STATION_ID'];
  }
  if (process.env['EV_SIM_VERBOSE'] === 'true') {
    cfg.verbose = true;
  }

  return cfg;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdBoot(config: SimulatorConfig): Promise<void> {
  // Minimal HTTP server so Cloud Run startup/liveness probes succeed.
  // Cloud Run sends GET / to $PORT (default 8080); without a listener the
  // container fails health checks and is never kept alive.
  const port = parseInt(process.env['PORT'] ?? '8080', 10);
  const healthServer = http.createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK\n');
  });
  healthServer.listen(port);

  console.log(`Starting simulator for ${config.chargingStationId}…`);
  const sim = new ChargerSimulator(config);
  await sim.connect();

  console.log('Simulator running. Press Ctrl+C to stop.');
  await new Promise<void>((resolve) => {
    const shutdown = () => {
      healthServer.close();
      void sim.disconnect().then(resolve);
    };
    process.on('SIGINT', () => {
      console.log('\nShutting down…');
      shutdown();
    });
    process.on('SIGTERM', () => shutdown());
  });
}

async function cmdSession(config: SimulatorConfig): Promise<void> {
  const idTag = process.env['EV_SIM_ID_TAG'] ?? 'AABBCCDD';
  const durationMins = parseInt(process.env['EV_SIM_DURATION_MINS'] ?? '5', 10);
  const accelerated = process.env['EV_SIM_ACCELERATED'] === 'true';

  const sim = new ChargerSimulator(config);
  await sim.connect();

  try {
    await runBasicChargingSession(sim, {
      connectorId: config.connectors[0]?.id ?? 1,
      idTag,
      durationMins,
      accelerated,
    });
  } finally {
    await sim.disconnect();
  }
}

async function cmdMulti(config: SimulatorConfig): Promise<void> {
  const idTags = (process.env['EV_SIM_ID_TAGS'] ?? 'AABBCCDD,11223344').split(',');
  const durationMins = parseInt(process.env['EV_SIM_DURATION_MINS'] ?? '5', 10);
  const accelerated = process.env['EV_SIM_ACCELERATED'] === 'true';

  const sessions = config.connectors.map((c, i) => ({
    connectorId: c.id,
    idTag: idTags[i] ?? idTags[0] ?? 'AABBCCDD',
  }));

  const sim = new ChargerSimulator(config);
  await sim.connect();

  try {
    await runMultiConnectorSession(sim, { sessions, durationMins, accelerated });
  } finally {
    await sim.disconnect();
  }
}

// ---------------------------------------------------------------------------
// Multiple simultaneous charger simulation
// ---------------------------------------------------------------------------

async function cmdFleet(config: SimulatorConfig): Promise<void> {
  const count = parseInt(process.env['EV_SIM_FLEET_COUNT'] ?? '3', 10);
  const idTag = process.env['EV_SIM_ID_TAG'] ?? 'AABBCCDD';
  const durationMins = parseInt(process.env['EV_SIM_DURATION_MINS'] ?? '5', 10);
  const accelerated = process.env['EV_SIM_ACCELERATED'] === 'true';

  console.log(`Starting fleet of ${count} chargers…`);

  const simulators = Array.from({ length: count }, (_, i) => {
    const cfg: SimulatorConfig = {
      ...config,
      chargingStationId: `${config.chargingStationId}-${String(i + 1).padStart(2, '0')}`,
    };
    return new ChargerSimulator(cfg);
  });

  // Connect all
  await Promise.all(simulators.map((s) => s.connect()));
  console.log('All chargers connected. Running sessions…');

  // Run sessions on all simultaneously (staggered start by 2s to avoid rate limiting)
  await Promise.all(
    simulators.map(async (sim, i) => {
      await new Promise<void>((r) => setTimeout(r, i * 2000));
      await runBasicChargingSession(sim, {
        connectorId: config.connectors[0]?.id ?? 1,
        idTag,
        durationMins,
        accelerated,
      });
    }),
  );

  await Promise.all(simulators.map((s) => s.disconnect()));
  console.log('Fleet simulation complete.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'boot';
  const config = loadConfig();

  switch (command) {
    case 'boot':
      await cmdBoot(config);
      break;
    case 'session':
      await cmdSession(config);
      break;
    case 'multi':
      await cmdMulti(config);
      break;
    case 'fleet':
      await cmdFleet(config);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Available commands: boot | session | multi | fleet');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
