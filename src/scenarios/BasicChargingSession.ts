/**
 * Basic charging session scenario.
 *
 * Flow:
 *   1. Authorize idTag
 *   2. StartTransaction on connector 1
 *   3. Send meter values for `durationMins` minutes (at configured interval)
 *   4. StopTransaction
 */

import { ChargerSimulator } from '../ChargerSimulator';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface BasicSessionOptions {
  connectorId?: number;
  idTag: string;
  durationMins: number;     // Total session duration in minutes
  /** If true, run in accelerated mode: each "minute" = 1 second */
  accelerated?: boolean;
}

export async function runBasicChargingSession(
  simulator: ChargerSimulator,
  options: BasicSessionOptions,
): Promise<void> {
  const { connectorId = 1, idTag, durationMins, accelerated = false } = options;
  const timeScale = accelerated ? 1000 : 60_000; // ms per simulated minute
  // Keep meter value reporting in step with simulated time (1 min = 1 s → ×60)
  simulator.setTimeAcceleration(accelerated ? 60 : 1);

  console.log(`\n=== Basic Charging Session ===`);
  console.log(`  Connector : ${connectorId}`);
  console.log(`  idTag     : ${idTag}`);
  console.log(`  Duration  : ${durationMins} min${accelerated ? ' (accelerated: 1 min = 1 s)' : ''}`);
  console.log('');

  // 1. Authorize
  const authResp = await simulator.authorize(idTag);
  if (authResp.idTagInfo.status !== 'Accepted') {
    throw new Error(`Authorization failed: ${authResp.idTagInfo.status}`);
  }

  // 2. StartTransaction
  const startResp = await simulator.startTransaction(connectorId, idTag);
  if (startResp.idTagInfo.status !== 'Accepted') {
    throw new Error(`StartTransaction failed: ${startResp.idTagInfo.status}`);
  }
  const transactionId = startResp.transactionId;
  console.log(`  Transaction ID: ${transactionId}`);

  // 3. Wait for session duration
  // (The ChargerSimulator already sends periodic meter values via its internal timer.
  //  Here we just wait for the desired duration.)
  const durationMs = durationMins * timeScale;
  console.log(`  Waiting ${durationMins} min${accelerated ? ' (accelerated)' : ''}...`);
  await sleep(durationMs);

  // 4. StopTransaction
  const stopResp = await simulator.stopTransaction(connectorId, 'Local');
  console.log(`  Session complete. idTagInfo: ${stopResp.idTagInfo?.status ?? 'n/a'}`);

  const final = simulator.getConnectorStatus(connectorId);
  const consumed = final.meterValue - final.sessionStartMeter;
  console.log(`  Total energy consumed: ~${consumed} Wh`);
  console.log('=== Session ended ===\n');
}
