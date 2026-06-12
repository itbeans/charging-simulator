/**
 * Multi-connector scenario.
 *
 * Simultaneously starts sessions on all available connectors, runs them for
 * `durationMins`, then stops them in sequence.  Useful for testing smart
 * charging and load-balancing behaviour.
 */

import { ChargerSimulator } from '../ChargerSimulator';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface MultiConnectorOptions {
  /** Map of connectorId → idTag */
  sessions: Array<{ connectorId: number; idTag: string }>;
  durationMins: number;
  accelerated?: boolean;
}

export async function runMultiConnectorSession(
  simulator: ChargerSimulator,
  options: MultiConnectorOptions,
): Promise<void> {
  const { sessions, durationMins, accelerated = false } = options;
  const timeScale = accelerated ? 1000 : 60_000;
  // Keep meter value reporting in step with simulated time (1 min = 1 s → ×60)
  simulator.setTimeAcceleration(accelerated ? 60 : 1);

  console.log(`\n=== Multi-Connector Session ===`);
  console.log(`  Sessions  : ${sessions.map((s) => `connector ${s.connectorId} → ${s.idTag}`).join(', ')}`);
  console.log(`  Duration  : ${durationMins} min${accelerated ? ' (accelerated)' : ''}`);
  console.log('');

  // Start all sessions concurrently
  await Promise.all(
    sessions.map(async ({ connectorId, idTag }) => {
      const authResp = await simulator.authorize(idTag);
      if (authResp.idTagInfo.status !== 'Accepted') {
        console.warn(`  Connector ${connectorId}: authorization failed (${authResp.idTagInfo.status})`);
        return;
      }
      const startResp = await simulator.startTransaction(connectorId, idTag);
      console.log(`  Connector ${connectorId}: started transaction ${startResp.transactionId}`);
    }),
  );

  await sleep(durationMins * timeScale);

  // Stop all active sessions
  const statuses = simulator.getAllConnectorStatuses();
  for (const state of statuses) {
    if (state.transactionId !== null) {
      await simulator.stopTransaction(state.id, 'Local');
      console.log(`  Connector ${state.id}: stopped`);
    }
  }

  console.log('=== Multi-Connector Session ended ===\n');
}
