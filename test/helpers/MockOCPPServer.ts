/**
 * Mock OCPP 1.6J Central System for tests.
 *
 * Speaks the same [messageType, messageId, ...] JSON-array protocol as a real
 * ev-server. Provides canned responses for all charger-initiated actions,
 * per-action overrides, response suppression (for timeout tests), and a
 * sendCall() helper to issue server → charger commands.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';

const CALL = 2;
const CALL_RESULT = 3;
const CALL_ERROR = 4;

export interface ReceivedMessage {
  action: string;
  payload: Record<string, unknown>;
}

export type CallOutcome =
  | { ok: Record<string, unknown> }
  | { error: { code: string; description: string } };

type ActionHandler = (payload: Record<string, unknown>) => Record<string, unknown>;

export class MockOCPPServer {
  private wss: WebSocketServer;
  private clients: WebSocket[] = [];
  private overrides = new Map<string, ActionHandler>();
  private silenced = new Set<string>();
  private pendingCalls = new Map<string, (outcome: CallOutcome) => void>();
  private txCounter = 0;

  /** Every charger-initiated CALL received, in order. */
  readonly received: ReceivedMessage[] = [];

  private constructor(wss: WebSocketServer) {
    this.wss = wss;
    wss.on('connection', (ws) => {
      this.clients.push(ws);
      ws.on('message', (raw) => this.onMessage(ws, raw.toString()));
      ws.on('close', () => {
        this.clients = this.clients.filter((c) => c !== ws);
      });
    });
  }

  /** Start a server on an ephemeral port. */
  static start(): Promise<MockOCPPServer> {
    return new Promise((resolve) => {
      const wss = new WebSocketServer({ port: 0 }, () => resolve(new MockOCPPServer(wss)));
    });
  }

  /** Base URL for SimulatorConfig.serverUrl (charger ID is appended by the simulator). */
  get url(): string {
    const { port } = this.wss.address() as AddressInfo;
    return `ws://127.0.0.1:${port}/OCPP16/tenant/token`;
  }

  get connectionCount(): number {
    return this.clients.length;
  }

  /** Replace the canned response for an action. */
  onAction(action: string, handler: ActionHandler): void {
    this.overrides.set(action, handler);
  }

  /** Never respond to this action (request-timeout tests). */
  silence(action: string): void {
    this.silenced.add(action);
  }

  /** Issue a server → charger command on the most recent connection. */
  sendCall(action: string, payload: Record<string, unknown>): Promise<CallOutcome> {
    const ws = this.clients[this.clients.length - 1];
    if (!ws) {
      return Promise.reject(new Error('No charger connected'));
    }
    const messageId = randomUUID();
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(messageId, resolve);
      ws.send(JSON.stringify([CALL, messageId, action, payload]));
      setTimeout(() => {
        if (this.pendingCalls.delete(messageId)) {
          reject(new Error(`No response to server call ${action} within 5s`));
        }
      }, 5_000);
    });
  }

  countOf(action: string): number {
    return this.received.filter((m) => m.action === action).length;
  }

  payloadsOf(action: string): Record<string, unknown>[] {
    return this.received.filter((m) => m.action === action).map((m) => m.payload);
  }

  /** Resolve once `count` messages of `action` have been received. */
  waitForAction(action: string, count = 1, timeoutMs = 5_000): Promise<Record<string, unknown>[]> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const poll = () => {
        if (this.countOf(action) >= count) {
          resolve(this.payloadsOf(action));
        } else if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${count}× ${action} (got ${this.countOf(action)})`));
        } else {
          setTimeout(poll, 10);
        }
      };
      poll();
    });
  }

  /** Forcibly drop all charger connections (reconnect tests). */
  dropConnections(): void {
    for (const ws of this.clients) {
      ws.terminate();
    }
    this.clients = [];
  }

  close(): Promise<void> {
    this.dropConnections();
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }

  // ---------------------------------------------------------------------------

  private onMessage(ws: WebSocket, raw: string): void {
    const parsed = JSON.parse(raw) as unknown[];
    const messageType = parsed[0] as number;

    if (messageType === CALL_RESULT) {
      const [, messageId, payload] = parsed as [number, string, Record<string, unknown>];
      const pending = this.pendingCalls.get(messageId);
      if (pending) {
        this.pendingCalls.delete(messageId);
        pending({ ok: payload });
      }
      return;
    }

    if (messageType === CALL_ERROR) {
      const [, messageId, code, description] = parsed as [number, string, string, string];
      const pending = this.pendingCalls.get(messageId);
      if (pending) {
        this.pendingCalls.delete(messageId);
        pending({ error: { code, description } });
      }
      return;
    }

    // Charger-initiated CALL
    const [, messageId, action, payload] = parsed as [number, string, string, Record<string, unknown>];
    this.received.push({ action, payload });

    if (this.silenced.has(action)) {
      return;
    }

    const handler = this.overrides.get(action) ?? this.defaultHandler(action);
    ws.send(JSON.stringify([CALL_RESULT, messageId, handler(payload)]));
  }

  private defaultHandler(action: string): ActionHandler {
    switch (action) {
      case 'BootNotification':
        // Long interval so heartbeats don't interfere with tests
        return () => ({ status: 'Accepted', currentTime: new Date().toISOString(), interval: 3600 });
      case 'Authorize':
        return () => ({ idTagInfo: { status: 'Accepted' } });
      case 'StartTransaction':
        return () => ({ transactionId: ++this.txCounter, idTagInfo: { status: 'Accepted' } });
      case 'StopTransaction':
        return () => ({ idTagInfo: { status: 'Accepted' } });
      case 'Heartbeat':
        return () => ({ currentTime: new Date().toISOString() });
      default:
        // StatusNotification, MeterValues, etc. expect an empty object
        return () => ({});
    }
  }
}
